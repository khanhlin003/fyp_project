"""
Update ETF Prices using Yahoo Finance CSV API
Compatible with Python 3.8+
"""
import sys
from pathlib import Path
from datetime import datetime, timedelta
import requests
import time
from sqlalchemy import text

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models import ETF

def get_last_update_date(db, ticker):
    """Get the last date we have data for a specific ticker"""
    result = db.execute(
        text("SELECT MAX(date) FROM etf_prices WHERE ticker = :ticker"),
        {"ticker": ticker}
    ).fetchone()
    return result[0] if result and result[0] else None

def fetch_yahoo_prices(ticker, start_date, end_date):
    """
    Fetch price data from Yahoo Finance using Chart API (v8)
    """
    try:
        # Convert dates to Unix timestamps
        start_ts = int(start_date.timestamp())
        end_ts = int(end_date.timestamp())
        
        # First, get a crumb by visiting the main page
        session = requests.Session()
        session.headers.update({
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        })
        
        # Yahoo Finance Chart API (v8)
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
        params = {
            "period1": start_ts,
            "period2": end_ts,
            "interval": "1d",
            "includePrePost": "false",
        }
        
        response = session.get(url, params=params, timeout=30)
        response.raise_for_status()
        
        # Parse JSON response
        result = response.json()
        
        if "chart" not in result or "result" not in result["chart"]:
            return []
        
        chart_result = result["chart"]["result"]
        if not chart_result or len(chart_result) == 0:
            return []
        
        quote = chart_result[0]
        
        # Extract timestamps and OHLCV data
        timestamps = quote.get("timestamp", [])
        indicators = quote.get("indicators", {})
        
        if "quote" not in indicators or len(indicators["quote"]) == 0:
            return []
        
        quote_data = indicators["quote"][0]
        
        opens = quote_data.get("open", [])
        highs = quote_data.get("high", [])
        lows = quote_data.get("low", [])
        closes = quote_data.get("close", [])
        volumes = quote_data.get("volume", [])
        
        # Build data array
        data = []
        for i in range(len(timestamps)):
            # Skip if any value is None
            if (closes[i] is None or opens[i] is None or 
                highs[i] is None or lows[i] is None):
                continue
            
            date_str = datetime.fromtimestamp(timestamps[i]).strftime('%Y-%m-%d')
            
            data.append({
                'date': date_str,
                'open': float(opens[i]),
                'high': float(highs[i]),
                'low': float(lows[i]),
                'close': float(closes[i]),
                'volume': int(volumes[i]) if volumes[i] is not None else 0
            })
        
        return data
    
    except Exception as e:
        print(f"  ❌ API Error: {str(e)}")
        return []

def update_ticker_prices(db, ticker, start_date=None, end_date=None):
    """Update prices for a single ticker"""
    try:
        # Default to last 60 days if no start date provided
        if not start_date:
            start_date = datetime.now() - timedelta(days=60)
        if not end_date:
            end_date = datetime.now()
        
        # Ensure start_date and end_date are datetime objects
        if isinstance(start_date, datetime):
            start_dt = start_date
        else:
            start_dt = datetime.combine(start_date, datetime.min.time())
        
        if isinstance(end_date, datetime):
            end_dt = end_date
        else:
            end_dt = datetime.combine(end_date, datetime.min.time())
        
        print(f"  📥 Fetching from {start_dt.date()} to {end_dt.date()}...")
        
        # Fetch data from Yahoo Finance
        data = fetch_yahoo_prices(ticker, start_dt, end_dt)
        
        if not data:
            print(f"  ⚠️  No data received")
            return 0
        
        # Insert/update prices
        count = 0
        for row in data:
            # Check if record exists
            existing = db.execute(
                text("SELECT id FROM etf_prices WHERE ticker = :ticker AND date = :date"),
                {"ticker": ticker, "date": row['date']}
            ).fetchone()
            
            if existing:
                # Update existing record
                db.execute(
                    text("""
                        UPDATE etf_prices 
                        SET open = :open, high = :high, low = :low, 
                            close = :close, volume = :volume
                        WHERE ticker = :ticker AND date = :date
                    """),
                    {
                        "ticker": ticker,
                        "date": row['date'],
                        "open": row['open'],
                        "high": row['high'],
                        "low": row['low'],
                        "close": row['close'],
                        "volume": row['volume']
                    }
                )
            else:
                # Insert new record
                db.execute(
                    text("""
                        INSERT INTO etf_prices (ticker, date, open, high, low, close, volume)
                        VALUES (:ticker, :date, :open, :high, :low, :close, :volume)
                    """),
                    {
                        "ticker": ticker,
                        "date": row['date'],
                        "open": row['open'],
                        "high": row['high'],
                        "low": row['low'],
                        "close": row['close'],
                        "volume": row['volume']
                    }
                )
            count += 1
        
        db.commit()
        print(f"  ✅ Updated {count} records")
        return count
        
    except Exception as e:
        print(f"  ❌ Error: {str(e)}")
        db.rollback()
        return 0

def update_top_etfs(db, top_n=100):
    """Update prices for top N ETFs by AUM"""
    # Get top ETFs with proper AUM parsing
    query = text("""
        SELECT ticker, etf_name, aum FROM etfs 
        WHERE aum IS NOT NULL AND aum != 'N/A'
        ORDER BY 
            CASE 
                WHEN aum LIKE '%B' THEN CAST(REPLACE(REPLACE(aum, '$', ''), 'B', '') AS FLOAT) * 1000
                WHEN aum LIKE '%M' THEN CAST(REPLACE(REPLACE(aum, '$', ''), 'M', '') AS FLOAT)
                ELSE 0
            END DESC
        LIMIT :limit
    """)
    
    result = db.execute(query, {"limit": top_n}).fetchall()
    tickers = [(row[0], row[1], row[2]) for row in result]
    
    print(f"🚀 Updating top {len(tickers)} ETFs by AUM...")
    print("=" * 70)
    
    success_count = 0
    total_records = 0
    
    for i, (ticker, name, aum) in enumerate(tickers, 1):
        print(f"\n[{i}/{len(tickers)}] {ticker} - {name} (AUM: {aum})")
        
        last_date = get_last_update_date(db, ticker)
        
        # If we have data, only fetch from last date + 1
        if last_date:
            # Convert date to datetime if needed
            if isinstance(last_date, datetime):
                fetch_start = last_date + timedelta(days=1)
            else:
                fetch_start = datetime.combine(last_date, datetime.min.time()) + timedelta(days=1)
            print(f"  Last update: {last_date}")
            
            # Skip if already up to date
            if fetch_start.date() >= datetime.now().date():
                print(f"  ✓ Already up to date")
                continue
        else:
            # No data yet, fetch last 60 days
            fetch_start = datetime.now() - timedelta(days=60)
            print(f"  No existing data")
        
        records = update_ticker_prices(db, ticker, start_date=fetch_start)
        
        if records > 0:
            success_count += 1
            total_records += records
        
        # Rate limiting - be nice to Yahoo Finance
        if i < len(tickers):
            time.sleep(0.5)
    
    print("\n" + "=" * 70)
    print(f"✨ Update Complete!")
    print(f"  - ETFs updated: {success_count}/{len(tickers)}")
    print(f"  - Total records added/updated: {total_records}")
    print(f"  - Date range: {fetch_start.date()} to {datetime.now().date()}")

if __name__ == "__main__":
    db = SessionLocal()
    
    try:
        # Parse command line arguments
        mode = sys.argv[1] if len(sys.argv) > 1 else "top"
        
        if mode == "top":
            # Update top N ETFs
            top_n = int(sys.argv[2]) if len(sys.argv) > 2 else 100
            update_top_etfs(db, top_n=top_n)
        
        elif mode == "ticker":
            # Update specific ticker(s)
            if len(sys.argv) < 3:
                print("Usage: python update_prices_simple.py ticker SPY QQQ VOO")
                sys.exit(1)
            
            tickers = sys.argv[2:]
            print(f"🚀 Updating {len(tickers)} specific ticker(s)...")
            print("=" * 70)
            
            success = 0
            total = 0
            
            for i, ticker in enumerate(tickers, 1):
                print(f"\n[{i}/{len(tickers)}] {ticker}")
                last_date = get_last_update_date(db, ticker)
                
                if last_date:
                    # Convert date to datetime if needed
                    if isinstance(last_date, datetime):
                        fetch_start = last_date + timedelta(days=1)
                    else:
                        fetch_start = datetime.combine(last_date, datetime.min.time()) + timedelta(days=1)
                    print(f"  Last update: {last_date}")
                else:
                    fetch_start = datetime.now() - timedelta(days=60)
                
                records = update_ticker_prices(db, ticker, start_date=fetch_start)
                if records > 0:
                    success += 1
                    total += records
                
                if i < len(tickers):
                    time.sleep(0.5)
            
            print(f"\n✨ Updated {success}/{len(tickers)} tickers ({total} records)")
        
        else:
            print("Usage:")
            print("  python update_prices_simple.py top [N]        - Update top N ETFs by AUM (default: 100)")
            print("  python update_prices_simple.py ticker SPY QQQ - Update specific ticker(s)")
            sys.exit(1)
    
    finally:
        db.close()
