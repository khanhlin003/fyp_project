"""
News API Endpoints
Provides access to news articles with sentiment analysis
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.services.news_service import (
    get_news_for_ticker,
    get_news_for_portfolio,
    get_news_alerts,
    refresh_news_for_tickers,
    refresh_news_for_single_etf,
)
from app.schemas import NewsArticleWithTickers, NewsResponse, NewsAlert
from app.models import Portfolio

router = APIRouter()


@router.get("/ticker/{ticker}", response_model=NewsResponse)
def get_ticker_news(
    ticker: str,
    limit: int = Query(20, ge=1, le=100, description="Max articles to return"),
    days: int = Query(7, ge=1, le=30, description="Articles from last N days"),
    db: Session = Depends(get_db)
):
    """
    Get news articles mentioning a specific ETF ticker
    
    Returns articles sorted by relevance and recency
    """
    articles = get_news_for_ticker(ticker.upper(), db, limit=limit, days=days)
    
    return NewsResponse(
        articles=articles,
        total=len(articles),
        ticker=ticker.upper()
    )


@router.get("/portfolio/{user_id}", response_model=NewsResponse)
def get_portfolio_news(
    user_id: int,
    limit: int = Query(30, ge=1, le=100),
    days: int = Query(7, ge=1, le=30),
    db: Session = Depends(get_db)
):
    """
    Get news for all ETFs in user's portfolio
    
    Requires user authentication (user_id)
    Returns aggregated news from all portfolio holdings
    """
    # Get user's portfolio holdings
    portfolios = db.query(Portfolio).filter(Portfolio.user_id == user_id).all()
    
    if not portfolios:
        raise HTTPException(status_code=404, detail="No portfolio found for this user")
    
    # Extract unique tickers
    tickers = list(set(p.ticker for p in portfolios))
    
    # Get news for all tickers
    articles = get_news_for_portfolio(tickers, db, limit=limit, days=days)
    
    return NewsResponse(
        articles=articles,
        total=len(articles),
        ticker=f"Portfolio ({len(tickers)} holdings)"
    )


@router.get("/alerts/{user_id}", response_model=List[NewsAlert])
def get_portfolio_alerts(
    user_id: int,
    days: int = Query(3, ge=1, le=7, description="Check last N days"),
    sentiment_threshold: float = Query(-0.3, ge=-1, le=0, description="Alert if sentiment below this"),
    relevance_threshold: float = Query(0.5, ge=0, le=1, description="Only high-relevance mentions"),
    db: Session = Depends(get_db)
):
    """
    Get high-impact negative news alerts for portfolio
    
    Returns articles with significant negative sentiment
    Used for notification badges and alerts
    """
    # Get user's portfolio holdings
    portfolios = db.query(Portfolio).filter(Portfolio.user_id == user_id).all()
    
    if not portfolios:
        return []
    
    tickers = list(set(p.ticker for p in portfolios))
    
    # Get alerts
    alerts = get_news_alerts(
        tickers,
        db,
        days=days,
        sentiment_threshold=sentiment_threshold,
        relevance_threshold=relevance_threshold
    )
    
    return alerts


@router.post("/refresh/top100", status_code=202)
def refresh_top_100_news(db: Session = Depends(get_db)):
    """
    Manually trigger refresh of top 100 ETFs news
    
    This is normally run by background scheduler
    Use carefully due to API rate limits (25/day)
    """
    # TODO: Get top 100 ETFs by AUM from database
    # For now, use a sample list
    top_etfs = ["SPY", "QQQ", "VTI", "IWM", "EFA", "AGG", "VWO", "GLD", "TLT", "LQD"]
    
    try:
        stats = refresh_news_for_tickers(top_etfs, db)
        return {
            "status": "success",
            "message": f"Refreshed news for {len(top_etfs)} ETFs",
            "stats": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/refresh/ticker/{ticker}", status_code=202)
def refresh_single_ticker_news(ticker: str, db: Session = Depends(get_db)):
    """
    Manually trigger refresh for a specific ticker.
    """
    symbol = ticker.upper().strip()
    if not symbol:
        raise HTTPException(status_code=400, detail="Ticker is required")

    try:
        stats = refresh_news_for_single_etf(symbol, db)
        return {
            "status": "success",
            "message": f"Refreshed news for {symbol} using ticker + ETF context",
            "stats": stats,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/refresh/portfolio/{user_id}", status_code=202)
def refresh_portfolio_news(user_id: int, db: Session = Depends(get_db)):
    """
    Manually trigger refresh for all tickers in a user's portfolio.
    """
    portfolios = db.query(Portfolio).filter(Portfolio.user_id == user_id).all()

    if not portfolios:
        raise HTTPException(status_code=404, detail="No portfolio found for this user")

    tickers = sorted(list(set(p.ticker for p in portfolios if p.ticker)))
    if not tickers:
        raise HTTPException(status_code=404, detail="No valid tickers found in portfolio")

    try:
        stats = refresh_news_for_tickers(tickers, db)
        return {
            "status": "success",
            "message": f"Refreshed news for {len(tickers)} portfolio tickers",
            "tickers": tickers,
            "stats": stats,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
