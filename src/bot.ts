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
import { createAuthService } from "./auth";
import { createDbService } from "./db";
import { createPriceService } from "./price";
import { type PriceData, type CoinSymbol, type AlertThreshold, type DbService, type PriceService } from "./types";

function initialSession(): SessionData {
  return {};
}

export function createBot(token: string): { bot: Bot<MyContext>; db: DbService; price: PriceService } {
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

  return { bot, db, price };
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

const CONSOLIDATION_WINDOW_MS = 60 * 60 * 1000;

function isInQuietHours(
  quietHours: { start_time: string; end_time: string } | null,
): boolean {
  if (!quietHours) return false;
  const now = new Date();
  const [startH, startM] = quietHours.start_time.split(":").map(Number);
  const [endH, endM] = quietHours.end_time.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  if (startMinutes <= endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
  }
  return nowMinutes >= startMinutes || nowMinutes <= endMinutes;
}

async function checkThreshold(
  threshold: AlertThreshold,
  priceData: PriceData,
  db: DbService,
  bot: Bot<MyContext>,
): Promise<void> {
  const now = Date.now();
  const timeSinceLastAlert = now - threshold.last_alert_time;

  if (timeSinceLastAlert < CONSOLIDATION_WINDOW_MS && threshold.last_alert_time > 0) {
    const currentPrice = priceData.price_usd;
    if (threshold.threshold_type === "price_below" || threshold.threshold_type === "price_above") {
      const thresholdPrice = threshold.value;
      const deviation = Math.abs(currentPrice - thresholdPrice) / thresholdPrice;
      if (deviation < 0.05) {
        return;
      }
    }
  }

  const quietHours = await db.getQuietHours(threshold.user_id);
  if (isInQuietHours(quietHours)) return;

  let triggered = false;
  let alertDescription = "";

  if (threshold.threshold_type === "price_below") {
    if (priceData.price_usd < threshold.value) {
      triggered = true;
      alertDescription = `below $${threshold.value.toFixed(2)}`;
    }
  } else if (threshold.threshold_type === "price_above") {
    if (priceData.price_usd > threshold.value) {
      triggered = true;
      alertDescription = `above $${threshold.value.toFixed(2)}`;
    }
  } else if (threshold.threshold_type === "percent_change") {
    const change = threshold.timeframe === "1h"
      ? priceData.change_1h_pct
      : priceData.change_24h_pct;

    if (threshold.value >= 0 && change >= threshold.value) {
      triggered = true;
      alertDescription = `up ${threshold.value}% in ${threshold.timeframe}`;
    } else if (threshold.value < 0 && change <= threshold.value) {
      triggered = true;
      alertDescription = `down ${Math.abs(threshold.value)}% in ${threshold.timeframe}`;
    }
  }

  if (triggered) {
    await db.updateLastAlertTime(
      threshold.user_id,
      threshold.coin_symbol,
      threshold.threshold_type,
      now,
    );

    await db.addAlertHistory({
      user_id: threshold.user_id,
      coin_symbol: threshold.coin_symbol,
      triggered_at: Math.floor(now / 1000),
      price: priceData.price_usd,
      change_percent: priceData.change_1h_pct,
    });

    const change1h = priceData.change_1h_pct >= 0
      ? `+${priceData.change_1h_pct.toFixed(1)}%`
      : `${priceData.change_1h_pct.toFixed(1)}%`;
    const change24h = priceData.change_24h_pct >= 0
      ? `+${priceData.change_24h_pct.toFixed(1)}%`
      : `${priceData.change_24h_pct.toFixed(1)}%`;

    try {
      await bot.api.sendMessage(
        threshold.user_id,
        `⚠️ Alert: ${threshold.coin_symbol} ${alertDescription}!\n` +
          `Current price: $${priceData.price_usd.toFixed(2)}\n` +
          `Change: ${change1h} in 1h, ${change24h} in 24h`,
        { reply_markup: { inline_keyboard: [[{ text: "Dismiss", callback_data: "alert:dismiss" }]] } },
      );
    } catch (err) {
      console.error(`Failed to send alert to user ${threshold.user_id}:`, err);
    }
  }
}

export function startThresholdChecker(
  bot: Bot<MyContext>,
  db: DbService,
  price: PriceService,
): ScheduledTask {
  return schedule("*/5 * * * *", async () => {
    try {
      const allThresholds = await db.getAllThresholds();
      if (allThresholds.length === 0) return;

      const uniqueCoins = new Set(allThresholds.map((t) => t.coin_symbol));
      const priceMap = await price.getPrices([...uniqueCoins]);

      for (const threshold of allThresholds) {
        const priceData = priceMap.get(threshold.coin_symbol);
        if (!priceData) continue;
        await checkThreshold(threshold, priceData, db, bot);
      }
    } catch (err) {
      console.error("Threshold checker error:", err);
    }
  }, {
    scheduled: false,
    timezone: "UTC",
  });
}
