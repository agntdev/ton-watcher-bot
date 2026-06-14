import { type MyContext } from "./session";
import {
  mainMenuKeyboard,
  watchlistManagementKeyboard,
  watchlistAddCoinKeyboard,
  watchlistItemsKeyboard,
  morningSummaryToggleKeyboard,
  ownerDashboardKeyboard,
  setQuietHoursKeyboard,
  backToMainKeyboard,
  cancelKeyboard,
} from "./keyboards";

const WELCOME_TEXT =
  "Hi! I'm your TON crypto watcher." +
  " Use /watchlist to track coins, /thresholds to set alerts," +
  " and /summary to get daily updates." +
  " Type /help for all commands!";

const HELP_TEXT =
  "📋 **Commands:**\n" +
  "/start — Show main menu\n" +
  "/help — Show this help\n" +
  "/watchlist — Manage your watchlist\n" +
  "/thresholds — Set price alerts\n" +
  "/price — Check current price\n" +
  "/summary — Toggle morning summary\n" +
  "/quiet — Set quiet hours\n" +
  "/cancel — Cancel current operation\n" +
  "/owner — Owner dashboard (admin only)";

export async function startHandler(ctx: MyContext): Promise<void> {
  ctx.session.step = undefined;
  ctx.session.coin = undefined;
  ctx.session.flowStartedAt = undefined;
  await ctx.reply(WELCOME_TEXT, { reply_markup: mainMenuKeyboard() });
}

export async function helpHandler(ctx: MyContext): Promise<void> {
  ctx.session.step = undefined;
  ctx.session.flowStartedAt = undefined;
  await ctx.reply(HELP_TEXT, {
    parse_mode: "Markdown",
    reply_markup: mainMenuKeyboard(),
  });
}

export async function watchlistHandler(ctx: MyContext): Promise<void> {
  ctx.session.step = undefined;
  ctx.session.flowStartedAt = undefined;
  await ctx.reply("Choose an action:", {
    reply_markup: watchlistManagementKeyboard(),
  });
}

export async function thresholdsHandler(ctx: MyContext): Promise<void> {
  ctx.session.step = "threshold_coin";
  ctx.session.coin = undefined;
  ctx.session.flowStartedAt = Date.now();
  await ctx.reply("Which coin would you like to set a threshold for? (e.g., TON, USDT)", {
    reply_markup: cancelKeyboard(),
  });
}

export async function priceHandler(ctx: MyContext): Promise<void> {
  ctx.session.step = "price_request";
  ctx.session.flowStartedAt = Date.now();
  await ctx.reply("Enter the coin symbol to check its price (e.g., TON, USDT):", {
    reply_markup: cancelKeyboard(),
  });
}

export async function summaryHandler(ctx: MyContext): Promise<void> {
  ctx.session.step = undefined;
  ctx.session.flowStartedAt = undefined;
  // Default to enabled state — actual state should come from DB
  const enabled = false;
  const status = enabled ? "Enabled" : "Disabled";
  const action = enabled ? "Disable" : "Enable";
  await ctx.reply(
    `Morning Summary is currently **${status}**.\nWould you like to **${action}** it?`,
    {
      parse_mode: "Markdown",
      reply_markup: morningSummaryToggleKeyboard(enabled),
    },
  );
}

export async function quietHandler(ctx: MyContext): Promise<void> {
  ctx.session.step = undefined;
  ctx.session.flowStartedAt = undefined;
  await ctx.reply("Would you like to set your quiet hours?", {
    reply_markup: setQuietHoursKeyboard(),
  });
}

export async function ownerHandler(ctx: MyContext): Promise<void> {
  ctx.session.step = undefined;
  ctx.session.flowStartedAt = undefined;
  // Access check delegated to AuthService via middleware
  await ctx.reply("📊 **Owner Dashboard**", {
    parse_mode: "Markdown",
    reply_markup: ownerDashboardKeyboard(),
  });
}

export async function cancelHandler(ctx: MyContext): Promise<void> {
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
  await ctx.reply(WELCOME_TEXT, { reply_markup: mainMenuKeyboard() });
}

export async function callbackQueryHandler(ctx: MyContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  if (data === "nav:main") {
    await cancelHandler(ctx);
    return;
  }

  if (data === "menu:watchlist") {
    await ctx.reply("Choose an action:", {
      reply_markup: watchlistManagementKeyboard(),
    });
    await ctx.answerCallbackQuery();
    return;
  }

  if (data === "menu:price") {
    await priceHandler(ctx);
    await ctx.answerCallbackQuery();
    return;
  }

  if (data === "menu:thresholds") {
    await thresholdsHandler(ctx);
    await ctx.answerCallbackQuery();
    return;
  }

  if (data === "menu:quiet") {
    await quietHandler(ctx);
    await ctx.answerCallbackQuery();
    return;
  }

  if (data === "menu:summary") {
    await summaryHandler(ctx);
    await ctx.answerCallbackQuery();
    return;
  }

  if (data === "menu:owner") {
    await ownerHandler(ctx);
    await ctx.answerCallbackQuery();
    return;
  }

  if (data === "watchlist:add") {
    await ctx.reply("Select a coin to add to your watchlist:", {
      reply_markup: watchlistAddCoinKeyboard(),
    });
    await ctx.answerCallbackQuery();
    return;
  }

  if (data.startsWith("watchlist:add:")) {
    const coin = data.split(":")[2] as "TON" | "USDT" | "GRAM";
    if (!ctx.from) return;
    const watchlist = await ctx.db.getWatchlist(ctx.from.id);
    if (watchlist.some((e) => e.coin_symbol === coin)) {
      await ctx.reply(`${coin} is already in your watchlist.`, {
        reply_markup: watchlistManagementKeyboard(),
      });
    } else {
      await ctx.db.addToWatchlist(ctx.from.id, coin);
      await ctx.reply(`${coin} added to your watchlist.`, {
        reply_markup: watchlistManagementKeyboard(),
      });
    }
    await ctx.answerCallbackQuery();
    return;
  }

  if (data === "watchlist:view") {
    if (!ctx.from) return;
    const watchlist = await ctx.db.getWatchlist(ctx.from.id);
    if (watchlist.length === 0) {
      await ctx.reply(
        "Your watchlist is empty. Use Add Coin to start tracking.",
        { reply_markup: watchlistManagementKeyboard() },
      );
    } else {
      const coins = watchlist.map((e) => e.coin_symbol);
      await ctx.reply("Your watchlist:", {
        reply_markup: watchlistItemsKeyboard(coins),
      });
    }
    await ctx.answerCallbackQuery();
    return;
  }

  if (data.startsWith("watchlist:remove:")) {
    const coin = data.split(":")[2] as "TON" | "USDT" | "GRAM";
    if (!ctx.from) return;
    await ctx.db.removeFromWatchlist(ctx.from.id, coin);
    const watchlist = await ctx.db.getWatchlist(ctx.from.id);
    if (watchlist.length === 0) {
      await ctx.reply(
        `${coin} removed. Your watchlist is now empty.`,
        { reply_markup: watchlistManagementKeyboard() },
      );
    } else {
      const coins = watchlist.map((e) => e.coin_symbol);
      await ctx.reply(
        `${coin} removed from watchlist.`,
        { reply_markup: watchlistItemsKeyboard(coins) },
      );
    }
    await ctx.answerCallbackQuery();
    return;
  }

  if (data.startsWith("threshold:coin:")) {
    const coin = data.split(":")[2];
    ctx.session.coin = coin as "TON" | "USDT" | "GRAM";
    ctx.session.step = "threshold_value";
    ctx.session.flowStartedAt = Date.now();
    await ctx.reply(
      `Set a threshold for ${coin}. Example formats:\n- "below $2.50"\n- "+5% in 1h"\n- "-10% in 24h"`,
      { reply_markup: cancelKeyboard() },
    );
    await ctx.answerCallbackQuery();
    return;
  }

  if (data === "quiet:set") {
    ctx.session.step = "quiet_start";
    ctx.session.flowStartedAt = Date.now();
    await ctx.reply("Enter start time (24h format, e.g., 22:00):", {
      reply_markup: { inline_keyboard: [[{ text: "Cancel", callback_data: "nav:main" }]] },
    });
    await ctx.answerCallbackQuery();
    return;
  }

  if (data === "quiet:confirm") {
    await ctx.reply(
      `Quiet hours saved: ${ctx.session.startTime || "N/A"} to ${ctx.session.endTime || "N/A"}`,
      { reply_markup: mainMenuKeyboard() },
    );
    ctx.session.step = undefined;
    ctx.session.flowStartedAt = undefined;
    ctx.session.startTime = undefined;
    ctx.session.endTime = undefined;
    await ctx.answerCallbackQuery();
    return;
  }

  if (data === "summary:enable") {
    await ctx.reply("Morning Summary enabled! You'll receive daily updates at 08:00 UTC.", {
      reply_markup: mainMenuKeyboard(),
    });
    await ctx.answerCallbackQuery();
    return;
  }

  if (data === "summary:disable") {
    await ctx.reply("Morning Summary disabled.", {
      reply_markup: mainMenuKeyboard(),
    });
    await ctx.answerCallbackQuery();
    return;
  }

  if (data === "owner:alerts") {
    await ctx.reply(
      "Alert stats will be shown here once the owner dashboard is fully implemented.",
      { reply_markup: backToMainKeyboard() },
    );
    await ctx.answerCallbackQuery();
    return;
  }

  if (data === "owner:users") {
    await ctx.reply(
      "User activity will be shown here once the owner dashboard is fully implemented.",
      { reply_markup: backToMainKeyboard() },
    );
    await ctx.answerCallbackQuery();
    return;
  }

  if (data === "alert:dismiss") {
    await ctx.answerCallbackQuery({ text: "Alert dismissed" });
    return;
  }
}
