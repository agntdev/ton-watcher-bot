import {
  type DbService,
  type UserProfile,
  type WatchlistEntry,
  type AlertThreshold,
  type QuietHours,
  type AlertHistoryEntry,
  type CoinSymbol,
  type ThresholdType,
} from "./types";

export function createDbService(): DbService {
  const users = new Map<number, UserProfile>();
  const watchlistKey = (userId: number, coin: CoinSymbol) => `${userId}:${coin}`;
  const thresholdKey = (userId: number, coin: CoinSymbol, type: ThresholdType) =>
    `${userId}:${coin}:${type}`;
  const watchlists = new Map<string, WatchlistEntry>();
  const thresholds = new Map<string, AlertThreshold>();
  const quietHours = new Map<number, QuietHours>();
  const alertHistory: AlertHistoryEntry[] = [];
  let nextAlertId = 1;

  return {
    async getUser(telegramId: number): Promise<UserProfile | null> {
      return users.get(telegramId) ?? null;
    },

    async createUser(telegramId: number): Promise<UserProfile> {
      const user: UserProfile = { telegram_id: telegramId, summary_enabled: false };
      users.set(telegramId, user);
      return user;
    },

    async updateUser(
      telegramId: number,
      updates: Partial<UserProfile>,
    ): Promise<UserProfile> {
      const user = users.get(telegramId);
      if (!user) throw new Error(`User ${telegramId} not found`);
      const updated = { ...user, ...updates, telegram_id: telegramId };
      users.set(telegramId, updated);
      return updated;
    },

    async getWatchlist(telegramId: number): Promise<WatchlistEntry[]> {
      const prefix = `${telegramId}:`;
      const entries: WatchlistEntry[] = [];
      for (const [key, entry] of watchlists) {
        if (key.startsWith(prefix)) entries.push(entry);
      }
      return entries;
    },

    async addToWatchlist(
      telegramId: number,
      coin: CoinSymbol,
    ): Promise<WatchlistEntry> {
      const user = users.get(telegramId);
      if (!user) throw new Error(`User ${telegramId} not found`);
      const entry: WatchlistEntry = { user_id: telegramId, coin_symbol: coin };
      watchlists.set(watchlistKey(telegramId, coin), entry);
      return entry;
    },

    async removeFromWatchlist(
      telegramId: number,
      coin: CoinSymbol,
    ): Promise<void> {
      watchlists.delete(watchlistKey(telegramId, coin));
    },

    async getThresholds(telegramId: number): Promise<AlertThreshold[]> {
      const prefix = `${telegramId}:`;
      const entries: AlertThreshold[] = [];
      for (const [key, entry] of thresholds) {
        if (key.startsWith(prefix)) entries.push(entry);
      }
      return entries;
    },

    async getThresholdsForCoin(
      telegramId: number,
      coin: CoinSymbol,
    ): Promise<AlertThreshold[]> {
      const prefix = `${telegramId}:${coin}:`;
      const entries: AlertThreshold[] = [];
      for (const [key, entry] of thresholds) {
        if (key.startsWith(prefix)) entries.push(entry);
      }
      return entries;
    },

    async addThreshold(
      input: Omit<AlertThreshold, "last_alert_time">,
    ): Promise<AlertThreshold> {
      const entry: AlertThreshold = { ...input, last_alert_time: 0 };
      thresholds.set(
        thresholdKey(input.user_id, input.coin_symbol, input.threshold_type),
        entry,
      );
      return entry;
    },

    async removeThreshold(
      telegramId: number,
      coin: CoinSymbol,
      thresholdType: ThresholdType,
    ): Promise<void> {
      thresholds.delete(thresholdKey(telegramId, coin, thresholdType));
    },

    async updateLastAlertTime(
      telegramId: number,
      coin: CoinSymbol,
      thresholdType: ThresholdType,
      time: number,
    ): Promise<void> {
      const key = thresholdKey(telegramId, coin, thresholdType);
      const entry = thresholds.get(key);
      if (entry) {
        entry.last_alert_time = time;
      }
    },

    async getQuietHours(telegramId: number): Promise<QuietHours | null> {
      return quietHours.get(telegramId) ?? null;
    },

    async setQuietHours(input: QuietHours): Promise<QuietHours> {
      quietHours.set(input.user_id, input);
      return input;
    },

    async getAlertHistory(
      userId: number,
      limit?: number,
    ): Promise<AlertHistoryEntry[]> {
      const filtered = alertHistory.filter((e) => e.user_id === userId);
      const sorted = filtered.sort((a, b) => b.triggered_at - a.triggered_at);
      return limit !== undefined ? sorted.slice(0, limit) : sorted;
    },

    async addAlertHistory(
      entry: Omit<AlertHistoryEntry, "alert_id">,
    ): Promise<AlertHistoryEntry> {
      const full: AlertHistoryEntry = { ...entry, alert_id: nextAlertId++ };
      alertHistory.push(full);
      return full;
    },

    async getTotalUsers(): Promise<number> {
      return users.size;
    },

async getTopAlerts(limit?: number): Promise<AlertHistoryEntry[]> {
      const sorted = [...alertHistory].sort(
        (a, b) => b.triggered_at - a.triggered_at,
      );
      return limit !== undefined ? sorted.slice(0, limit) : sorted;
    },

    async getUsersWithSummaryEnabled(): Promise<number[]> {
      const ids: number[] = [];
      for (const [id, user] of users) {
        if (user.summary_enabled) {
          ids.push(id);
        }
      }
      return ids;
    },
  };
}