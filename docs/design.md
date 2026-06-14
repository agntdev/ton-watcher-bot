# Telegram Crypto Watcher Bot - UX SPEC  

## COMMAND TREE  
| Command        | Description                                                                 |  
|----------------|-----------------------------------------------------------------------------|  
| `/start`       | Initialize user profile, show welcome message with main menu.               |  
| `/help`        | Display help text with command list and brief explanations.                 |  
| `/watchlist`   | Show current watchlist with inline buttons to add/remove coins.             |  
| `/thresholds`  | Prompt user to define price thresholds (e.g., "TON below $2.50").           |  
| `/price`       | Request on-demand price check for a specific coin (e.g., `/price TON`).     |  
| `/summary`     | Toggle morning summary subscription (enable/disable).                       |  
| `/quiet`       | Set quiet hours (prompt for start/end times).                               |  
| `/owner`       | (Admin-only) Show owner dashboard with usage stats and alert frequency.     |  
| `/cancel`      | Cancel current operation (e.g., threshold setup).                           |  

---

## DIALOG STATE MACHINE  
**States:**  
1. **Main Menu**  
   - Triggers: `/start`, `/help`, `/watchlist`, `/price`, `/summary`, `/quiet`, `/owner`  
2. **Threshold Setup**  
   - Triggers: `/thresholds` → prompt for coin symbol → prompt for threshold (e.g., "GRAM +5% in 1h")  
3. **Quiet Hours Setup**  
   - Triggers: `/quiet` → prompt for start time → prompt for end time  
4. **Price Request**  
   - Triggers: `/price` → prompt for coin symbol  
5. **Owner Dashboard**  
   - Triggers: `/owner` (admin-only)  

**Transitions:**  
- Invalid input in any state → return to Main Menu with error message.  
- Timeout (e.g., user doesn't complete threshold setup in 5 minutes) → cancel operation and return to Main Menu.  

---

## INLINE-KEYBOARD LAYOUTS  
### Watchlist Management  
```  
[Add Coin] [View Watchlist]  
```  
**View Watchlist Screen:**  
For each coin in watchlist:  
```  
[Remove TON] [Set Threshold for TON]  
[Remove USDT] [Set Threshold for USDT]  
```  

### Morning Summary Toggle  
```  
[Enable Morning Summary] / [Disable Morning Summary]  
```  

### Quiet Hours Setup  
```  
[Set Quiet Hours]  
```  
**After entering start/end times:**  
```  
[Confirm] [Cancel]  
```  

### Owner Dashboard  
```  
[View Alert Stats] [View User Activity]  
```  

---

## MESSAGE COPY & TONE  
**Welcome Message:**  
"Hi! I'm your TON crypto watcher. Use /watchlist to track coins, /thresholds to set alerts, and /summary to get daily updates. Type /help for all commands!"  

**Watchlist Add Confirmation:**  
"TON added to your watchlist! You'll now receive alerts for price changes."  

**Threshold Alert (Example):**  
"⚠️ Alert: TON dropped below $2.50 (current: $2.48)! Your threshold was triggered."  

**Price Check Response:**  
"TON is currently $2.52 (+1.2% in 1h). Last updated: 2024-03-25 14:30 UTC."  

**Morning Summary (Example):**  
"🌅 Morning Summary (2024-03-25):  
- TON: $2.52 (+1.2% in 1h)  
- USDT: $0.98 (-0.5% in 1h)"  

**Error Handling:**  
- Invalid coin symbol: "Hmm, I don't recognize that coin. Try TON, USDT, or GRAM."  
- API error: "Failed to fetch price data. Retrying in 5 minutes..."  

---

## EDGE CASES  
- **Invalid Threshold Input:**  
  - "Invalid format. Use: [coin] [below/above] [price] or [coin] [±X%] in [1h/24h]."  
- **Quiet Hours Conflict:**  
  - "Quiet hours already active from 22:00–07:00. Would you like to update them?"  
- **Empty Watchlist:**  
  - "Your watchlist is empty. Use /watchlist to add coins!"  
- **Permission Errors:**  
  - "You don't have access to the owner dashboard."  
- **Timeout During Setup:**  
  - "Operation timed out. Use /thresholds to try again."  

---

## i18n (Translatable Strings)  
**User-Facing Strings:**  
- Button labels: "Add Coin", "Remove TON", "Set Threshold"  
- Alert messages: "⚠️ Alert: [coin] [action] [value]!"  
- Error messages: "Invalid coin symbol. Try TON, USDT, or GRAM."  
- Morning summary header: "🌅 Morning Summary (YYYY-MM-DD):"  
- Owner dashboard labels: "Total Users", "Top Alerts"  

**Non-Translatable:**  
- Coin symbols (TON, USDT, GRAM)  
- Time formats (24h clock, UTC)  
- API error codes (if shown to owner)