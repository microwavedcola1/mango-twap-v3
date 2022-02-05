import mangoSimpleClient from "../mango.simple.client";
import MangoSimpleClient from "../mango.simple.client";
import { getMarketLastPrice } from "../eventHistoryApi";
import { logger } from "../logger";
import { ALL_MARKET_NAMES } from "../constants";
import { PerpMarket } from "@blockworks-foundation/mango-client";

interface MarketOrderArgs {
  market: string;
  side: "buy" | "sell";
  amount: number;
  priceThreshold?: string;
}

let client: MangoSimpleClient;

function validate(args: MarketOrderArgs) {
  // size is verified by mango-client

  if (!ALL_MARKET_NAMES.includes(args.market)) {
    throw new Error(`${args.market} is not available`);
  }
}

async function logCurrentPosition(args: MarketOrderArgs) {
  const markets = await client.fetchAllMarkets(args.market);
  const market = markets[Object.keys(markets)[0]];
  let position;
  if (market instanceof PerpMarket) {
    const perpMarketConfig = client.mangoGroupConfig.perpMarkets.filter(
      (m) => m.publicKey.toBase58() === market.publicKey.toBase58()
    )[0];
    client.mangoAccount.reload(
      client.connection,
      client.mangoGroupConfig.serumProgramId
    );
    const perpAccount =
      client.mangoAccount.perpAccounts[perpMarketConfig.marketIndex];
    position = market.baseLotsToNumber(perpAccount.basePosition);
  } else {
    position = await client.fetchSpotPosition(args.market);
  }
  logger.info(`- current position on ${args.market} - ${position}`);
}

export async function marketOrderCommand(
  args: MarketOrderArgs
): Promise<string | undefined> {
  if (!client) {
    client = await mangoSimpleClient.create();
  }

  validate(args);

  logCurrentPosition(args);

  const priceThreshold = Number(args.priceThreshold ?? 0);

  if (priceThreshold > 0) {
    try {
      const currentPrice = await getMarketLastPrice(args.market);
      if (args.side == "buy" && currentPrice > priceThreshold) {
        logger.info(
          `current price ${currentPrice} is greater than ${args.priceThreshold}, skip buy for now`
        );
        return "";
      } else if (args.side == "sell" && currentPrice < priceThreshold) {
        logger.info(
          `current price ${currentPrice} is smaller than ${args.priceThreshold}, skip sell for now`
        );
      }
    } catch (error) {
      throw new Error(`price threshold check error: ${error}`);
    }
  }

  try {
    // Hammer to disable mango client logging
    console.log = function () {};
    const res = await client.placeOrder(
      args.market,
      args.side,
      args.amount,
      undefined,
      "market",
      undefined
    );
    return res;
  } catch (e) {
    logger.error(`Error while placing order, ${e}`);
  }
}
