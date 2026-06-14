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
import { type DbService } from "./types";
import { createAuthService } from "./auth";
import { createDbService } from "./db";
import { createPriceService } from "./price";

function isInQuietHours(now: Date, startTime: string, endTime: string): boolean {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;
  const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }
  return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
}

function initialSession(): SessionData {
  return {};
}

export function createBot(token: string): { bot: Bot<MyContext>; db: DbService } {
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

  const db = createDbService();
  const price = createPriceService();

  bot.use(async (ctx, next) => {
    ctx.db = db;
    ctx.price = price;
    if (ctx.from) {
      const user = await db.getUser(ctx.from.id);
      if (!user) {
        await db.createUser(ctx.from.id);
      }
    }
    await next();
  });

  const FLOW_TIMEOUT_MS = 5 * 60 * 1000;

  bot.use(async (ctx, next) => {
    const { step, flowStartedAt } = ctx.session;
    if (step && flowStartedAt && Date.now() - flowStartedAt > FLOW_TIMEOUT_MS) {
      ctx.session.step = undefined;
      ctx.session.coin = undefined;
      ctx.session.flowStartedAt = undefined;
      ctx.session.startTime = undefined;
      ctx.session.endTime = undefined;
      ctx.session.thresholdType = undefined;
      ctx.session.thresholdValue = undefined;
      try {
        await ctx.conversation.exit();
      } catch {
        // no active conversation
      }
      await ctx.reply(
        "Your session has timed out after 5 minutes of inactivity. Returning to main menu.",
        { reply_markup: mainMenuKeyboard() },
      );
      return;
    }
    await next();
  });

  const auth = createAuthService();

  bot.use(async (ctx, next) => {
    const callbackData = ctx.callbackQuery?.data;
    const isOwnerCallback =
      callbackData === "menu:owner" ||
      callbackData === "owner:alerts" ||
      callbackData === "owner:users";

    const isOwnerCommand =
      !ctx.callbackQuery &&
      ctx.message !== undefined &&
      "text" in ctx.message &&
      ctx.message.text === "/owner";

    if ((isOwnerCommand || isOwnerCallback) && ctx.from) {
      const isOwner = await auth.isOwner(ctx.from.id);
      if (!isOwner) {
        if (isOwnerCallback) {
          await ctx.answerCallbackQuery({
            text: "You don't have access to the owner dashboard.",
          });
        } else {
          await ctx.reply("You don't have access to the owner dashboard.", {
            reply_markup: mainMenuKeyboard(),
          });
        }
        return;
      }
    }
    await next();
  });

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

  return { bot, db };
}

export function startScheduler(
  bot: Bot<MyContext>,
  getEnabledUserIds: () => Promise<number[]>,
  db: DbService,
): ScheduledTask {
  return schedule("0 8 * * *", async () => {
    const userIds = await getEnabledUserIds();
    const now = new Date();
    for (const userId of userIds) {
      try {
        const qh = await db.getQuietHours(userId);
        if (qh && isInQuietHours(now, qh.start_time, qh.end_time)) {
          continue;
        }
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
