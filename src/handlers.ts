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
  backToOwnerKeyboard,
  cancelKeyboard,
  paginatorKeyboard,
} from "./keyboards";
import { getMorningSummaryStore } from "./bot";

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
  if (!ctx.from) return;
  const user = await ctx.db.getUser(ctx.from.id);
  const enabled = user?.summary_enabled ?? false;
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
  const qh = ctx.from ? await ctx.db.getQuietHours(ctx.from.id) : null;
  if (qh) {
    await ctx.reply(
      `Current quiet hours: ${qh.start_time} to ${qh.end_time}\nWould you like to update them?`,
      { reply_markup: setQuietHoursKeyboard() },
    );
  } else {
    await ctx.reply("Would you like to set your quiet hours?", {
      reply_markup: setQuietHoursKeyboard(),
    });
  }
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
    ctx.session.flowStartedAt = Date.now();
    await ctx.conversation.enter("quietHoursSetup");
    await ctx.answerCallbackQuery();
    return;
  }

  if (data === "summary:enable") {
    if (!ctx.from) return;
    await ctx.db.updateUser(ctx.from.id, { summary_enabled: true });
    await ctx.reply("Morning Summary enabled! You'll receive daily updates at 08:00 UTC.", {
      reply_markup: mainMenuKeyboard(),
    });
    await ctx.answerCallbackQuery();
    return;
  }

  if (data === "summary:disable") {
    if (!ctx.from) return;
    await ctx.db.updateUser(ctx.from.id, { summary_enabled: false });
    await ctx.reply("Morning Summary disabled.", {
      reply_markup: mainMenuKeyboard(),
    });
    await ctx.answerCallbackQuery();
    return;
  }

  if (data === "owner:alerts") {
    const allAlerts = await ctx.db.getTopAlerts(20);
    const totalAlerts = (await ctx.db.getTopAlerts()).length;

    if (allAlerts.length === 0) {
      await ctx.reply("📊 **Alert Stats**\n\nNo alerts have been triggered yet.", {
        parse_mode: "Markdown",
        reply_markup: backToOwnerKeyboard(),
      });
    } else {
      const lines = allAlerts.map((a) => {
        const date = new Date(a.triggered_at * 1000).toISOString().slice(0, 16).replace("T", " ");
        return `• ${a.coin_symbol} — $${a.price.toFixed(2)} (${a.change_percent >= 0 ? "+" : ""}${a.change_percent.toFixed(2)}%) — User ${a.user_id} — ${date}`;
      });
      await ctx.reply(
        `📊 **Alert Stats**\n\nTotal alerts: ${totalAlerts}\nRecent (last 20):\n\n${lines.join("\n")}`,
        { parse_mode: "Markdown", reply_markup: backToOwnerKeyboard() },
      );
    }
    await ctx.answerCallbackQuery();
    return;
  }

  if (data === "owner:users") {
    const totalUsers = await ctx.db.getTotalUsers();
    const recentAlerts = await ctx.db.getTopAlerts(10);

    if (totalUsers === 0) {
      await ctx.reply("👥 **User Activity**\n\nNo users registered yet.", {
        parse_mode: "Markdown",
        reply_markup: backToOwnerKeyboard(),
      });
    } else if (recentAlerts.length === 0) {
      await ctx.reply(
        `👥 **User Activity**\n\nTotal users: ${totalUsers}\nNo recent activity.`,
        { parse_mode: "Markdown", reply_markup: backToOwnerKeyboard() },
      );
    } else {
      const lines = recentAlerts.map((a) => {
        const date = new Date(a.triggered_at * 1000).toISOString().slice(0, 16).replace("T", " ");
        return `• User ${a.user_id} — ${a.coin_symbol} alert at $${a.price.toFixed(2)} — ${date}`;
      });
      await ctx.reply(
        `👥 **User Activity**\n\nTotal users: ${totalUsers}\nRecent activity:\n\n${lines.join("\n")}`,
        { parse_mode: "Markdown", reply_markup: backToOwnerKeyboard() },
      );
    }
    await ctx.answerCallbackQuery();
    return;
  }

  if (data.startsWith("morning_summary:page:")) {
    const page = parseInt(data.split(":")[2], 10);
    if (!ctx.from) return;
    const store = getMorningSummaryStore();
    const entry = store.get(ctx.from.id);
    if (!entry || entry.pages.length === 0) {
      await ctx.answerCallbackQuery({ text: "Summary data is no longer available." });
      return;
    }
    if (page < 0 || page >= entry.pages.length) {
      await ctx.answerCallbackQuery({ text: "Invalid page." });
      return;
    }
    await ctx.editMessageText(entry.pages[page], {
      reply_markup: paginatorKeyboard(page, entry.pages.length, "morning_summary"),
      parse_mode: "Markdown",
    });
    await ctx.answerCallbackQuery();
    return;
  }

  if (data === "alert:dismiss") {
    await ctx.answerCallbackQuery({ text: "Alert dismissed" });
    return;
  }
}
