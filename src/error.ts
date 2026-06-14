const DEFAULT_MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 10000;

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelay = options?.baseDelayMs ?? BASE_DELAY_MS;
  const maxDelay = options?.maxDelayMs ?? MAX_DELAY_MS;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delayMs = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      if (options?.onRetry) {
        options.onRetry(attempt, err as Error, delayMs);
      }
      await delay(delayMs);
    }
  }

  throw new Error("withRetry: unreachable");
}

const TELEGRAM_ERROR_MESSAGES: Record<string, string> = {
  "bot was blocked by the user": "It looks like you've blocked the bot. Please unblock to continue.",
  "chat not found": "Unable to reach you. Have you started a chat with the bot?",
  "Forbidden: bot was kicked": "The bot has been removed from the chat.",
  "Too Many Requests":
    "The bot is processing too many requests. Please wait a moment and try again.",
  "query is too old": "This action has expired. Please start a new request.",
  "message is not modified": "The action had no effect — the content is unchanged.",
};

export function formatTelegramError(err: unknown): string {
  if (err instanceof Error) {
    for (const [pattern, message] of Object.entries(TELEGRAM_ERROR_MESSAGES)) {
      if (err.message.includes(pattern)) {
        return message;
      }
    }
    if (err.message.includes("ETIMEDOUT") || err.message.includes("timeout")) {
      return "The request timed out. Please try again in a moment.";
    }
    return "Something went wrong. Please try again later.";
  }
  return "An unexpected error occurred. Please try again.";
}