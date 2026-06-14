import { type ConversationFn } from "@grammyjs/conversations";
import { type MyContext } from "./session";
import { SUPPORTED_COINS, type CoinSymbol, type ThresholdType } from "./types";
import {
  cancelKeyboard,
  mainMenuKeyboard,
  quietHoursConfirmationKeyboard,
  backToMainKeyboard,
} from "./keyboards";

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const PRICE_BELOW_REGEX = /below\s+\$?(\d+(?:\.\d+)?)/i;
const PRICE_ABOVE_REGEX = /above\s+\$?(\d+(?:\.\d+)?)/i;
const PERCENT_REGEX = /([+-]?\d+(?:\.\d+)?)\s*%\s*(?:in\s+)?(1h|24h)/i;

function parseThreshold(
  text: string,
): { thresholdType: ThresholdType; value: number; timeframe?: "1h" | "24h" } | null {
  let match: RegExpMatchArray | null;

  match = text.match(PRICE_BELOW_REGEX);
  if (match) {
    return { thresholdType: "price_below", value: parseFloat(match[1]) };
  }

  match = text.match(PRICE_ABOVE_REGEX);
  if (match) {
    return { thresholdType: "price_above", value: parseFloat(match[1]) };
  }

  match = text.match(PERCENT_REGEX);
  if (match) {
    return {
      thresholdType: "percent_change",
      value: parseFloat(match[1]),
      timeframe: match[2] as "1h" | "24h",
    };
  }

  return null;
}

export const thresholdSetupConversation: ConversationFn<MyContext> = async (
  conversation,
  ctx,
) => {
  conversation.session.flowStartedAt = Date.now();
  const existingCoin = ctx.session.coin;

  if (!existingCoin) {
    await ctx.reply(
      "Which coin would you like to set a threshold for? (e.g., TON, USDT)",
      { reply_markup: cancelKeyboard() },
    );
    const coinCtx = await conversation.wait();
    const coinText = coinCtx.message?.text?.trim().toUpperCase();
    if (!coinText || !(SUPPORTED_COINS as readonly string[]).includes(coinText)) {
      await coinCtx.reply(
        "Hmm, I don't recognize that coin. Try TON, USDT, or GRAM.",
        { reply_markup: mainMenuKeyboard() },
      );
      conversation.session.step = undefined;
      conversation.session.coin = undefined;
      conversation.session.flowStartedAt = undefined;
      return;
    }
    conversation.session.coin = coinText as CoinSymbol;
  }

  const coin = conversation.session.coin!;

  await ctx.reply(
    `Set a threshold for ${coin}. Example formats:\n` +
      '- "below $2.50"\n' +
      '- "above $3.00"\n' +
      '- "+5% in 1h"\n' +
      '- "-10% in 24h"',
    { reply_markup: cancelKeyboard() },
  );

  const thresholdCtx = await conversation.wait();
  const thresholdText = thresholdCtx.message?.text?.trim();
  if (!thresholdText) {
    await thresholdCtx.reply("Invalid format. Use: below $X, above $X, +5% in 1h, or -10% in 24h.", {
      reply_markup: mainMenuKeyboard(),
    });
    conversation.session.step = undefined;
    conversation.session.coin = undefined;
    conversation.session.flowStartedAt = undefined;
    return;
  }

  const parsed = parseThreshold(thresholdText);
  if (!parsed) {
    await thresholdCtx.reply(
      "Invalid format. Use: below $X, above $X, +5% in 1h, or -10% in 24h.",
      { reply_markup: mainMenuKeyboard() },
    );
    conversation.session.step = undefined;
    conversation.session.coin = undefined;
    conversation.session.flowStartedAt = undefined;
    return;
  }

  if (!ctx.from) {
    conversation.session.step = undefined;
    conversation.session.coin = undefined;
    conversation.session.flowStartedAt = undefined;
    return;
  }

  await ctx.db.addThreshold({
    user_id: ctx.from.id,
    coin_symbol: coin,
    threshold_type: parsed.thresholdType,
    value: parsed.value,
    timeframe: parsed.timeframe,
  });

  let description: string;
  if (parsed.thresholdType === "price_below") {
    description = `below $${parsed.value.toFixed(2)}`;
  } else if (parsed.thresholdType === "price_above") {
    description = `above $${parsed.value.toFixed(2)}`;
  } else {
    const sign = parsed.value >= 0 ? "+" : "";
    description = `${sign}${parsed.value}% in ${parsed.timeframe}`;
  }

  await ctx.reply(
    `Threshold for ${coin} saved: ${description}. You'll be alerted when the price crosses your threshold.`,
    { reply_markup: mainMenuKeyboard() },
  );

  conversation.session.step = undefined;
  conversation.session.coin = undefined;
  conversation.session.flowStartedAt = undefined;
  conversation.session.thresholdType = undefined;
  conversation.session.thresholdValue = undefined;
};

export const quietHoursSetupConversation: ConversationFn<MyContext> = async (
  conversation,
  ctx,
) => {
  conversation.session.flowStartedAt = Date.now();
  await ctx.reply("Enter start time (24h format, e.g., 22:00):", {
    reply_markup: cancelKeyboard(),
  });

  const startCtx = await conversation.wait();
  const startText = startCtx.message?.text?.trim();
  if (!startText || !TIME_REGEX.test(startText)) {
    await startCtx.reply(
      "Invalid time format. Use HH:MM (e.g., 22:00).",
      { reply_markup: mainMenuKeyboard() },
    );
    return;
  }
  conversation.session.startTime = startText;

  await ctx.reply("Enter end time (24h format, e.g., 07:00):", {
    reply_markup: cancelKeyboard(),
  });

  const endCtx = await conversation.wait();
  const endText = endCtx.message?.text?.trim();
  if (!endText || !TIME_REGEX.test(endText)) {
    await endCtx.reply(
      "Invalid time format. Use HH:MM (e.g., 07:00).",
      { reply_markup: mainMenuKeyboard() },
    );
    return;
  }
  conversation.session.endTime = endText;

  await ctx.reply(
    `Confirm quiet hours: ${conversation.session.startTime} to ${conversation.session.endTime}`,
    { reply_markup: quietHoursConfirmationKeyboard() },
  );
};

export const priceRequestConversation: ConversationFn<MyContext> = async (
  conversation,
  ctx,
) => {
  conversation.session.flowStartedAt = Date.now();
  await ctx.reply(
    "Enter the coin symbol to check its price (e.g., TON, USDT):",
    { reply_markup: cancelKeyboard() },
  );

  const coinCtx = await conversation.wait();
  const coinText = coinCtx.message?.text?.trim().toUpperCase();
  if (!coinText || !(SUPPORTED_COINS as readonly string[]).includes(coinText)) {
    await coinCtx.reply(
      "Hmm, I don't recognize that coin. Try TON, USDT, or GRAM.",
      { reply_markup: mainMenuKeyboard() },
    );
    return;
  }

  // Price lookup delegated to PriceService
  try {
    const priceData = await ctx.price.getPrice(coinText);
    const change1h =
      priceData.change_1h_pct >= 0
        ? `+${priceData.change_1h_pct.toFixed(1)}%`
        : `${priceData.change_1h_pct.toFixed(1)}%`;
    const change24h =
      priceData.change_24h_pct >= 0
        ? `+${priceData.change_24h_pct.toFixed(1)}%`
        : `${priceData.change_24h_pct.toFixed(1)}%`;
    const updated = new Date(priceData.last_updated).toISOString().slice(0, 16).replace("T", " ");
    await ctx.reply(
      `${coinText} is currently $${priceData.price_usd.toFixed(2)} (${change1h} in 1h, ${change24h} in 24h).\nLast updated: ${updated} UTC.`,
      { reply_markup: backToMainKeyboard() },
    );
  } catch (err) {
    await ctx.reply(
      `Failed to fetch price data for ${coinText}. Please try again later.`,
      { reply_markup: backToMainKeyboard() },
    );
  }
};
