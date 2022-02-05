import axios from "axios";
import { getAllMarkets } from "@blockworks-foundation/mango-client";
import { MANGO_GROUP_CONFIG } from "./constants";

export async function getMarketLastPrice(market: string) {
  const marketPk = getAllMarkets(MANGO_GROUP_CONFIG).filter(
    (marketConfig) => marketConfig.name === market
  )[0].publicKey;
  const tradesResponse = await axios.get(
    `https://event-history-api-candles.herokuapp.com/trades/address/${marketPk.toBase58()}`
  );
  const parsedTradesResponse = (await tradesResponse.data) as any;
  return "s" in parsedTradesResponse && parsedTradesResponse["s"] === "error"
    ? null
    : parsedTradesResponse["data"][0]["price"];
}
