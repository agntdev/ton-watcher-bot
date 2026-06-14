import { Bot, session } from "grammy";
import { conversations, createConversation } from "@grammyjs/conversations";
import { schedule, type ScheduledTask } from "node-cron";
import { type MyContext, type SessionData } from "./session";
import {
  startHandler,
  helpHandler,
  watchlistHandler,
  thresholdsHandler,
  priceHandler,
  summaryHandler,
  quietHandler,
  ownerHandler,
  cancelHandler,
  callbackQueryHandler,
} from "./handlers";
import {
  thresholdSetupConversation,
  quietHoursSetupConversation,
  priceRequestConversation,
} from "./conversations";
import { mainMenuKeyboard } from "./keyboards";

function initialSession(): SessionData {
  return {};
}

export function createBot(token: string): Bot<MyContext> {
  const bot = new Bot<MyContext>(token);

  bot.use(
    session({
      initial: initialSession,
    }),
  );

  bot.use(conversations<MyContext>());

  bot.use(createConversation(thresholdSetupConversation, "thresholdSetup"));
  bot.use(createConversation(quietHoursSetupConversation, "quietHoursSetup"));
  bot.use(createConversation(priceRequestConversation, "priceRequest"));

  bot.command("start", startHandler);
  bot.command("help", helpHandler);
  bot.command("watchlist", watchlistHandler);
  bot.command("thresholds", thresholdsHandler);
  bot.command("price", priceHandler);
  bot.command("summary", summaryHandler);
  bot.command("quiet", quietHandler);
  bot.command("owner", ownerHandler);
  bot.command("cancel", cancelHandler);

  bot.on("callback_query:data", callbackQueryHandler);

  bot.catch((err) => {
    console.error("Bot error:", err.error);
    err.ctx.reply("An unexpected error occurred. Please try again.", {
      reply_markup: mainMenuKeyboard(),
    }).catch(() => {});
  });

  // Fallback for unhandled text messages
  bot.on("message:text", async (ctx) => {
    await ctx.reply("Invalid command. Use /help for options.", {
      reply_markup: mainMenuKeyboard(),
    });
  });

  return bot;
}

export function startScheduler(
  bot: Bot<MyContext>,
  getEnabledUserIds: () => Promise<number[]>,
): ScheduledTask {
  return schedule("0 8 * * *", async () => {
    const userIds = await getEnabledUserIds();
    for (const userId of userIds) {
      try {
        await bot.api.sendMessage(
          userId,
          "🌅 Morning Summary will be generated here once all services are integrated.",
        );
      } catch (err) {
        console.error(`Failed to send morning summary to user ${userId}:`, err);
      }
    }
  }, {
    scheduled: false,
    timezone: "UTC",
  });
}
