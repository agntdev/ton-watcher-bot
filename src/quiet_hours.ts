import { type QuietHours } from "./types";

export function isInQuietHours(quietHours: QuietHours | null): boolean {
  if (!quietHours) return false;

  const now = new Date();
  const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  const [startH, startM] = quietHours.start_time.split(":").map(Number);
  const [endH, endM] = quietHours.end_time.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

export function shouldSuppressAlert(
  quietHours: QuietHours | null,
): boolean {
  return isInQuietHours(quietHours);
}