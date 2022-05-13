import mangoSimpleClient from "../mango.simple.client";
import MangoSimpleClient from "../mango.simple.client";
import { getMarketLastPrice } from "../eventHistoryApi";
import { logger } from "../logger";
import { ALL_MARKET_NAMES } from "../constants";
import { PerpMarket } from "@blockworks-foundation/mango-client";
import { cli } from "winston/lib/winston/config";

interface OrderArgs {
  market: string;
  side: "buy" | "sell";
  amount: number;
  priceThreshold?: string;
}

let client: MangoSimpleClient;

export function validate(args: OrderArgs) {
  // size is verified by mango-client

  if (!ALL_MARKET_NAMES.includes(args.market)) {
    throw new Error(`${args.market} is not available`);
  }
}

async function logCurrentPosition(args: OrderArgs) {
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

export async function cancelAllExistingOrders(args: OrderArgs) {
  if (!client) {
    client = await mangoSimpleClient.create();
  }
  logger.info(`- cancelling all existing orders on ${args.market}`);
  await client.cancelAllOrders(args.market);
}

export async function orderCommand(
  args: OrderArgs
): Promise<string | undefined> {
  if (!client) {
    client = await mangoSimpleClient.create();
  }

  validate(args);

  logCurrentPosition(args);

  try {
    await cancelAllExistingOrders(args);
  } catch (error) {
    logger.error(`- order failed: ${error}`);
  }

  const priceThreshold = Number(args.priceThreshold ?? 0);
  const currentPrice = await getMarketLastPrice(args.market);
  logger.info(`- last trade on ${args.market} was at price ${currentPrice}`);

  const orders = await client.getMidPrice(args.market);
  const bid = orders[0];
  const ask = orders[1];
  const midPrice = (bid.order.price + ask.order.price) / 2;
  logger.info(
    `- best bid on ${args.market} was at price ${bid.order.price}, best ask at price ${ask.order.price}`
  );

  if (priceThreshold > 0) {
    try {
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
    logger.info(
      `- placing a ${args.side} post only order at midprice ${midPrice} of size ${args.amount} on ${args.market}`
    );
    const res = await client.placeOrder(
      args.market,
      args.side,
      args.amount,
      midPrice,
      "postOnly",
      undefined
    );
    return res;
  } catch (e) {
    logger.error(`Error while placing order, ${e}`);
  }
}
