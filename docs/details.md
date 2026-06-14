# Telegram Crypto Watcher Bot - DETAILS Design Document  

---

## SCREENS  

### 1. Main Menu  
**Trigger:** `/start`, `/help`, `/cancel`, timeout, or after any operation  
**Message:**  
```
Hi! I'm your TON crypto watcher.  
Use /watchlist to track coins, /thresholds to set alerts, and /summary to get daily updates.  
Type /help for all commands!
```
**Keyboard:**  
```
[Watchlist] [Price Now] [Thresholds]  
[Quiet Hours] [Morning Summary] [Owner View]  
```
**Transitions:**  
- `/watchlist` → Watchlist Management  
- `/price` → Price Request Prompt  
- `/thresholds` → Coin Prompt for Threshold Setup  
- `/quiet` → Quiet Hours Setup Prompt  
- `/summary` → Morning Summary Toggle  
- `/owner` → Owner Dashboard (if admin)  
- Invalid input → Main Menu with error message  
- `/cancel` → Main Menu  

---

### 2. Watchlist Management  
**Trigger:** `/watchlist`  
**Message:**  
```
Your current watchlist:  
- TON  
- USDT  
- GRAM  

Choose an action:
```
**Keyboard (inline):**  
```
[Add Coin] [View Watchlist]  
```
**Transitions:**  
- `Add Coin` → Coin Symbol Input  
- `View Watchlist` → Watchlist Items Screen  
- Invalid input → Main Menu  
- `/cancel` → Main Menu  

---

### 3. Watchlist Items Screen  
**Trigger:** `View Watchlist`  
**Message:**  
If watchlist is empty:  
```
Your watchlist is empty. Use /watchlist to add coins!
```
If watchlist has coins:  
```
[Remove TON] [Set Threshold for TON]  
[Remove USDT] [Set Threshold for USDT]  
[Remove GRAM] [Set Threshold for GRAM]  
```
**Keyboard (inline):**  
```
[Back to Main Menu]  
```
**Transitions:**  
- `Remove [Coin]` → Remove Coin Confirmation  
- `Set Threshold for [Coin]` → Threshold Setup (specific coin)  
- `Back to Main Menu` → Main Menu  
- `/cancel` → Main Menu  

---

### 4. Coin Prompt for Threshold Setup  
**Trigger:** `/thresholds`  
**Message:**  
```
Which coin would you like to set a threshold for? (e.g., TON, USDT)
```
**Keyboard:**  
```
[Cancel]  
```
**Transitions:**  
- Valid coin symbol → Threshold Setup (specific coin)  
- Invalid coin → Error message + Coin Prompt (retry)  
- `/cancel` → Main Menu  

---

### 5. Threshold Setup (specific coin)  
**Trigger:** Coin Prompt or "Set Threshold for [Coin]"  
**Message:**  
```
Set a threshold for [Coin]. Example formats:  
- "below $2.50"  
- "+5% in 1h"  
- "-10% in 24h"  
```
**Keyboard:**  
```
[Cancel]  
```
**Transitions:**  
- Valid threshold input → Save Threshold + Main Menu  
- Invalid format → Error message + Threshold Setup (retry)  
- `/cancel` → Main Menu  

---

### 6. Quiet Hours Setup Prompt  
**Trigger:** `/quiet`  
**Message:**  
```
Current quiet hours: [Start Time] to [End Time]  
Would you like to update them?
```
**Keyboard (inline):**  
```
[Set Quiet Hours]  
```
**Transitions:**  
- `Set Quiet Hours` → Quiet Hours Start Input  
- `/cancel` → Main Menu  

---

### 7. Quiet Hours Start Input  
**Trigger:** `Set Quiet Hours`  
**Message:**  
```
Enter start time (24h format, e.g., 22:00):  
```
**Keyboard:**  
```
[Cancel]  
```
**Transitions:**  
- Valid start time → Quiet Hours End Input  
- Invalid time → Error message + Quiet Hours Start Input (retry)  
- `/cancel` → Main Menu  

---

### 8. Quiet Hours End Input  
**Trigger:** Valid start time  
**Message:**  
```
Enter end time (24h format, e.g., 07:00):  
```
**Keyboard:**  
```
[Cancel]  
```
**Transitions:**  
- Valid end time → Quiet Hours Confirmation Dialog  
- Invalid time → Error message + Quiet Hours End Input (retry)  
- `/cancel` → Main Menu  

---

### 9. Quiet Hours Confirmation Dialog  
**Trigger:** Valid start/end times  
**Message:**  
```
Confirm quiet hours: [Start Time] to [End Time]  
[Confirm] [Cancel]  
```
**Keyboard (inline):**  
```
[Confirm] [Cancel]  
```
**Transitions:**  
- `Confirm` → Save Quiet Hours + Main Menu  
- `Cancel` → Main Menu  

---

### 10. Morning Summary Toggle  
**Trigger:** `/summary`  
**Message:**  
```
Morning Summary is currently [Enabled/Disabled].  
Would you like to [Enable/Disable] it?
```
**Keyboard (inline):**  
```
[Enable Morning Summary] / [Disable Morning Summary]  
```
**Transitions:**  
- `Enable/Disable` → Update setting + Main Menu  
- `/cancel` → Main Menu  

---

### 11. Price Request Prompt  
**Trigger:** `/price`  
**Message:**  
```
Enter the coin symbol to check its price (e.g., TON, USDT):  
```
**Keyboard:**  
```
[Cancel]  
```
**Transitions:**  
- Valid coin → Price Check Result  
- Invalid coin → Error message + Price Request Prompt (retry)  
- `/cancel` → Main Menu  

---

### 12. Price Check Result  
**Trigger:** Valid coin input  
**Message:**  
```
[Coin] is currently [Price] ([Change %] in 1h).  
Last updated: [Timestamp]  
```
**Keyboard:**  
```
[Back to Main Menu]  
```
**Transitions:**  
- `Back to Main Menu` → Main Menu  

---

### 13. Owner Dashboard  
**Trigger:** `/owner` (admin-only)  
**Message:**  
```
📊 Owner Dashboard  
- Total Users: [Count]  
- Top 5 Alerts by Firing Count:  
  1. [Coin] [Threshold] – [Count]  
  2. [Coin] [Threshold] – [Count]  
- Last 10 API Errors:  
  - [Error Type] at [Time]  
```
**Keyboard (inline):**  
```
[View Alert Stats] [View User Activity]  
```
**Transitions:**  
- `View Alert Stats` → Alert Frequency Table  
- `View User Activity` → User Activity Log  
- `/cancel` → Main Menu  

---

### 14. Alert Notification  
**Trigger:** Price threshold crossed (non-quiet hours)  
**Message:**  
```
⚠️ Alert: [Coin] [Action] [Value]!  
Current price: [Price]  
Change in [Timeframe]: [Percentage]  
Triggered at: [Timestamp]  
```
**Keyboard (inline):**  
```
[Dismiss]  
```
**Transitions:**  
- `Dismiss` → Alert Notification (no action)  
- `/cancel` → Alert Notification  

---

## COMPONENTS  

### 1. Watchlist Inline Buttons  
**Props:**  
- `coins`: List of user's current coins  
- `onAdd`: Callback for adding a coin  
- `onRemove`: Callback for removing a coin  

**Behavior:**  
- Dynamically generates buttons for each coin in the watchlist.  
- Validates coin symbols against supported TON coins.  
- Shows empty message if `coins` is empty.  

---

### 2. Quiet Hours Confirmation Dialog  
**Props:**  
- `startTime`: User-provided start time (HH:MM)  
- `endTime`: User-provided end time (HH:MM)  

**Behavior:**  
- Displays time range and asks for confirmation.  
- Rejects invalid time ranges (e.g., start > end).  
- Validates time format (HH:MM).  

---

### 3. Owner Dashboard Alert Table  
**Props:**  
- `alerts`: List of {coin, threshold, count} objects  
- `limit`: Number of top alerts to display  

**Behavior:**  
- Sorts alerts by firing count (descending).  
- Paginates results if >5 entries.  

---

### 4. Price Paginator (for Morning Summary)  
**Props:**  
- `coins`: List of coins in watchlist  
- `pageIndex`: Current page number  

**Behavior:**  
- Displays 5 coins per page with price/percentage change.  
- Includes "Next" and "Previous" buttons for navigation.  

---

## TRANSITIONS  

| **Current State**       | **User Input/Callback**                     | **Next State**              | **Side Effects**                                                                 |
|--------------------------|---------------------------------------------|-----------------------------|----------------------------------------------------------------------------------|
| Main Menu                | `/watchlist`                                | Watchlist Management        | No side effect                                                                   |
| Main Menu                | `/price`                                    | Price Request Prompt        | No side effect                                                                   |
| Main Menu                | `/thresholds`                               | Coin Prompt for Threshold Setup | No side effect                                                                   |
| Main Menu                | `/quiet`                                    | Quiet Hours Setup Prompt    | No side effect                                                                   |
| Main Menu                | `/summary`                                  | Morning Summary Toggle      | No side effect                                                                   |
| Main Menu                | `/owner`                                    | Owner Dashboard (if admin)  | Validate admin access                                                            |
| Main Menu                | `/cancel`                                   | Main Menu                   | Cancel ongoing operation                                                         |
| Watchlist Management     | `Add Coin`                                  | Coin Symbol Input           | No side effect                                                                   |
| Watchlist Management     | `View Watchlist`                            | Watchlist Items Screen      | Fetch user's watchlist                                                           |
| Watchlist Items Screen   | `Remove [Coin]`                             | Remove Coin Confirmation    | No side effect                                                                   |
| Watchlist Items Screen   | `Set Threshold for [Coin]`                  | Threshold Setup (specific coin) | No side effect                                                                   |
| Coin Prompt for Threshold Setup | Valid coin symbol (e.g., "USDT")        | Threshold Setup (specific coin) | Store coin in temporary state                                                  |
| Threshold Setup (specific coin) | Valid threshold (e.g., "TON below $2.50") | Main Menu                 | Save threshold to database                                                      |
| Quiet Hours Setup Prompt | `Set Quiet Hours`                           | Quiet Hours Start Input     | No side effect                                                                   |
| Quiet Hours Start Input  | Valid start time (e.g., "22:00")              | Quiet Hours End Input       | Store start time in temporary state                                              |
| Quiet Hours End Input    | Valid end time (e.g., "07:00")                | Quiet Hours Confirmation Dialog | Store end time in temporary state                                                |
| Quiet Hours Confirmation Dialog | `Confirm`                             | Main Menu                 | Save quiet hours to user settings                                               |
| Morning Summary Toggle   | `Enable/Disable`                            | Main Menu                 | Set `summary_enabled` flag in user settings                                      |
| Alert Notification       | `Dismiss`                                   | Alert Notification          | Mark alert as acknowledged (no deletion)                                         |

---

## DATA  

### Entities  
1. **User**  
   - `telegram_id` (PK)  
   - `summary_enabled` (bool)  
   - `quiet_start` (HH:MM)  
   - `quiet_end` (HH:MM)  

2. **Watchlist**  
   - `user_id` (FK to User)  
   - `coin_symbol` (e.g., TON, USDT)  
   - PK: `(user_id, coin_symbol)`  

3. **AlertThreshold**  
   - `user_id` (FK to User)  
   - `coin_symbol` (FK to Watchlist)  
   - `threshold_type` (enum: `price_below`, `price_above`, `percent_change`)  
   - `value` (float)  
   - `last_alert_time` (timestamp)  
   - PK: `(user_id, coin_symbol, threshold_type)`  

4. **QuietHours**  
   - `user_id` (FK to User)  
   - `start_time` (HH:MM)  
   - `end_time` (HH:MM)  
   - PK: `user_id`  

5. **AlertHistory**  
   - `alert_id` (PK)  
   - `user_id` (FK to User)  
   - `coin_symbol` (FK to Watchlist)  
   - `triggered_at` (timestamp)  
   - `price` (float)  
   - `change_percent` (float)  

---

## ACCEPTANCE NOTES  

### Watchlist Management  
- Adding a coin must validate against supported TON symbols (e.g., TON, USDT, GRAM).  
- Removing a coin must delete all associated thresholds.  
- Empty watchlist must show "Your watchlist is empty. Use /watchlist to add coins!"  

### Threshold Alerts  
- Thresholds must trigger only when price crosses the boundary (not on minor fluctuations).  
- Consolidate alerts for coins fluctuating within 5% of a threshold for 1 hour.  
- Alerts must not be sent during quiet hours (even if threshold was triggered earlier).  

### Morning Summary  
- Fixed time (e.g., 08:00 UTC) with price/percentage change for all watched coins.  
- If >5 coins, use paginator with "Next" and "Previous" buttons.  

### Quiet Hours  
- Time range must be stored as 24h format (e.g., 22:00–07:00).  
- Must suppress all alerts during the defined range.  
- Confirmation dialog must validate start/end time order.  

### Owner View  
- Admin must see total users, top 5 most-fired alerts, and last 10 API errors.  
- Non-admin users must receive "You don't have access to the owner dashboard."  

### Error Handling  
- API errors must retry after 5 minutes (3 retries max).  
- Failed price checks must show "Failed to fetch price data. Retrying in 5 minutes..."  
- Invalid commands must return to Main Menu with "Invalid command. Use /help for options."  

### Timeout Mechanism  
- Any setup operation (e.g., Threshold Setup, Quiet Hours Setup) must timeout after 5 minutes of inactivity.  
- Timeout must return to Main Menu with "Operation timed out. Use /thresholds to try again."  

### /cancel Command  
- `/cancel` must abort any ongoing operation and return to Main Menu.  
- Must be available in all input screens (e.g., Coin Symbol Input, Quiet Hours Input).