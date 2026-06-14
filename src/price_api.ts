const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

const COIN_ID_MAP: Record<string, string> = {
  TON: "the-open-network",
  USDT: "tether",
  GRAM: "gram",
};

export interface PriceData {
  coin: string;
  price_usd: number;
  change_1h_percent: number;
  change_24h_percent: number;
  last_updated: Date;
}

export class PriceApiError extends Error {
  constructor(
    message: string,
    public readonly coin?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "PriceApiError";
  }
}

async function fetchWithRetry(
  url: string,
  retries = 3,
  delayMs = 1000,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new PriceApiError(
          `CoinGecko API returned status ${response.status}`,
          undefined,
          response.status,
        );
      }
      return response;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        const backoff = delayMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }
  }

  throw lastError instanceof PriceApiError
    ? lastError
    : new PriceApiError(
        `Failed to fetch after ${retries} retries: ${String(lastError)}`,
      );
}

function resolveCoinId(coin: string): string {
  const id = COIN_ID_MAP[coin.toUpperCase()];
  if (!id) {
    throw new PriceApiError(`Unknown coin symbol: ${coin}`, coin);
  }
  return id;
}

export async function getPrice(coin: string): Promise<PriceData> {
  const coinId = resolveCoinId(coin);
  const url = `${COINGECKO_BASE}/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`;

  const response = await fetchWithRetry(url);

  const data = (await response.json()) as {
    market_data?: {
      current_price?: { usd?: number };
      price_change_percentage_1h_in_currency?: { usd?: number };
      price_change_percentage_24h_in_currency?: { usd?: number };
    };
  };

  const marketData = data.market_data;
  if (!marketData) {
    throw new PriceApiError(`No market data returned for ${coin}`, coin);
  }

  return {
    coin: coin.toUpperCase(),
    price_usd: marketData.current_price?.usd ?? 0,
    change_1h_percent:
      marketData.price_change_percentage_1h_in_currency?.usd ?? 0,
    change_24h_percent:
      marketData.price_change_percentage_24h_in_currency?.usd ?? 0,
    last_updated: new Date(),
  };
}

export async function getPrices(coins: string[]): Promise<PriceData[]> {
  return Promise.all(coins.map((coin) => getPrice(coin)));
}

export function isSupportedCoin(coin: string): boolean {
  return coin.toUpperCase() in COIN_ID_MAP;
}

export const SUPPORTED_COINS = Object.keys(COIN_ID_MAP);
