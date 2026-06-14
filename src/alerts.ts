import { schedule, type ScheduledTask } from "node-cron";
import { type Bot } from "grammy";
import { type MyContext } from "./session";
import { type DbService, type AlertThreshold, type CoinSymbol, SUPPORTED_COINS } from "./types";
import { createPriceService } from "./price";
import { dismissAlertKeyboard } from "./keyboards";

const ALERT_COOLDOWN_MS = 60 * 60 * 1000;

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

function formatAlertMessage(
  coin: string,
  threshold: AlertThreshold,
  price: number,
  change1h: number,
  change24h: number,
): string {
  const nowStr = new Date().toISOString().slice(0, 16).replace("T", " ");
  const sign1h = change1h >= 0 ? "+" : "";
  const sign24h = change24h >= 0 ? "+" : "";

  let actionDesc: string;
  if (threshold.threshold_type === "price_below") {
    actionDesc = `dropped below $${threshold.value.toFixed(2)}`;
  } else if (threshold.threshold_type === "price_above") {
    actionDesc = `rose above $${threshold.value.toFixed(2)}`;
  } else {
    const sign = threshold.value >= 0 ? "+" : "";
    const tf = threshold.timeframe ? ` in ${threshold.timeframe}h` : "";
    actionDesc = `${sign}${threshold.value}%${tf}`;
  }

  return (
    `⚠️ Alert: ${coin} ${actionDesc}!\n` +
    `Current price: \\$${price.toFixed(2)}\n` +
    `Change: ${sign1h}${change1h.toFixed(1)}% 1h, ${sign24h}${change24h.toFixed(1)}% 24h\n` +
    `Triggered at: ${nowStr} UTC`
  );
}

function isThresholdTriggered(
  threshold: AlertThreshold,
  price: number,
  change1h: number,
  change24h: number,
): boolean {
  if (threshold.threshold_type === "price_below") {
    return price < threshold.value;
  }
  if (threshold.threshold_type === "price_above") {
    return price > threshold.value;
  }
  if (threshold.threshold_type === "percent_change") {
    const timeframe = threshold.timeframe;
    if (timeframe === 1) {
      return threshold.value >= 0
        ? change1h >= threshold.value
        : change1h <= threshold.value;
    }
    if (timeframe === 24) {
      return threshold.value >= 0
        ? change24h >= threshold.value
        : change24h <= threshold.value;
    }
    return threshold.value >= 0
      ? (change1h >= threshold.value || change24h >= threshold.value)
      : (change1h <= threshold.value || change24h <= threshold.value);
  }
  return false;
}

async function checkAllThresholds(
  bot: Bot<MyContext>,
  db: DbService,
): Promise<void> {
  const userIds = await db.getAllUserIds();
  if (userIds.length === 0) return;

  const allThresholds: AlertThreshold[] = [];
  for (const userId of userIds) {
    const userThresholds = await db.getThresholds(userId);
    allThresholds.push(...userThresholds);
  }
  if (allThresholds.length === 0) return;

  const uniqueCoins = [...new Set(allThresholds.map((t) => t.coin_symbol))];
  const price = createPriceService();

  let priceMap: Map<string, { price: number; change1h: number; change24h: number }>;
  try {
    const rawPrices = await price.getPrices(uniqueCoins);
    priceMap = new Map();
    for (const [sym, data] of rawPrices) {
      priceMap.set(sym, {
        price: data.price_usd,
        change1h: data.change_1h_pct,
        change24h: data.change_24h_pct,
      });
    }
  } catch {
    return;
  }

  const now = Date.now();

  for (const threshold of allThresholds) {
    const pd = priceMap.get(threshold.coin_symbol);
    if (!pd) continue;

    if (!isThresholdTriggered(threshold, pd.price, pd.change1h, pd.change24h)) {
      continue;
    }

    if (now - threshold.last_alert_time < ALERT_COOLDOWN_MS) {
      continue;
    }

    const qh = await db.getQuietHours(threshold.user_id);
    if (qh && isInQuietHours(new Date(), qh.start_time, qh.end_time)) {
      continue;
    }

    const msg = formatAlertMessage(
      threshold.coin_symbol,
      threshold,
      pd.price,
      pd.change1h,
      pd.change24h,
    );

    try {
      await bot.api.sendMessage(threshold.user_id, msg, {
        parse_mode: "Markdown",
        reply_markup: dismissAlertKeyboard(),
      });
    } catch (err) {
      console.error(
        `Failed to send alert to user ${threshold.user_id}:`,
        err,
      );
    }

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
      price: pd.price,
      change_percent: threshold.threshold_type === "percent_change"
        ? (threshold.timeframe === 1 ? pd.change1h : threshold.timeframe === 24 ? pd.change24h : pd.change1h)
        : 0,
    });
  }
}

export function startAlertChecker(
  bot: Bot<MyContext>,
  db: DbService,
): ScheduledTask {
  return schedule("*/5 * * * *", async () => {
    await checkAllThresholds(bot, db);
  }, {
    scheduled: false,
    timezone: "UTC",
  });
}