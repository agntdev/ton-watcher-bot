import { type AuthService } from "./types";

export function createAuthService(): AuthService {
  const ownerIdRaw = process.env.OWNER_ID;
  if (!ownerIdRaw) {
    throw new Error("OWNER_ID environment variable is required");
  }

  const ownerIds = ownerIdRaw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => {
      const parsed = parseInt(id, 10);
      if (isNaN(parsed)) {
        throw new Error(`Invalid OWNER_ID value: "${id}" is not a number`);
      }
      return parsed;
    });

  if (ownerIds.length === 0) {
    throw new Error("OWNER_ID must contain at least one valid Telegram user ID");
  }

  return {
    async isOwner(telegramId: number): Promise<boolean> {
      return ownerIds.includes(telegramId);
    },
  };
}