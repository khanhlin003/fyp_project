"""
CLI utility for manual ETF price updates.

All fetch and upsert logic lives in app/services/price_service.py.
The APScheduler job in app/main.py calls the same service automatically
weekdays at 8 PM ET, so this script is only needed for ad-hoc or backfill runs.

Usage:
  python scripts/update_prices_simple.py              # refresh all ETFs (incremental)
  python scripts/update_prices_simple.py SPY QQQ VOO  # refresh specific tickers only
"""
import sys
from pathlib import Path

# Add backend directory to path so app.* imports work
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.services.price_service import refresh_all_prices

if __name__ == "__main__":
    tickers = sys.argv[1:] if len(sys.argv) > 1 else None

    if tickers:
        print(f"🚀 Refreshing {len(tickers)} specific ticker(s): {', '.join(tickers)}")
    else:
        print("🚀 Refreshing all ETFs incrementally...")

    db = SessionLocal()
    try:
        stats = refresh_all_prices(db, tickers=tickers)
        print(f"✅ Done: {stats}")
    except Exception as e:
        print(f"❌ Failed: {e}")
        sys.exit(1)
    finally:
        db.close()
