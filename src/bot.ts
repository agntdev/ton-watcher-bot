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
import { mainMenuKeyboard, paginatorKeyboard } from "./keyboards";
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

const MESSAGE_MAX_CHARS = 3800;
const SUMMARY_STORE_TTL_MS = 30 * 60 * 1000;

interface MorningSummaryEntry {
  pages: string[];
  timestamp: number;
}

const morningSummaryStore = new Map<number, MorningSummaryEntry>();

export function getMorningSummaryStore(): Map<number, MorningSummaryEntry> {
  return morningSummaryStore;
}

function cleanupExpiredSummaryEntries(): void {
  const now = Date.now();
  for (const [key, entry] of morningSummaryStore) {
    if (now - entry.timestamp > SUMMARY_STORE_TTL_MS) {
      morningSummaryStore.delete(key);
    }
  }
}

function buildSummaryLine(
  symbol: string,
  priceUsd: number,
  change1h: number,
  change24h: number,
): string {
  const sign1h = change1h >= 0 ? "+" : "";
  const sign24h = change24h >= 0 ? "+" : "";
  return (
    `${symbol} \\- \\$${priceUsd.toFixed(2)} \\(${sign1h}${change1h.toFixed(1)}% 1h, ` +
    `${sign24h}${change24h.toFixed(1)}% 24h\\)`
  );
}

function splitIntoPageChunks(lines: string[], header: string): string[] {
  const pages: string[] = [];
  const headerLen = header.length;
  let currentPage = header;

  for (const line of lines) {
    const candidate = currentPage + (currentPage === header ? line : "\n" + line);
    if (candidate.length > MESSAGE_MAX_CHARS && currentPage !== header) {
      pages.push(currentPage);
      currentPage = header + line;
    } else {
      currentPage = candidate;
    }
  }
  if (currentPage !== header) {
    pages.push(currentPage);
  }
  return pages;
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
  const price = createPriceService();

  return schedule("0 8 * * *", async () => {
    const userIds = await getEnabledUserIds();
    const now = new Date();

    cleanupExpiredSummaryEntries();

    for (const userId of userIds) {
      try {
        const qh = await db.getQuietHours(userId);
        if (qh && isInQuietHours(now, qh.start_time, qh.end_time)) {
          continue;
        }

        const watchlist = await db.getWatchlist(userId);
        if (watchlist.length === 0) {
          continue;
        }

        const symbols = watchlist.map((e) => e.coin_symbol);
        const dateStr = now.toISOString().slice(0, 10);
        const timeStr = now.toISOString().slice(11, 16);
        const header =
          `🌅 *Morning Summary — ${dateStr} ${timeStr} UTC*\n\n`;

        let priceMap: Map<string, { price: number; change1h: number; change24h: number }>;
        try {
          const rawPrices = await price.getPrices(symbols);
          priceMap = new Map();
          for (const [sym, data] of rawPrices) {
            priceMap.set(sym, {
              price: data.price_usd,
              change1h: data.change_1h_pct,
              change24h: data.change_24h_pct,
            });
          }
        } catch {
          priceMap = new Map();
        }

        const lines: string[] = [];
        const unavailable: string[] = [];
        for (const symbol of symbols) {
          const pd = priceMap.get(symbol);
          if (pd) {
            lines.push(buildSummaryLine(symbol, pd.price, pd.change1h, pd.change24h));
          } else {
            unavailable.push(symbol);
          }
        }

        if (unavailable.length > 0) {
          lines.push(
            `\\[${unavailable.join(", ")} \\- data unavailable\\]`,
          );
        }

        const pages = splitIntoPageChunks(lines, header);

        if (pages.length === 1) {
          await bot.api.sendMessage(userId, pages[0], { parse_mode: "Markdown" });
        } else {
          morningSummaryStore.set(userId, { pages, timestamp: Date.now() });
          await bot.api.sendMessage(userId, pages[0], {
            parse_mode: "Markdown",
            reply_markup: paginatorKeyboard(0, pages.length, "morning_summary"),
          });
        }
      } catch (err) {
        console.error(`Failed to send morning summary to user ${userId}:`, err);
      }
    }
  }, {
    scheduled: false,
    timezone: "UTC",
  });
}
