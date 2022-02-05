import { Config, GroupConfig } from "@blockworks-foundation/mango-client";

export const ENV = {
  rpcURL: process.env.RPC_URL ?? "",
  walletPK: process.env.WALLET_PK ?? "",
  GROUP: process.env.GROUP ?? "",
  MANGO_ACCOUNT: process.env.MANGO_ACCOUNT ?? "",
};

// Hardcode since offchain data is only maintained for mainnet
// (though testing is done on devnet)
// and market names are same for devnet and mainnet
const groupName = "mainnet.1";
export const MANGO_GROUP_CONFIG: GroupConfig = Config.ids().groups.filter(
  (group) => group.name === groupName
)[0];

export const ALL_MARKET_NAMES = MANGO_GROUP_CONFIG.spotMarkets
  .map((spotMarketConfig) => spotMarketConfig.name)
  .concat(
    MANGO_GROUP_CONFIG.perpMarkets.map(
      (perpMarketConfig) => perpMarketConfig.name
    )
  );
