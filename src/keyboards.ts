import { InlineKeyboard } from "grammy";
import { type CoinSymbol, SUPPORTED_COINS } from "./types";

export function mainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Watchlist", "menu:watchlist")
    .text("Price Now", "menu:price").row()
    .text("Thresholds", "menu:thresholds")
    .text("Quiet Hours", "menu:quiet").row()
    .text("Morning Summary", "menu:summary")
    .text("Owner View", "menu:owner");
}

export function watchlistManagementKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Add Coin", "watchlist:add")
    .text("View Watchlist", "watchlist:view").row()
    .text("Back to Main Menu", "nav:main");
}

export function watchlistAddCoinKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const coin of SUPPORTED_COINS) {
    kb.text(coin, `watchlist:add:${coin}`).row();
  }
  kb.text("Back to Watchlist", "menu:watchlist");
  return kb;
}

export function watchlistItemsKeyboard(coins: CoinSymbol[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const coin of coins) {
    kb.text(`Remove ${coin}`, `watchlist:remove:${coin}`)
      .text(`Set Threshold for ${coin}`, `threshold:coin:${coin}`).row();
  }
  kb.text("Back to Main Menu", "nav:main");
  return kb;
}

export function cancelKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("Cancel", "nav:main");
}

export function quietHoursConfirmationKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Confirm", "quiet:confirm")
    .text("Cancel", "nav:main");
}

export function morningSummaryToggleKeyboard(enabled: boolean): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (enabled) {
    kb.text("Disable Morning Summary", "summary:disable");
  } else {
    kb.text("Enable Morning Summary", "summary:enable");
  }
  kb.row().text("Back to Main Menu", "nav:main");
  return kb;
}

export function ownerDashboardKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("View Alert Stats", "owner:alerts")
    .text("View User Activity", "owner:users").row()
    .text("Back to Main Menu", "nav:main");
}

export function dismissAlertKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("Dismiss", "alert:dismiss");
}

export function backToMainKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("Back to Main Menu", "nav:main");
}

export function backToOwnerKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Back to Owner Dashboard", "menu:owner")
    .row()
    .text("Back to Main Menu", "nav:main");
}

export function setQuietHoursKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Set Quiet Hours", "quiet:set").row()
    .text("Back to Main Menu", "nav:main");
}

export function paginatorKeyboard(
  page: number,
  totalPages: number,
  prefix: string,
): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (page > 0) {
    kb.text("Previous", `${prefix}:page:${page - 1}`);
  }
  kb.text(`Page ${page + 1}/${totalPages}`, "noop");
  if (page < totalPages - 1) {
    kb.text("Next", `${prefix}:page:${page + 1}`);
  }
  kb.row().text("Back to Main Menu", "nav:main");
  return kb;
}
