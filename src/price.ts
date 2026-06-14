import https from "https";
import { type PriceService, type PriceData, type CoinSymbol, SUPPORTED_COINS } from "./types";

const COINGECKO_HOST = "api.coingecko.com";
const COINGECKO_PATH = "/api/v3/simple/price";

const COIN_TO_ID: Record<CoinSymbol, string> = {
  TON: "the-open-network",
  USDT: "tether",
  GRAM: "gram",
};

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 5000;
const REQUEST_TIMEOUT_MS = 15000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface CoinGeckoPriceData {
  usd: number;
  usd_1h_change?: number;
  usd_24h_change?: number;
}

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { timeout: REQUEST_TIMEOUT_MS },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }
        let data = "";
        res.on("data", (chunk: string) => {
          data += chunk;
        });
        res.on("end", () => resolve(data));
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
  });
}

function symbolToId(symbol: CoinSymbol): string {
  return COIN_TO_ID[symbol];
}

function idToSymbol(id: string): CoinSymbol | undefined {
  for (const [sym, coinId] of Object.entries(COIN_TO_ID)) {
    if (coinId === id) return sym as CoinSymbol;
  }
  return undefined;
}

async function fetchPrices(
  symbols: CoinSymbol[],
): Promise<Record<string, CoinGeckoPriceData>> {
  const ids = symbols.map(symbolToId).join(",");
  const url = `https://${COINGECKO_HOST}${COINGECKO_PATH}?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_1h_change=true&include_24h_change=true`;

  const body = await httpsGet(url);
  return JSON.parse(body) as Record<string, CoinGeckoPriceData>;
}

async function fetchPricesWithRetry(
  symbols: CoinSymbol[],
  remainingRetries: number,
): Promise<Record<string, CoinGeckoPriceData>> {
  try {
    return await fetchPrices(symbols);
  } catch (err) {
    if (remainingRetries > 1) {
      const delayMs =
        INITIAL_RETRY_DELAY_MS * (MAX_RETRIES - remainingRetries + 1);
      console.warn(
        `Price API request failed (${remainingRetries} retries left):`,
        (err as Error).message,
      );
      await delay(delayMs);
      return fetchPricesWithRetry(symbols, remainingRetries - 1);
    }
    console.error("Price API request failed after all retries:", (err as Error).message);
    throw new Error(
      `Failed to fetch price data. Please try again later. (${(err as Error).message})`,
    );
  }
}

function buildPriceData(
  symbol: CoinSymbol,
  data: CoinGeckoPriceData,
): PriceData {
  return {
    symbol,
    price_usd: data.usd,
    change_1h_pct: data.usd_1h_change ?? 0,
    change_24h_pct: data.usd_24h_change ?? 0,
    last_updated: Date.now(),
  };
}

export function createPriceService(): PriceService {
  return {
    async getPrice(symbol: string): Promise<PriceData> {
      const upperSymbol = symbol.toUpperCase();
      if (!(SUPPORTED_COINS as readonly string[]).includes(upperSymbol)) {
        throw new Error(`Unsupported coin: ${symbol}. Try TON, USDT, or GRAM.`);
      }
      const coinSymbol = upperSymbol as CoinSymbol;
      const data = await fetchPricesWithRetry([coinSymbol], MAX_RETRIES);
      const coinData = data[symbolToId(coinSymbol)];
      if (!coinData) {
        throw new Error(`Price data not available for ${symbol}.`);
      }
      return buildPriceData(coinSymbol, coinData);
    },

    async getPrices(symbols: string[]): Promise<Map<string, PriceData>> {
      const validSymbols = symbols
        .map((s) => s.toUpperCase())
        .filter((s): s is CoinSymbol =>
          (SUPPORTED_COINS as readonly string[]).includes(s),
        );

      if (validSymbols.length === 0) {
        return new Map();
      }

      const data = await fetchPricesWithRetry(validSymbols, MAX_RETRIES);
      const result = new Map<string, PriceData>();

      for (const symbol of validSymbols) {
        const coinData = data[symbolToId(symbol)];
        if (coinData) {
          result.set(symbol, buildPriceData(symbol, coinData));
        }
      }

      return result;
    },
  };
}