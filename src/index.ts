import { MangoClient } from "@blockworks-foundation/mango-client";
import Duration from "@icholy/duration";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { Command } from "commander";
import "dotenv/config";
import { cancelCommand } from "./commands/cancelOrder";
import { orderCommand } from "./commands/order";
import { ENV } from "./constants";
import { logger } from "./logger";

const cli = new Command();

cli.version("1.0.0");

cli
  .command("cancel")
  .description("order")
  .requiredOption("--market <market>")
  .action(
    async (options: {
      market: string; //todo validation
    }) => {
      logger.info(
        `using wallet ${
          Keypair.fromSecretKey(bs58.decode(ENV.PRIVATE_KEY_BASE58)).publicKey
        }`
      );

      logger.info(`cancelling orders on ${options.market}`);

      const cancelOrder = () => {
        cancelCommand(options)
          .catch((error) => {
            logger.error(`- order failed: ${error}`);
            process.exit();
          })
          .then(() => {
            process.exit();
          });
      };

      cancelOrder();
    }
  );

cli
  .command("twap")
  .description("order")
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
          Keypair.fromSecretKey(bs58.decode(ENV.PRIVATE_KEY_BASE58)).publicKey
        }`
      );

      logger.info(
        `twap ${options.side} of ${options.amount} on ${options.market} every ${options.interval} ready`
      );

      const runOrder = () => {
        logger.info(`order starting...`);
        orderCommand(options)
          .then((txId) => {
            if (txId) {
              logger.info(`- placed order successfully: tx id - ${txId}`);
            }
          })
          .catch((error) => {
            logger.error(`- order failed: ${error}`);
          });
      };

      // Do a first market order at start-up
      runOrder();
      setInterval(runOrder, new Duration(options.interval).milliseconds());
    }
  );

cli.parse(process.argv);
cli.showHelpAfterError();
