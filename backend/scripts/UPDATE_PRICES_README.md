# ETF Price Data Update Guide

## Problem
- Current price data is outdated (last update: 2025-12-04)
- YTD return showing "N/A" on ETF details page because data is stale
- Need to regularly update prices from Yahoo Finance

## Solution: Manual Price Update Script

### Script Location
```
backend/scripts/update_prices_simple.py
```

### Requirements
- Python 3.8+ (current version compatible)
- `requests` library (already installed)
- Database connection to Supabase

### Usage

#### 1. Update Top 100 ETFs (Recommended)
Updates the top 100 ETFs by AUM (Assets Under Management):

```bash
cd /Users/linhtrankhanh/Downloads/fyp/project/backend
/Users/linhtrankhanh/Downloads/fyp/project/venv/bin/python scripts/update_prices_simple.py top 100
```

**Time**: ~2-3 minutes (0.5s delay between requests)

#### 2. Update Specific Tickers
Update individual ETFs:

```bash
cd /Users/linhtrankhanh/Downloads/fyp/project/backend
/Users/linhtrankhanh/Downloads/fyp/project/venv/bin/python scripts/update_prices_simple.py ticker SPY QQQ VOO VTI
```

### How It Works

1. **Fetches latest data**: Gets prices from last update date + 1 day to today
2. **Smart detection**: Automatically detects last update date for each ticker
3. **Upsert logic**: Updates existing records or inserts new ones
4. **Rate limiting**: 0.5s delay between requests to avoid Yahoo Finance blocks
5. **Error handling**: Continues on errors, shows summary at end

### Output Example

```
🚀 Updating top 100 ETFs by AUM...
======================================================================

[1/100] SPY - SPDR S&P 500 ETF Trust (AUM: $550.5B)
  Last update: 2025-12-04
  📥 Fetching from 2025-12-05 to 2026-01-19...
  ✅ Updated 31 records

[2/100] QQQ - Invesco QQQ Trust (AUM: $280.3B)
  Last update: 2025-12-04
  📥 Fetching from 2025-12-05 to 2026-01-19...
  ✅ Updated 31 records

...

======================================================================
✨ Update Complete!
  - ETFs updated: 98/100
  - Total records added/updated: 3,038
  - Date range: 2025-12-05 to 2026-01-19
```

## Troubleshooting

### Issue: Yahoo Finance Rate Limiting (429 Error)
**Symptom**: `❌ API Error: 429 Client Error: Too Many Requests`

**Solutions**:
1. Wait 5-10 minutes before retrying
2. Reduce batch size: `top 50` instead of `top 100`
3. Use `ticker` mode for specific ETFs only
4. Run during off-peak hours (late night/early morning ET)

### Issue: No Data Received
**Symptom**: `⚠️ No data received`

**Possible Causes**:
- Ticker delisted or suspended
- Weekend/holiday (no new data)
- Ticker not available on Yahoo Finance (check ticker symbol)

### Issue: Already Up to Date
**Symptom**: `✓ Already up to date`

**Not an error** - Script detected prices are current, no update needed

## Automation Options

### Option 1: Python 3.9+ (Recommended Long-term)
Upgrade Python and use yfinance library for better reliability:

```bash
# Upgrade Python
brew install python@3.10

# Create new venv with Python 3.10
python3.10 -m venv venv-3.10

# Install requirements
source venv-3.10/bin/activate
pip install -r requirements.txt

# Use scripts/update_prices.py instead (has yfinance)
python scripts/update_prices.py top 100
```

### Option 2: Cron Job (Current Python 3.8)
Run update script daily at 6 PM ET:

```bash
# Edit crontab
crontab -e

# Add this line (adjust paths)
0 18 * * * cd /path/to/project/backend && /path/to/venv/bin/python scripts/update_prices_simple.py top 100 >> /tmp/etf_price_update.log 2>&1
```

### Option 3: APScheduler (Backend Service)
Add to `backend/app/main.py`:

```python
from apscheduler.schedulers.background import BackgroundScheduler
from .scripts.update_prices_simple import update_top_etfs
from .database import SessionLocal

scheduler = BackgroundScheduler()

def scheduled_price_update():
    db = SessionLocal()
    try:
        update_top_etfs(db, top_n=100)
    finally:
        db.close()

# Run daily at 6 PM ET
scheduler.add_job(
    scheduled_price_update,
    'cron',
    hour=18,
    timezone='America/New_York'
)

scheduler.start()
```

## Database Impact

- **Table**: `etf_prices`
- **Columns Updated**: `open`, `high`, `low`, `close`, `volume`
- **Operation**: `INSERT` for new dates, `UPDATE` for existing dates
- **Size**: ~31 records per ETF per month

### Current Database Stats
```sql
-- Check total records
SELECT COUNT(*) FROM etf_prices;  -- 5,793,153 rows

-- Check latest date per ticker
SELECT ticker, MAX(date) as latest_date 
FROM etf_prices 
GROUP BY ticker 
ORDER BY latest_date DESC 
LIMIT 10;

-- Check records added today
SELECT COUNT(*) FROM etf_prices WHERE date = CURRENT_DATE;
```

## ETF Details Page YTD Fix

Once prices are updated, the `/etfs/{ticker}/metrics` endpoint will automatically calculate YTD return:

```
YTD Return = (Current Price - Jan 1 Price) / Jan 1 Price * 100
```

**No code changes needed** - metrics are calculated dynamically from `etf_prices` table.

## Quick Start (TODAY)

To fix YTD return immediately:

```bash
# 1. Navigate to backend
cd /Users/linhtrankhanh/Downloads/fyp/project/backend

# 2. Update top 100 ETFs
/Users/linhtrankhanh/Downloads/fyp/project/venv/bin/python scripts/update_prices_simple.py top 100

# 3. Verify update (check SPY)
/Users/linhtrankhanh/Downloads/fyp/project/venv/bin/python -c "
from app.database import SessionLocal
from sqlalchemy import text
db = SessionLocal()
result = db.execute(text('SELECT MAX(date) FROM etf_prices WHERE ticker=\\'SPY\\''))
print('SPY latest date:', result.fetchone()[0])
db.close()
"

# 4. Test YTD endpoint
curl http://localhost:8000/etfs/SPY/metrics
```

## Notes

- **First run**: Fetches last 60 days if no data exists
- **Subsequent runs**: Only fetches from last update + 1 day
- **Singapore ETFs (.SI suffix)**: Supported, use full ticker (e.g., `ES3.SI`)
- **Market holidays**: No data available, script skips gracefully
- **Time zone**: All dates stored in UTC, Yahoo Finance uses market local time

## Support

For issues or questions:
1. Check `/tmp/etf_price_update.log` (if using cron)
2. Test with single ticker first: `ticker SPY`
3. Verify database connection: `psql $DATABASE_URL -c "SELECT COUNT(*) FROM etf_prices"`
