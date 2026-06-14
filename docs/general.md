# Telegram Crypto Watcher Bot - GENERAL Design Document  

## Summary  
The Telegram Crypto Watcher Bot is a tool for TON ecosystem users to monitor Toncoin (TON) and TON jettons (e.g., USDT, GRAM) with customizable price alerts and summaries. Users create private watchlists, set price thresholds, and receive consolidated notifications during active hours. The bot avoids spam by grouping alerts for minor price fluctuations and includes an admin dashboard for the owner to track usage statistics.  

---

## Core Entities  
- **User**: Telegram user with private watchlists, thresholds, and settings (e.g., quiet hours).  
- **Watchlist**: A collection of TON coins/jettons monitored by a user.  
- **Alert Threshold**: User-defined price/percentage triggers (e.g., "TON < $2.50", "USDT ±5% in 1h").  
- **Coin**: TON-based cryptocurrency (e.g., TON, USDT) with real-time price data from external APIs.  
- **Alert**: A notification generated when a coin's price crosses a threshold.  
- **Quiet Hours**: Time range during which alerts are suppressed.  

**Relationships**:  
- Users own multiple Watchlists and Alert Thresholds.  
- Watchlists contain multiple Coins.  
- Alert Thresholds are tied to specific Coins and Users.  
- Alerts are linked to Users, Coins, and Thresholds.  

---

## External Dependencies  
- **Telegram Bot API**:  
  - Inline buttons for watchlist management.  
  - Scheduled messages for morning summaries.  
  - User input handling (text commands, threshold definitions).  
- **Price Data APIs**:  
  - Real-time price feeds for TON and jettons (e.g., CoinGecko, TON-specific APIs).  
  - Fallback/retry mechanisms for API outages.  
- **Persistence**:  
  - Database to store user watchlists, thresholds, quiet hours, and alert history.  
- **Owner Dashboard**:  
  - Telegram notifications for alert frequency and user activity logs.  

---

## Full Feature List  
- **Watchlist Management**:  
  - Add/remove coins via inline buttons.  
  - View current watchlist contents.  
- **Threshold Alerts**:  
  - Set custom price thresholds (e.g., "TON below $X", "GRAM ±5% in 1h").  
  - Consolidate alerts for coins fluctuating around thresholds (no spam for minor movements).  
- **On-Demand Price Checks**:  
  - Reply with current price of any watched coin.  
- **Morning Summary**:  
  - Daily fixed-time summary of all watched coins' prices.  
- **Quiet Hours**:  
  - User-defined time range to suppress alerts (e.g., 22:00–07:00).  
- **Error Resilience**:  
  - Retry price checks on API failures; avoid sending partial/incomplete data.  
- **Owner View**:  
  - Track total users, most-fired alerts, and active watchlists.  
  - Receive error logs for API failures.  
- **Input Handling**:  
  - Gracefully reject typos/invalid thresholds (e.g., "Invalid coin symbol").  

---

## Non-Goals  
- No trading execution or market orders.  
- No complex charting/technical analysis (e.g., RSI, MACD).  
- No support for non-TON cryptocurrencies (e.g., Bitcoin, Ethereum).  
- Morning summary time is fixed (no user-defined scheduling).  
- No social features (e.g., shared watchlists, group alerts).  
- No payments or subscriptions.