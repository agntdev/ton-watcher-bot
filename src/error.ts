import type { Api } from "grammy";

const MAX_API_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

const RETRYABLE_METHODS = new Set([
  "sendMessage",
  "editMessageText",
  "editMessageReplyMarkup",
  "answerCallbackQuery",
  "sendPhoto",
  "sendDocument",
  "deleteMessage",
  "copyMessage",
]);

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetryableTelegramError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes("timeout") || msg.includes("econnrefused") || msg.includes("enotfound")) {
      return true;
    }
    const statusMatch = msg.match(/(\d{3})/);
    if (statusMatch && RETRYABLE_STATUS_CODES.has(Number(statusMatch[1]))) {
      return true;
    }
  }
  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_API_RETRIES,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries && isRetryableTelegramError(err)) {
        const backoff = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await delay(backoff);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export function wrapApiWithRetry(api: Api): Api {
  return new Proxy(api, {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver);
      if (typeof original === "function" && RETRYABLE_METHODS.has(String(prop))) {
        return (...args: unknown[]) => {
          return withRetry(() =>
            (original as (...a: unknown[]) => Promise<unknown>).apply(target, args),
          );
        };
      }
      return original;
    },
  });
}

export function formatUserErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes("timeout") || msg.includes("timed out")) {
      return "The request timed out. Please try again in a moment.";
    }
    if (msg.includes("429") || msg.includes("too many requests")) {
      return "I'm a bit busy right now. Please try again in a few seconds.";
    }
    if (msg.includes("bot was blocked") || msg.includes("forbidden")) {
      return "I can't send you messages. Please start a new chat with the bot.";
    }
    if (msg.includes("chat not found")) {
      return "I couldn't find this chat. Please use /start to register.";
    }
    if (msg.includes("message to edit not found") || msg.includes("message to delete not found")) {
      return "This message is no longer available.";
    }
    if (msg.includes("user not found")) {
      return "I wasn't able to find your account. Please try /start.";
    }
  }
  return "Something went wrong. Please try again or use /start to reset.";
}

export class BotError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean = false,
    public readonly userMessage?: string,
  ) {
    super(message);
    this.name = "BotError";
  }
}
