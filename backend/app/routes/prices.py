"""
Price History API Routes
Endpoints for ETF historical price data
"""
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select, func
from datetime import datetime, timedelta
from typing import Optional
from app.database import SessionLocal
from app.models import ETFPrice, ETF
from app.schemas import PriceHistory, PriceData

router = APIRouter()


@router.get("/{ticker}/prices", response_model=PriceHistory)
async def get_price_history(
    ticker: str,
    days: Optional[int] = Query(365, description="Number of days of historical data"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)")
):
    """
    Get historical price data for an ETF
    
    - **ticker**: ETF ticker symbol
    - **days**: Number of days to retrieve (default: 365, max: 5475 for 15 years)
    - **start_date**: Optional start date in YYYY-MM-DD format
    - **end_date**: Optional end date in YYYY-MM-DD format
    
    Returns OHLCV (Open, High, Low, Close, Volume) data
    """
    session = SessionLocal()
    
    try:
        # Verify ETF exists
        etf_query = select(ETF).where(ETF.ticker == ticker.upper())
        etf = session.execute(etf_query).scalar_one_or_none()
        
        if not etf:
            raise HTTPException(status_code=404, detail=f"ETF with ticker '{ticker}' not found")
        
        # Build query
        query = select(ETFPrice).where(ETFPrice.ticker == ticker.upper())
        
        # Apply date filters
        if start_date and end_date:
            try:
                start = datetime.strptime(start_date, "%Y-%m-%d").date()
                end = datetime.strptime(end_date, "%Y-%m-%d").date()
                query = query.where(ETFPrice.date >= start, ETFPrice.date <= end)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        else:
            # Use days parameter
            end_date_obj = datetime.now().date()
            start_date_obj = end_date_obj - timedelta(days=days)
            query = query.where(ETFPrice.date >= start_date_obj)
        
        # Order by date ascending
        query = query.order_by(ETFPrice.date.asc())
        
        # Execute query
        result = session.execute(query)
        prices = result.scalars().all()
        
        if not prices:
            raise HTTPException(
                status_code=404, 
                detail=f"No price data found for ticker '{ticker}' in the specified date range"
            )
        
        # Get date range
        date_range = {
            "start": prices[0].date.isoformat(),
            "end": prices[-1].date.isoformat()
        }
        
        return PriceHistory(
            ticker=ticker.upper(),
            total_records=len(prices),
            date_range=date_range,
            prices=[PriceData.model_validate(price) for price in prices]
        )
    
    finally:
        session.close()


@router.get("/{ticker}/prices/latest")
async def get_latest_price(ticker: str):
    """
    Get the most recent price for an ETF
    
    - **ticker**: ETF ticker symbol
    
    Returns the latest available OHLCV data
    """
    session = SessionLocal()
    
    try:
        # Verify ETF exists
        etf_query = select(ETF).where(ETF.ticker == ticker.upper())
        etf = session.execute(etf_query).scalar_one_or_none()
        
        if not etf:
            raise HTTPException(status_code=404, detail=f"ETF with ticker '{ticker}' not found")
        
        # Get latest price
        query = (
            select(ETFPrice)
            .where(ETFPrice.ticker == ticker.upper())
            .order_by(ETFPrice.date.desc())
            .limit(1)
        )
        
        result = session.execute(query)
        price = result.scalar_one_or_none()
        
        if not price:
            raise HTTPException(
                status_code=404, 
                detail=f"No price data found for ticker '{ticker}'"
            )
        
        return {
            "ticker": ticker.upper(),
            "date": price.date.isoformat(),
            "open": price.open,
            "high": price.high,
            "low": price.low,
            "close": price.close,
            "volume": price.volume
        }
    
    finally:
        session.close()


@router.get("/{ticker}/prices/chart")
async def get_chart_data(
    ticker: str,
    period: str = Query("1y", description="Time period: 1m, 3m, 6m, 1y, 3y, 5y, max")
):
    """
    Get price data formatted for charts
    
    - **ticker**: ETF ticker symbol
    - **period**: Time period (1m, 3m, 6m, 1y, 3y, 5y, max)
    
    Returns simplified data optimized for frontend charting libraries
    """
    session = SessionLocal()
    
    try:
        # Verify ETF exists
        etf_query = select(ETF).where(ETF.ticker == ticker.upper())
        etf = session.execute(etf_query).scalar_one_or_none()
        
        if not etf:
            raise HTTPException(status_code=404, detail=f"ETF with ticker '{ticker}' not found")
        
        # Map period to days
        period_days = {
            "1m": 30,
            "3m": 90,
            "6m": 180,
            "1y": 365,
            "3y": 1095,
            "5y": 1825,
            "max": 5475  # 15 years
        }
        
        if period not in period_days:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid period. Choose from: {', '.join(period_days.keys())}"
            )
        
        days = period_days[period]
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=days)
        
        # Query prices
        query = (
            select(ETFPrice)
            .where(ETFPrice.ticker == ticker.upper())
            .where(ETFPrice.date >= start_date)
            .order_by(ETFPrice.date.asc())
        )
        
        result = session.execute(query)
        prices = result.scalars().all()
        
        if not prices:
            raise HTTPException(
                status_code=404, 
                detail=f"No price data found for ticker '{ticker}' in the last {period}"
            )
        
        # Format for charts (simplified)
        chart_data = [
            {
                "date": price.date.isoformat(),
                "close": float(price.close) if price.close else None,
                "volume": price.volume
            }
            for price in prices
        ]
        
        # Calculate basic statistics
        closes = [float(p.close) for p in prices if p.close]
        if closes:
            price_change = closes[-1] - closes[0]
            price_change_pct = (price_change / closes[0]) * 100 if closes[0] else 0
        else:
            price_change = 0
            price_change_pct = 0
        
        return {
            "ticker": ticker.upper(),
            "period": period,
            "data": chart_data,
            "summary": {
                "start_price": closes[0] if closes else None,
                "end_price": closes[-1] if closes else None,
                "change": round(price_change, 2),
                "change_percent": round(price_change_pct, 2),
                "data_points": len(chart_data)
            }
        }
    
    finally:
        session.close()
