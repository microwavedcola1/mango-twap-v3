import {
  BookSide,
  BookSideLayout,
  Config,
  getAllMarkets,
  getMarketByBaseSymbolAndKind,
  getMarketByPublicKey,
  getMultipleAccounts,
  GroupConfig,
  I80F48,
  MangoAccount,
  MangoClient,
  MangoGroup,
  MarketConfig,
  nativeI80F48ToUi,
  PerpMarket,
  PerpMarketLayout,
  PerpOrder,
  QUOTE_INDEX,
} from "@blockworks-foundation/mango-client";
import { Market, OpenOrders, Orderbook } from "@project-serum/serum";
import { Order } from "@project-serum/serum/lib/market";
import {
  Account,
  AccountInfo,
  Commitment,
  Connection,
  PublicKey,
  TransactionSignature,
} from "@solana/web3.js";
import BN from "bn.js";
import { logger } from "./logger";
import { zipDict } from "./zipDict";
import { OrderInfo } from "./types";
import bs58 from "bs58";
import { ENV } from "./constants";

class MangoSimpleClient {
  constructor(
    public connection: Connection,
    public client: MangoClient,
    public mangoGroupConfig: GroupConfig,
    public mangoGroup: MangoGroup,
    public owner: Account,
    public mangoAccount: MangoAccount
  ) {}

  static async create() {
    const groupName = ENV.GROUP;
    const clusterUrl = ENV.rpcURL;

    logger.info(`Creating mango client for ${groupName} using ${clusterUrl}`);

    const mangoGroupConfig: GroupConfig = Config.ids().groups.filter(
      (group) => group.name === groupName
    )[0];

    const connection = new Connection(clusterUrl, "processed" as Commitment);

    const mangoClient = new MangoClient(
      connection,
      mangoGroupConfig.mangoProgramId
    );

    logger.info(`- fetching mango group`);
    const mangoGroup = await mangoClient.getMangoGroup(
      mangoGroupConfig.publicKey
    );

    logger.info(`- loading root banks`);
    await mangoGroup.loadRootBanks(connection);

    logger.info(`- loading cache`);
    await mangoGroup.loadCache(connection);

    const owner = new Account(bs58.decode(ENV.walletPK));
    let mangoAccount;

    if (ENV.MANGO_ACCOUNT) {
      logger.info(
        `- MANGO_ACCOUNT explicitly specified, fetching mango account ${ENV.MANGO_ACCOUNT}`
      );
      mangoAccount = await mangoClient.getMangoAccount(
        new PublicKey(ENV.MANGO_ACCOUNT),
        mangoGroupConfig.serumProgramId
      );
    } else {
      logger.info(
        `- fetching mango accounts for ${owner.publicKey.toBase58()}`
      );
      let mangoAccounts;
      try {
        mangoAccounts = await mangoClient.getMangoAccountsForOwner(
          mangoGroup,
          owner.publicKey
        );
      } catch (error) {
        logger.error(
          `- error retrieving mango accounts for ${owner.publicKey.toBase58()}`
        );
        process.exit(1);
      }

      if (!mangoAccounts.length) {
        logger.error(`- no mango account found ${owner.publicKey.toBase58()}`);
        process.exit(1);
      }

      const sortedMangoAccounts = mangoAccounts
        .slice()
        .sort((a, b) =>
          a.publicKey.toBase58() > b.publicKey.toBase58() ? 1 : -1
        );

      // just select first arbitrarily
      mangoAccount = sortedMangoAccounts[0];

      const debugAccounts = sortedMangoAccounts
        .map((mangoAccount) => mangoAccount.publicKey.toBase58())
        .join(", ");
      logger.info(
        `- found mango accounts ${debugAccounts}, using ${mangoAccount.publicKey.toBase58()}`
      );
    }

    if (mangoAccount.owner.toBase58() !== owner.publicKey.toBase58()) {
      logger.info(
        `- Note: ${owner.publicKey.toBase58()} is a delegate for ${mangoAccount.publicKey.toBase58()}`
      );
    }

    // load open orders accounts, used by e.g. getSpotOpenOrdersAccountForMarket
    await mangoAccount.loadOpenOrders(
      connection,
      new PublicKey(mangoGroupConfig.serumProgramId)
    );

    return new MangoSimpleClient(
      connection,
      mangoClient,
      mangoGroupConfig,
      mangoGroup,
      owner,
      mangoAccount
    );
  }

  /// public

  public async fetchAllMarkets(
    marketName?: string
  ): Promise<Partial<Record<string, Market | PerpMarket>>> {
    let allMarketConfigs = getAllMarkets(this.mangoGroupConfig);
    let allMarketPks = allMarketConfigs.map((m) => m.publicKey);

    if (marketName !== undefined) {
      allMarketConfigs = allMarketConfigs.filter(
        (marketConfig) => marketConfig.name === marketName
      );
      allMarketPks = allMarketConfigs.map((m) => m.publicKey);
    }

    const allMarketAccountInfos = await getMultipleAccounts(
      this.connection,
      allMarketPks
    );

    const allMarketAccounts = allMarketConfigs.map((config, i) => {
      if (config.kind === "spot") {
        const decoded = Market.getLayout(
          this.mangoGroupConfig.mangoProgramId
        ).decode(allMarketAccountInfos[i].accountInfo.data);
        return new Market(
          decoded,
          config.baseDecimals,
          config.quoteDecimals,
          undefined,
          this.mangoGroupConfig.serumProgramId
        );
      }
      if (config.kind === "perp") {
        const decoded = PerpMarketLayout.decode(
          allMarketAccountInfos[i].accountInfo.data
        );
        return new PerpMarket(
          config.publicKey,
          config.baseDecimals,
          config.quoteDecimals,
          decoded
        );
      }
    });

    return zipDict(
      allMarketPks.map((pk) => pk.toBase58()),
      allMarketAccounts
    );
  }

  public async fetchAllBidsAndAsks(
    filterForMangoAccount: boolean = false,
    marketName?: string
  ): Promise<OrderInfo[][]> {
    this.mangoAccount.loadOpenOrders(
      this.connection,
      new PublicKey(this.mangoGroupConfig.serumProgramId)
    );

    let allMarketConfigs = getAllMarkets(this.mangoGroupConfig);
    let allMarketPks = allMarketConfigs.map((m) => m.publicKey);

    if (marketName !== undefined) {
      allMarketConfigs = allMarketConfigs.filter(
        (marketConfig) => marketConfig.name === marketName
      );
      allMarketPks = allMarketConfigs.map((m) => m.publicKey);
    }

    const allBidsAndAsksPks = allMarketConfigs
      .map((m) => [m.bidsKey, m.asksKey])
      .flat();
    const allBidsAndAsksAccountInfos = await getMultipleAccounts(
      this.connection,
      allBidsAndAsksPks
    );

    const accountInfos: { [key: string]: AccountInfo<Buffer> } = {};
    allBidsAndAsksAccountInfos.forEach(
      ({ publicKey, context, accountInfo }) => {
        accountInfos[publicKey.toBase58()] = accountInfo;
      }
    );

    const markets = await this.fetchAllMarkets(marketName);

    // @ts-ignore
    return Object.entries(markets).map(([address, market]) => {
      const marketConfig = getMarketByPublicKey(this.mangoGroupConfig, address);
      if (market instanceof Market) {
        return this.parseSpotOrders(
          market,
          marketConfig!,
          accountInfos,
          filterForMangoAccount ? this.mangoAccount : undefined
        );
      } else if (market instanceof PerpMarket) {
        return this.parsePerpOpenOrders(
          market,
          marketConfig!,
          accountInfos,
          filterForMangoAccount ? this.mangoAccount : undefined
        );
      }
    });
  }

  public async placeOrder(
    market: string,
    side: "buy" | "sell",
    quantity: number,
    price?: number,
    orderType: "ioc" | "postOnly" | "market" | "limit" = "limit",
    clientOrderId?: number
  ): Promise<TransactionSignature> {
    if (market.includes("PERP")) {
      const perpMarketConfig = getMarketByBaseSymbolAndKind(
        this.mangoGroupConfig,
        market.split("-")[0],
        "perp"
      );
      const perpMarket = await this.mangoGroup.loadPerpMarket(
        this.connection,
        perpMarketConfig.marketIndex,
        perpMarketConfig.baseDecimals,
        perpMarketConfig.quoteDecimals
      );
      // TODO: this is a workaround, mango-v3 has a assertion for price>0 for all order types
      // this will be removed soon hopefully
      price = orderType !== "market" ? price : 1;
      return await this.client.placePerpOrder(
        this.mangoGroup,
        this.mangoAccount,
        this.mangoGroup.mangoCache,
        perpMarket,
        this.owner,
        side,
        price!,
        quantity,
        orderType,
        clientOrderId
      );
    } else {
      // serum doesn't really support market orders, calculate a pseudo market price
      price =
        orderType !== "market"
          ? price
          : await this.calculateMarketOrderPrice(market, quantity, side);

      const spotMarketConfig = getMarketByBaseSymbolAndKind(
        this.mangoGroupConfig,
        market.split("/")[0],
        "spot"
      );
      const spotMarket = await Market.load(
        this.connection,
        spotMarketConfig.publicKey,
        undefined,
        this.mangoGroupConfig.serumProgramId
      );
      return await this.client.placeSpotOrder(
        this.mangoGroup,
        this.mangoAccount,
        this.mangoGroup.mangoCache,
        spotMarket,
        this.owner,
        side,
        price!,
        quantity,
        orderType === "market" ? "limit" : orderType,
        new BN(clientOrderId!)
      );
    }
  }

  private async calculateMarketOrderPrice(
    market: string,
    quantity: number,
    side: "buy" | "sell"
  ): Promise<number> {
    const bidsAndAsks = await this.fetchAllBidsAndAsks(false, market);

    const bids = bidsAndAsks
      .flat()
      .filter((orderInfo) => orderInfo.order.side === "buy")
      .sort((b1, b2) => b2.order.price - b1.order.price);
    const asks = bidsAndAsks
      .flat()
      .filter((orderInfo) => orderInfo.order.side === "sell")
      .sort((a1, a2) => a1.order.price - a2.order.price);

    const orders: OrderInfo[] = side === "buy" ? asks : bids;

    let acc = 0;
    let selectedOrder;
    for (const order of orders) {
      acc += order.order.size;
      if (acc >= quantity) {
        selectedOrder = order;
        break;
      }
    }

    if (!selectedOrder) {
      throw new Error("Orderbook empty!");
    }

    if (side === "buy") {
      return selectedOrder.order.price * 1.05;
    } else {
      return selectedOrder.order.price * 0.95;
    }
  }

  private parseSpotOrders(
    market: Market,
    config: MarketConfig,
    accountInfos: { [key: string]: AccountInfo<Buffer> },
    mangoAccount?: MangoAccount
  ): OrderInfo[] {
    const bidData = accountInfos[market["_decoded"].bids.toBase58()]?.data;
    const askData = accountInfos[market["_decoded"].asks.toBase58()]?.data;

    const bidOrderBook =
      market && bidData ? Orderbook.decode(market, bidData) : ([] as Order[]);
    const askOrderBook =
      market && askData ? Orderbook.decode(market, askData) : ([] as Order[]);

    let openOrdersForMarket = [...bidOrderBook, ...askOrderBook];
    if (mangoAccount !== undefined) {
      const openOrders =
        mangoAccount.spotOpenOrdersAccounts[config.marketIndex];
      if (!openOrders) return [];
      openOrdersForMarket = openOrdersForMarket.filter((o) =>
        o.openOrdersAddress.equals(openOrders.address)
      );
    }

    return openOrdersForMarket.map<OrderInfo>((order) => ({
      order,
      market: { account: market, config },
    }));
  }

  async fetchSpotPosition(market: string) {
    // local copies of mango objects
    const mangoGroupConfig = this.mangoGroupConfig;
    const mangoGroup = this.mangoGroup;

    // (re)load things which we want fresh
    const [mangoAccount, mangoCache, rootBanks] = await Promise.all([
      this.mangoAccount.reload(this.connection, this.mangoGroup.dexProgramId),
      this.mangoGroup.loadCache(this.connection),
      mangoGroup.loadRootBanks(this.connection),
    ]);

    const spotMarketConfig = mangoGroupConfig.spotMarkets.filter(
      (spotMarketConfig) => spotMarketConfig.name === market
    )[0];
    const marketIndex = spotMarketConfig.marketIndex;

    if (!mangoAccount || !mangoGroup) {
      return [];
    }

    const openOrders: OpenOrders | undefined =
      mangoAccount.spotOpenOrdersAccounts[marketIndex];
    const quoteCurrencyIndex = QUOTE_INDEX;

    let nativeBaseFree = 0;
    let nativeQuoteFree = 0;
    let nativeBaseLocked = 0;
    let nativeQuoteLocked = 0;
    if (openOrders) {
      nativeBaseFree = openOrders.baseTokenFree.toNumber();
      nativeQuoteFree = openOrders.quoteTokenFree
        .add((openOrders as any)["referrerRebatesAccrued"])
        .toNumber();
      nativeBaseLocked = openOrders.baseTokenTotal
        .sub(openOrders.baseTokenFree)
        .toNumber();
      nativeQuoteLocked = openOrders.quoteTokenTotal
        .sub(openOrders.quoteTokenFree)
        .toNumber();
    }

    const tokenIndex = marketIndex;

    const net = (nativeBaseLocked: number, tokenIndex: number) => {
      const amount = mangoAccount
        .getUiDeposit(
          mangoCache.rootBankCache[tokenIndex],
          mangoGroup,
          tokenIndex
        )
        .add(
          nativeI80F48ToUi(
            I80F48.fromNumber(nativeBaseLocked),
            mangoGroup.tokens[tokenIndex].decimals
          ).sub(
            mangoAccount.getUiBorrow(
              mangoCache.rootBankCache[tokenIndex],
              mangoGroup,
              tokenIndex
            )
          )
        );

      return amount;
    };

    return net(nativeBaseLocked, tokenIndex);
  }

  private parsePerpOpenOrders(
    market: PerpMarket,
    config: MarketConfig,
    accountInfos: { [key: string]: AccountInfo<Buffer> },
    mangoAccount?: MangoAccount
  ): OrderInfo[] {
    const bidData = accountInfos[market.bids.toBase58()]?.data;
    const askData = accountInfos[market.asks.toBase58()]?.data;

    const bidOrderBook =
      market && bidData
        ? new BookSide(market.bids, market, BookSideLayout.decode(bidData))
        : ([] as PerpOrder[]);
    const askOrderBook =
      market && askData
        ? new BookSide(market.asks, market, BookSideLayout.decode(askData))
        : ([] as PerpOrder[]);

    let openOrdersForMarket = [...bidOrderBook, ...askOrderBook];
    if (mangoAccount !== undefined) {
      openOrdersForMarket = openOrdersForMarket.filter((o) =>
        o.owner.equals(mangoAccount.publicKey)
      );
    }

    return openOrdersForMarket.map<OrderInfo>((order) => ({
      order,
      market: { account: market, config },
    }));
  }
}

export default MangoSimpleClient;
