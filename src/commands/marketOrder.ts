import mangoSimpleClient from "../mango.simple.client";
import MangoSimpleClient from "../mango.simple.client";
import { getMarketLastPrice } from "../eventHistoryApi";
import { logger } from "../logger";
import {ALL_MARKET_NAMES, MANGO_GROUP_CONFIG} from "../constants";
import {getAllMarkets, PerpMarket} from "@blockworks-foundation/mango-client";
import {Market} from "@project-serum/serum";
import Big from "big.js";

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

export async function marketOrderCommand(
    args: MarketOrderArgs
): Promise<string | undefined> {
  if (!client) {
    client = await mangoSimpleClient.create();
  }

  validate(args)

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
    logger.info("- --mango-client internal logging start--");
    const res = await client.placeOrder(
      args.market,
      args.side,
      args.amount,
      undefined,
      "market",
      undefined
    );
    logger.info("- --mango-client internal logging end--");
    return res;
  } catch (e) {
    logger.error(`Error while placing order, ${e}`);
  }
}
