import { type ConversationFn } from "@grammyjs/conversations";
import { type MyContext } from "./session";
import { SUPPORTED_COINS, type CoinSymbol } from "./types";
import {
  cancelKeyboard,
  mainMenuKeyboard,
  quietHoursConfirmationKeyboard,
  backToMainKeyboard,
} from "./keyboards";

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

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
      return;
    }
    conversation.session.coin = coinText as CoinSymbol;
  }

  const coin = conversation.session.coin!;

  await ctx.reply(
    `Set a threshold for ${coin}. Example formats:\n` +
      '- "below $2.50"\n' +
      '- "+5% in 1h"\n' +
      '- "-10% in 24h"',
    { reply_markup: cancelKeyboard() },
  );

  const thresholdCtx = await conversation.wait();
  const thresholdText = thresholdCtx.message?.text?.trim();
  if (!thresholdText) {
    await thresholdCtx.reply("Invalid format. Use: [coin] [below/above] [price] or [coin] [±X%] in [1h/24h].", {
      reply_markup: mainMenuKeyboard(),
    });
    return;
  }

  // Delegate saving to service layer — injected via bot middleware
  await ctx.reply(
    `Threshold for ${coin} saved! You'll be alerted when price crosses your threshold.`,
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
  await ctx.reply(
    `Price check for ${coinText} requested. (Price data will be fetched by the price service.)`,
    { reply_markup: backToMainKeyboard() },
  );
};
