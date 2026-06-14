# Telegram Crypto Watcher Bot - DETAILS Design Document  

---

## SCREENS  

### 1. Main Menu  
**Trigger:** `/start`, `/help`, or after any operation  
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
- `/watchlist` → Watchlist Management Screen  
- `/price` → Price Request Prompt  
- `/thresholds` → Threshold Setup Prompt  
- `/quiet` → Quiet Hours Setup Prompt  
- `/summary` → Morning Summary Toggle  
- `/owner` → Owner Dashboard (if admin)  
- Invalid input → Main Menu with error message  

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
- `Add Coin` → Coin Symbol Input Screen  
- `View Watchlist` → Watchlist Items Screen  
- Invalid input → Main Menu  

---

### 3. Watchlist Items Screen  
**Trigger:** View Watchlist button  
**Message:**  
For each coin in watchlist:  
```
[Remove TON] [Set Threshold for TON]  
[Remove USDT] [Set Threshold for USDT]  
[Remove GRAM] [Set Threshold for GRAM]  
```
**Transitions:**  
- `Remove [Coin]` → Remove Coin Confirmation  
- `Set Threshold for [Coin]` → Threshold Setup (specific coin)  
- Back → Main Menu  

---

### 4. Threshold Setup  
**Trigger:** `/thresholds` or "Set Threshold for [Coin]"  
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
- `Cancel` → Main Menu  

---

### 5. Quiet Hours Setup  
**Trigger:** `/quiet`  
**Message:**  
```
Set your quiet hours (e.g., 22:00–07:00).  
Current quiet hours: [Start Time] to [End Time]  
```
**Keyboard (inline):**  
```
[Set Quiet Hours]  
```
**Transitions:**  
- `Set Quiet Hours` → Quiet Hours Input Screen  
- Back → Main Menu  

---

### 6. Quiet Hours Input Screen  
**Trigger:** Set Quiet Hours button  
**Message:**  
```
Enter start time (24h format, e.g., 22:00):  
```
**Keyboard:**  
```
[Cancel]  
```
**Transitions:**  
- Valid start time → Prompt for end time  
- Invalid time → Error message + Quiet Hours Input Screen (retry)  
- `Cancel` → Main Menu  

---

### 7. Morning Summary Toggle  
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
- Back → Main Menu  

---

### 8. Price Request Prompt  
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
- `Cancel` → Main Menu  

---

### 9. Owner Dashboard  
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
- Back → Main Menu (admin)  

---

### 10. Alert Notification  
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
- `Dismiss` → No action (user must manually acknowledge)  

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

---

### 2. Quiet Hours Confirmation Dialog  
**Props:**  
- `startTime`: User-provided start time (HH:MM)  
- `endTime`: User-provided end time (HH:MM)  

**Behavior:**  
- Displays time range and asks for confirmation.  
- Rejects invalid time ranges (e.g., start > end).  

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
| Watchlist Management     | `Add Coin`                                  | Coin Symbol Input           | No side effect                                                                   |
| Coin Symbol Input        | Valid coin symbol (e.g., "USDT")              | Threshold Setup (specific coin) | Save coin to watchlist                                                           |
| Coin Symbol Input        | Invalid coin symbol                           | Watchlist Management          | Show error message                                                               |
| Watchlist Items          | `Remove [Coin]`                             | Remove Coin Confirmation    | No side effect                                                                   |
| Remove Coin Confirmation | Confirm                                       | Watchlist Items             | Remove coin from watchlist                                                       |
| Threshold Setup          | Valid threshold (e.g., "TON below $2.50")     | Main Menu                 | Save threshold to database                                                      |
| Quiet Hours Input        | Valid start time (e.g., "22:00")              | Quiet Hours Input (end time) | Store start time in temporary state                                              |
| Quiet Hours Input (end)  | Valid end time (e.g., "07:00")                | Main Menu                 | Save quiet hours to user settings                                               |
| Morning Summary Toggle   | `Enable Morning Summary`                    | Main Menu                 | Set `summary_enabled` flag in user settings                                      |
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

### Owner View  
- Admin must see total users, top 5 most-fired alerts, and last 10 API errors.  
- Non-admin users must receive "You don't have access to the owner dashboard."  

### Error Handling  
- API errors must retry after 5 minutes (3 retries max).  
- Failed price checks must show "Failed to fetch price data. Retrying in 5 minutes..."  
- Invalid commands must return to Main Menu with "Invalid command. Use /help for options."