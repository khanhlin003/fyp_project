"""
ETF Metrics API Routes
Endpoints for calculated ETF performance metrics
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from pydantic import BaseModel

from app.database import SessionLocal
from app.models import ETF
from app.services.metrics import get_etf_metrics
from sqlalchemy import select

router = APIRouter()


class MetricsData(BaseModel):
    return_1m: Optional[float] = None
    return_3m: Optional[float] = None
    return_6m: Optional[float] = None
    return_ytd: Optional[float] = None
    return_1y: Optional[float] = None
    return_3y: Optional[float] = None
    return_5y: Optional[float] = None
    volatility: Optional[float] = None
    beta: Optional[float] = None
    sharpe_ratio: Optional[float] = None
    max_drawdown: Optional[float] = None
    week_52_high: Optional[float] = None
    week_52_low: Optional[float] = None
    risk_free_rate_used: Optional[float] = None


class ETFMetricsResponse(BaseModel):
    ticker: str
    latest_price: Optional[float]
    latest_date: Optional[str]
    data_points: int
    metrics: MetricsData


@router.get("/{ticker}/metrics", response_model=ETFMetricsResponse)
async def get_metrics(ticker: str):
    """
    Get calculated performance metrics for an ETF
    
    Metrics calculated from historical price data:
    - **Returns**: 1M, 3M, 6M, YTD, 1Y, 3Y, 5Y percentage returns
    - **Volatility**: Annualized standard deviation of daily returns
    - **Beta**: Correlation with S&P 500 (SPY)
    - **Sharpe Ratio**: Risk-adjusted return measure
    - **Max Drawdown**: Largest peak-to-trough decline (last 1 year)
    - **52-Week High/Low**: Highest and lowest prices in the last year
    
    All calculations are done on-demand using the latest available price data.
    """
    session = SessionLocal()
    
    try:
        # Verify ETF exists
        etf_query = select(ETF).where(ETF.ticker == ticker.upper())
        etf = session.execute(etf_query).scalar_one_or_none()
        
        if not etf:
            raise HTTPException(status_code=404, detail=f"ETF with ticker '{ticker}' not found")
        
        # Calculate metrics
        result = get_etf_metrics(session, ticker)
        
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        
        return ETFMetricsResponse(
            ticker=result["ticker"],
            latest_price=result["latest_price"],
            latest_date=result["latest_date"],
            data_points=result["data_points"],
            metrics=MetricsData(**result["metrics"])
        )
    
    finally:
        session.close()


@router.get("/metrics/batch")
async def get_batch_metrics(
    tickers: str = Query(..., description="Comma-separated list of tickers (max 10)"),
):
    """
    Get metrics for multiple ETFs at once
    
    - **tickers**: Comma-separated list of ticker symbols (e.g., "SPY,QQQ,VOO")
    
    Returns metrics for each valid ticker. Invalid tickers are skipped.
    Maximum 10 tickers per request.
    """
    ticker_list = [t.strip().upper() for t in tickers.split(",")][:10]
    
    session = SessionLocal()
    results = []
    
    try:
        for ticker in ticker_list:
            try:
                # Verify ETF exists
                etf_query = select(ETF).where(ETF.ticker == ticker)
                etf = session.execute(etf_query).scalar_one_or_none()
                
                if etf:
                    result = get_etf_metrics(session, ticker)
                    if "error" not in result:
                        results.append(result)
            except Exception:
                continue
        
        return {
            "count": len(results),
            "requested": len(ticker_list),
            "results": results
        }
    
    finally:
        session.close()


@router.get("/metrics/compare")
async def compare_etfs(
    tickers: str = Query(..., description="Comma-separated list of tickers to compare (2-5)"),
):
    """
    Compare key metrics between multiple ETFs
    
    - **tickers**: Comma-separated list of ticker symbols (e.g., "SPY,QQQ,VOO")
    
    Returns a comparison table with key metrics for each ETF.
    Requires 2-5 tickers.
    """
    ticker_list = [t.strip().upper() for t in tickers.split(",")]
    
    if len(ticker_list) < 2:
        raise HTTPException(status_code=400, detail="At least 2 tickers required for comparison")
    if len(ticker_list) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 tickers allowed for comparison")
    
    session = SessionLocal()
    comparison = []
    
    try:
        for ticker in ticker_list:
            etf_query = select(ETF).where(ETF.ticker == ticker)
            etf = session.execute(etf_query).scalar_one_or_none()
            
            if not etf:
                comparison.append({
                    "ticker": ticker,
                    "error": "ETF not found"
                })
                continue
            
            result = get_etf_metrics(session, ticker)
            
            if "error" in result:
                comparison.append({
                    "ticker": ticker,
                    "error": result["error"]
                })
            else:
                metrics = result["metrics"]
                comparison.append({
                    "ticker": ticker,
                    "etf_name": etf.etf_name,
                    "latest_price": result["latest_price"],
                    "return_ytd": metrics["return_ytd"],
                    "return_1y": metrics["return_1y"],
                    "volatility": metrics["volatility"],
                    "beta": metrics["beta"],
                    "sharpe_ratio": metrics["sharpe_ratio"],
                    "max_drawdown": metrics["max_drawdown"],
                })
        
        return {
            "comparison": comparison,
            "metrics_description": {
                "return_ytd": "Year-to-date return (%)",
                "return_1y": "1-year return (%)",
                "volatility": "Annualized volatility (%)",
                "beta": "Market correlation (1 = market)",
                "sharpe_ratio": "Risk-adjusted return (higher is better)",
                "max_drawdown": "Worst decline from peak (%)"
            }
        }
    
    finally:
        session.close()
