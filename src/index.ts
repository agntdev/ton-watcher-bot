import { createBot, startScheduler, startThresholdChecker } from "./bot";

async function main() {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.error("BOT_TOKEN environment variable is required");
    process.exit(1);
  }

  const { bot, db, price } = createBot(token);

  const scheduler = startScheduler(bot, async () => {
    return [];
  });

  scheduler.start();

  const thresholdChecker = startThresholdChecker(bot, db, price);
  thresholdChecker.start();

  await bot.start({
    onStart(botInfo) {
      console.log(`Bot @${botInfo.username} started`);
    },
  });
}

main().catch((err) => {
  console.error("Failed to start bot:", err);
  process.exit(1);
});
