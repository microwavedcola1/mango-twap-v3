import {
  MarketConfig,
  PerpMarket,
  PerpOrder,
} from "@blockworks-foundation/mango-client";
import { Market } from "@project-serum/serum";
import { Order } from "@project-serum/serum/lib/market";

export type OrderInfo = {
  order: Order | PerpOrder;
  market: { account: Market | PerpMarket; config: MarketConfig };
};
