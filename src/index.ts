import { createBot, startScheduler } from "./bot";
import { startAlertChecker } from "./alerts";

async function main() {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.error("BOT_TOKEN environment variable is required");
    process.exit(1);
  }

  const { bot, db } = createBot(token);

  const scheduler = startScheduler(bot, async () => {
    return db.getUsersWithSummaryEnabled();
  }, db);

  scheduler.start();

  const alertChecker = startAlertChecker(bot, db);
  alertChecker.start();

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
