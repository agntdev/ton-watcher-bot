export const SUPPORTED_COINS = ["TON", "USDT", "GRAM"] as const;

export type CoinSymbol = (typeof SUPPORTED_COINS)[number];

export type ThresholdType = "price_below" | "price_above" | "percent_change";

export interface UserProfile {
  telegram_id: number;
  summary_enabled: boolean;
}

export interface QuietHours {
  user_id: number;
  start_time: string;
  end_time: string;
}

export interface WatchlistEntry {
  user_id: number;
  coin_symbol: CoinSymbol;
}

export interface AlertThreshold {
  user_id: number;
  coin_symbol: CoinSymbol;
  threshold_type: ThresholdType;
  value: number;
  last_alert_time: number;
  timeframe?: "1h" | "24h";
}

export interface AlertHistoryEntry {
  alert_id: number;
  user_id: number;
  coin_symbol: CoinSymbol;
  triggered_at: number;
  price: number;
  change_percent: number;
}

export interface PriceData {
  symbol: CoinSymbol;
  price_usd: number;
  change_1h_pct: number;
  change_24h_pct: number;
  last_updated: number;
}

export interface DbService {
  getUser(telegramId: number): Promise<UserProfile | null>;
  createUser(telegramId: number): Promise<UserProfile>;
  updateUser(telegramId: number, updates: Partial<UserProfile>): Promise<UserProfile>;

  getWatchlist(telegramId: number): Promise<WatchlistEntry[]>;
  addToWatchlist(telegramId: number, coin: CoinSymbol): Promise<WatchlistEntry>;
  removeFromWatchlist(telegramId: number, coin: CoinSymbol): Promise<void>;

  getThresholds(telegramId: number): Promise<AlertThreshold[]>;
  getAllThresholds(): Promise<AlertThreshold[]>;
  getThresholdsForCoin(telegramId: number, coin: CoinSymbol): Promise<AlertThreshold[]>;
  addThreshold(threshold: Omit<AlertThreshold, "last_alert_time">): Promise<AlertThreshold>;
  removeThreshold(telegramId: number, coin: CoinSymbol, thresholdType: ThresholdType): Promise<void>;
  updateLastAlertTime(
    telegramId: number,
    coin: CoinSymbol,
    thresholdType: ThresholdType,
    time: number,
  ): Promise<void>;

  getQuietHours(telegramId: number): Promise<QuietHours | null>;
  setQuietHours(quietHours: QuietHours): Promise<QuietHours>;

  getAlertHistory(userId: number, limit?: number): Promise<AlertHistoryEntry[]>;
  addAlertHistory(entry: Omit<AlertHistoryEntry, "alert_id">): Promise<AlertHistoryEntry>;

  getTotalUsers(): Promise<number>;
  getTopAlerts(limit?: number): Promise<AlertHistoryEntry[]>;
}

export interface PriceService {
  getPrice(symbol: string): Promise<PriceData>;
  getPrices(symbols: string[]): Promise<Map<string, PriceData>>;
}

export interface AuthService {
  isOwner(telegramId: number): Promise<boolean>;
}