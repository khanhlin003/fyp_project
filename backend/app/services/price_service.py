"""
Price refresh service — batch OHLCV updates via yfinance.

Called by the APScheduler job in main.py (automated daily refresh)
and by scripts/update_prices_simple.py (manual CLI runs).
"""
import logging
import time
from datetime import datetime, timedelta, date
from typing import List, Dict, Optional

import yfinance as yf
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import text

logger = logging.getLogger(__name__)

BATCH_SIZE = 50        # yfinance batch download — safe upper bound per call
BATCH_SLEEP_SEC = 1.0  # courtesy delay between batches to avoid rate limits


def _get_all_tickers(db: Session) -> List[str]:
    rows = db.execute(text("SELECT ticker FROM etfs ORDER BY ticker")).fetchall()
    return [r[0] for r in rows]


def _get_last_price_dates(db: Session, tickers: List[str]) -> Dict[str, date]:
    """Return {ticker: last_stored_date} for tickers that have any price data."""
    rows = db.execute(
        text("""
            SELECT ticker, MAX(date) AS last_date
            FROM etf_prices
            WHERE ticker = ANY(:tickers)
            GROUP BY ticker
        """),
        {"tickers": tickers},
    ).fetchall()
    return {r[0]: r[1] for r in rows}


def _get_existing_pairs(db: Session, tickers: List[str], since: date) -> set:
    """Return set of (ticker, date_str) already in DB for the given date range."""
    rows = db.execute(
        text("""
            SELECT ticker, date::text
            FROM etf_prices
            WHERE ticker = ANY(:tickers) AND date >= :since
        """),
        {"tickers": tickers, "since": since},
    ).fetchall()
    return {(r[0], r[1]) for r in rows}


def _parse_download(data: pd.DataFrame, tickers: List[str]) -> Dict[str, List[dict]]:
    """Parse yf.download() result into {ticker: [row_dict, ...]}."""
    results: Dict[str, List[dict]] = {}
    if data.empty:
        return results

    def _row_dict(idx, row):
        return {
            "date": str(idx.date()),
            "open": round(float(row["Open"]), 4),
            "high": round(float(row["High"]), 4),
            "low": round(float(row["Low"]), 4),
            "close": round(float(row["Close"]), 4),
            "volume": int(row["Volume"]) if pd.notna(row.get("Volume")) else 0,
        }

    if len(tickers) == 1:
        ticker = tickers[0]
        df = data.dropna(subset=["Close"])
        results[ticker] = [_row_dict(idx, row) for idx, row in df.iterrows()]
    else:
        available = data.columns.get_level_values(0).unique()
        for ticker in tickers:
            if ticker not in available:
                continue
            df = data[ticker].dropna(subset=["Close"])
            if not df.empty:
                results[ticker] = [_row_dict(idx, row) for idx, row in df.iterrows()]

    return results


def _upsert_batch(db: Session, ticker: str, rows: List[dict], existing: set) -> int:
    """
    Insert new rows and update existing ones for a single ticker.
    Uses an in-memory existence set to avoid N+1 SELECT queries.
    """
    count = 0
    for row in rows:
        key = (ticker, row["date"])
        if key in existing:
            db.execute(
                text("""
                    UPDATE etf_prices
                    SET open = :open, high = :high, low = :low,
                        close = :close, volume = :volume
                    WHERE ticker = :ticker AND date = :date
                """),
                {"ticker": ticker, **row},
            )
        else:
            db.execute(
                text("""
                    INSERT INTO etf_prices (ticker, date, open, high, low, close, volume)
                    VALUES (:ticker, :date, :open, :high, :low, :close, :volume)
                """),
                {"ticker": ticker, **row},
            )
        count += 1
    db.commit()
    return count


def refresh_all_prices(
    db: Session,
    tickers: Optional[List[str]] = None,
    default_lookback_days: int = 7,
) -> dict:
    """
    Incrementally refresh OHLCV prices for all (or specified) ETFs via yfinance.

    - Fetches only the missing date window per ticker (incremental).
    - Groups tickers into batches of BATCH_SIZE for efficient bulk downloads.
    - Skips tickers whose prices are already up to date.

    Args:
        db: SQLAlchemy session.
        tickers: Optional list of specific tickers. If None, refreshes all ETFs.
        default_lookback_days: Days to look back for tickers with no existing data.

    Returns:
        dict with keys "tickers_processed", "records_upserted", "tickers_failed".
    """
    all_tickers = tickers if tickers else _get_all_tickers(db)
    if not all_tickers:
        logger.warning("No ETFs found — skipping price refresh.")
        return {}

    logger.info(f"Price refresh: checking {len(all_tickers)} ETFs...")

    today = datetime.now().date()
    last_dates = _get_last_price_dates(db, all_tickers)

    # Determine which tickers actually need updating and their earliest start date
    needs_update: List[tuple] = []
    for ticker in all_tickers:
        last = last_dates.get(ticker)
        start = (last + timedelta(days=1)) if last else (today - timedelta(days=default_lookback_days))
        if start < today:
            needs_update.append((ticker, start))

    if not needs_update:
        logger.info("All prices are already up to date.")
        return {"tickers_processed": 0, "records_upserted": 0, "tickers_failed": 0}

    # Use the earliest start across all tickers as the unified fetch window
    min_start = min(s for _, s in needs_update)
    ticker_list = [t for t, _ in needs_update]
    start_str = min_start.strftime("%Y-%m-%d")
    end_str = (today + timedelta(days=1)).strftime("%Y-%m-%d")

    logger.info(
        f"Fetching {len(ticker_list)} tickers | window: {start_str} → {end_str} "
        f"| batches of {BATCH_SIZE}"
    )

    stats = {"tickers_processed": 0, "records_upserted": 0, "tickers_failed": 0}
    batches = [ticker_list[i:i + BATCH_SIZE] for i in range(0, len(ticker_list), BATCH_SIZE)]

    for i, batch in enumerate(batches, 1):
        try:
            logger.info(f"Batch {i}/{len(batches)} — {len(batch)} tickers")

            raw = yf.download(
                tickers=" ".join(batch),
                start=start_str,
                end=end_str,
                group_by="ticker",
                auto_adjust=True,
                progress=False,
                threads=True,
            )

            parsed = _parse_download(raw, batch)
            existing = _get_existing_pairs(db, batch, min_start)

            for ticker, rows in parsed.items():
                # Filter to rows strictly after the last stored date
                last = last_dates.get(ticker)
                if last:
                    rows = [r for r in rows if r["date"] > str(last)]
                if rows:
                    stats["records_upserted"] += _upsert_batch(db, ticker, rows, existing)
                stats["tickers_processed"] += 1

        except Exception as e:
            logger.error(f"Batch {i} failed: {e}")
            stats["tickers_failed"] += len(batch)

        if i < len(batches):
            time.sleep(BATCH_SLEEP_SEC)

    logger.info(f"Price refresh complete: {stats}")
    return stats
