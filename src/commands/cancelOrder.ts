import mangoSimpleClient from "../mango.simple.client";
import MangoSimpleClient from "../mango.simple.client";
import { getMarketLastPrice } from "../eventHistoryApi";
import { logger } from "../logger";
import { ALL_MARKET_NAMES } from "../constants";
import { PerpMarket } from "@blockworks-foundation/mango-client";

interface CancelOrderArgs {
  market: string;
}

let client: MangoSimpleClient;

export function validate(args: CancelOrderArgs) {
  // size is verified by mango-client

  if (!ALL_MARKET_NAMES.includes(args.market)) {
    throw new Error(`${args.market} is not available`);
  }
}

export async function cancelAllExistingOrders(args: CancelOrderArgs) {
  if (!client) {
    client = await mangoSimpleClient.create();
  }
  logger.info(`- cancelling all existing orders on ${args.market}`);
  await client.cancelAllOrders(args.market);
}

export async function cancelCommand(args: CancelOrderArgs): Promise<void> {
  if (!client) {
    client = await mangoSimpleClient.create();
  }

  validate(args);

  await cancelAllExistingOrders(args);
}
