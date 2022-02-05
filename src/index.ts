import "dotenv/config";
import Duration from "@icholy/duration";
import { Command } from "commander";

import { marketOrderCommand } from "./commands/marketOrder";
import { logger } from "./logger";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { ENV } from "./constants";

const cli = new Command();

cli.version("1.0.0");

cli
  .command("twap")
  .description("market order")
  .requiredOption("--interval <interval>")
  .requiredOption("--market <market>")
  .requiredOption("--side <side>")
  .requiredOption("--amount <amount>")
  .option("--transferAddress <transferAddress>")
  .option("--transferThreshold <transferThreshold>")
  .option("--priceThreshold <priceThreshold>")
  .option("--dryRun", "dry run", false)
  .action(
    async (options: {
      interval: string;
      market: string; //todo validation
      side: "buy" | "sell"; //todo enum
      amount: number; //todo validation
      transferAddress?: string; // todo unused
      transferThreshold?: string; // todo unused
      priceThreshold?: string;
      dryRun: boolean;
    }) => {
      logger.info(
        `using wallet ${
          Keypair.fromSecretKey(bs58.decode(ENV.walletPK)).publicKey
        }`
      );

      logger.info(
        `twap ${options.side} of ${options.amount} on ${options.market} every ${options.interval} ready`
      );

      const runMarketOrder = () => {
        logger.info(`market order starting...`);
        marketOrderCommand(options)
          .then((txId) => {
            if (txId) {
              logger.info(`- market order success: ${txId}`);
            }
          })
          .catch((error) => {
            logger.error(`- market order failed: ${error}`);
          });
      };

      // Do a first market order at start-up
      runMarketOrder();
      setInterval(
        runMarketOrder,
        new Duration(options.interval).milliseconds()
      );
    }
  );

cli.parse(process.argv);
cli.showHelpAfterError();
