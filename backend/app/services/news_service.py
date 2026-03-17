"""
News Service - Alpha Vantage Integration
Handles fetching, parsing, storing, and retrieving news with sentiment analysis
"""
import os
import requests
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text, desc
import json
import time
from functools import wraps

from app.models import News, NewsTicker, ETF
from app.schemas import NewsArticleWithTickers, NewsTickerSentiment, NewsAlert

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Alpha Vantage Configuration
ALPHA_VANTAGE_API_KEY = os.getenv("ALPHA_VANTAGE_API_KEY", "JM0NBOYE5UI9IOXK")
ALPHA_VANTAGE_BASE_URL = "https://www.alphavantage.co/query"

# Rate limiting: 5 calls/minute, 25 calls/day (free tier)
_api_call_times = []
_daily_call_count = 0
_last_reset_date = datetime.now().date()

def rate_limiter(func):
    """
    Decorator to enforce Alpha Vantage rate limits:
    - Max 5 calls per minute
    - Max 25 calls per day
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        global _api_call_times, _daily_call_count, _last_reset_date
        
        now = datetime.now()
        current_date = now.date()
        
        # Reset daily counter if new day
        if current_date != _last_reset_date:
            _daily_call_count = 0
            _last_reset_date = current_date
            logger.info(f"🔄 Daily API call counter reset for {current_date}")
        
        # Check daily limit
        if _daily_call_count >= 25:
            logger.warning("⚠️ Daily API limit reached (25 calls/day)")
            raise Exception("Alpha Vantage daily API limit reached (25 calls). Try again tomorrow.")
        
        # Check per-minute limit (5 calls)
        one_minute_ago = now - timedelta(minutes=1)
        _api_call_times[:] = [t for t in _api_call_times if t > one_minute_ago]
        
        if len(_api_call_times) >= 5:
            sleep_time = 60 - (now - _api_call_times[0]).seconds
            logger.info(f"⏳ Rate limit: sleeping {sleep_time}s...")
            time.sleep(sleep_time)
        
        # Execute the API call
        _api_call_times.append(now)
        _daily_call_count += 1
        logger.info(f"📡 API Call #{_daily_call_count}/25 today")
        
        return func(*args, **kwargs)
    
    return wrapper


@rate_limiter
def fetch_news_from_alpha_vantage(
    tickers: str,
    limit: int = 50,
    topics: Optional[str] = None,
    time_from: Optional[str] = None,
    sort: str = "LATEST"
) -> Dict:
    """
    Fetch news from Alpha Vantage NEWS_SENTIMENT API
    
    Args:
        tickers: Comma-separated tickers (e.g., "SPY,QQQ,VTI")
        limit: Number of articles (default 50, max 1000)
        topics: Optional topics filter (e.g., "financial_markets,economy_macro")
        time_from: Optional start time in YYYYMMDDTHHMM format
        sort: LATEST (default), EARLIEST, or RELEVANCE
    
    Returns:
        Dict with 'feed' containing articles or error message
    """
    try:
        params = {
            "function": "NEWS_SENTIMENT",
            "tickers": tickers,
            "apikey": ALPHA_VANTAGE_API_KEY,
            "limit": limit,
            "sort": sort
        }
        
        if topics:
            params["topics"] = topics
        if time_from:
            params["time_from"] = time_from
        
        logger.info(f"🔍 Fetching news for: {tickers} (limit={limit})")
        response = requests.get(ALPHA_VANTAGE_BASE_URL, params=params, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        
        if "feed" in data:
            logger.info(f"✅ Retrieved {len(data['feed'])} articles")
            return data
        elif "Note" in data or "Information" in data:
            # API limit hit
            error_msg = data.get("Note") or data.get("Information")
            logger.warning(f"⚠️ API Response: {error_msg}")
            raise Exception(f"Alpha Vantage API: {error_msg}")
        else:
            logger.error(f"❌ Unexpected response: {data}")
            return {"feed": []}
            
    except requests.exceptions.RequestException as e:
        logger.error(f"❌ Network error: {str(e)}")
        raise Exception(f"Failed to fetch news: {str(e)}")


def parse_alpha_vantage_response(data: Dict) -> List[Dict]:
    """
    Parse Alpha Vantage response into structured article data
    
    Returns:
        List of article dicts ready for database insertion
    """
    articles = []
    
    if "feed" not in data or not data["feed"]:
        return articles
    
    for item in data["feed"]:
        try:
            # Parse time_published to datetime
            time_str = item.get("time_published", "")
            if time_str:
                time_published = datetime.strptime(time_str, "%Y%m%dT%H%M%S")
            else:
                time_published = datetime.now()
            
            # Extract authors as Python list
            authors = item.get("authors", [])
            
            # Extract topics as JSON object (keep as list of dicts)
            topics = item.get("topics", [])
            # Topics come as list of dicts: [{"topic": "Financial Markets", "relevance_score": "0.158519"}]
            
            # Extract source_domain from URL
            url = item.get("url", "")
            source_domain = None
            if url:
                try:
                    from urllib.parse import urlparse
                    parsed = urlparse(url)
                    source_domain = parsed.netloc
                except:
                    pass
            
            article = {
                "title": item.get("title", "No Title"),
                "url": url,
                "source": item.get("source", "Unknown"),
                "source_domain": source_domain,
                "authors": authors,  # Python list, SQLAlchemy will handle ARRAY
                "summary": item.get("summary", ""),
                "banner_image": item.get("banner_image"),
                "time_published": time_published,
                "overall_sentiment_score": float(item.get("overall_sentiment_score", 0.0)),
                "overall_sentiment_label": item.get("overall_sentiment_label", "Neutral"),
                "category": item.get("category_within_source"),
                "topics": topics,  # List of dicts, SQLAlchemy will handle JSONB
                "ticker_sentiments": []  # Will populate below
            }
            
            # Parse ticker-specific sentiments
            ticker_sentiments = item.get("ticker_sentiment", [])
            for ts in ticker_sentiments:
                ticker_data = {
                    "ticker": ts.get("ticker", "").upper(),
                    "ticker_sentiment_score": float(ts.get("ticker_sentiment_score", 0.0)),
                    "ticker_sentiment_label": ts.get("ticker_sentiment_label", "Neutral"),
                    "relevance_score": float(ts.get("relevance_score", 0.0))
                }
                article["ticker_sentiments"].append(ticker_data)
            
            articles.append(article)
            
        except Exception as e:
            logger.warning(f"⚠️ Failed to parse article: {str(e)}")
            continue
    
    logger.info(f"📊 Parsed {len(articles)} articles successfully")
    return articles


def store_news_in_db(articles: List[Dict], db: Session) -> Tuple[int, int]:
    """
    Store parsed articles and ticker sentiments in database
    Handles duplicates by URL
    
    Returns:
        Tuple of (new_articles_count, updated_articles_count)
    """
    new_count = 0
    updated_count = 0
    
    for article_data in articles:
        try:
            # Check if article exists by URL
            existing = db.query(News).filter(News.url == article_data["url"]).first()
            
            if existing:
                # Update existing article
                existing.title = article_data["title"]
                existing.summary = article_data["summary"]
                existing.overall_sentiment_score = article_data["overall_sentiment_score"]
                existing.overall_sentiment_label = article_data["overall_sentiment_label"]
                existing.last_updated = datetime.now()
                
                # Delete old ticker sentiments and re-add (simpler than updating)
                db.query(NewsTicker).filter(NewsTicker.news_id == existing.id).delete()
                news_obj = existing
                updated_count += 1
                
            else:
                # Create new article
                news_obj = News(
                    title=article_data["title"],
                    url=article_data["url"],
                    source=article_data["source"],
                    source_domain=article_data["source_domain"],
                    authors=article_data["authors"],
                    summary=article_data["summary"],
                    banner_image=article_data["banner_image"],
                    time_published=article_data["time_published"],
                    overall_sentiment_score=article_data["overall_sentiment_score"],
                    overall_sentiment_label=article_data["overall_sentiment_label"],
                    category=article_data["category"],
                    topics=article_data["topics"]
                )
                db.add(news_obj)
                db.flush()  # Get the news.id for ticker relationships
                new_count += 1
            
            # Add ticker sentiments
            for ts_data in article_data["ticker_sentiments"]:
                ticker_obj = NewsTicker(
                    news_id=news_obj.id,
                    ticker=ts_data["ticker"],
                    ticker_sentiment_score=ts_data["ticker_sentiment_score"],
                    ticker_sentiment_label=ts_data["ticker_sentiment_label"],
                    relevance_score=ts_data["relevance_score"]
                )
                db.add(ticker_obj)
            
            db.commit()
            
        except Exception as e:
            logger.error(f"❌ Failed to store article '{article_data.get('title', 'Unknown')}': {str(e)}")
            db.rollback()
            continue
    
    logger.info(f"💾 Stored: {new_count} new, {updated_count} updated articles")
    return (new_count, updated_count)


def get_news_for_ticker(
    ticker: str,
    db: Session,
    limit: int = 20,
    days: int = 7
) -> List[NewsArticleWithTickers]:
    """
    Retrieve news articles mentioning a specific ticker from database
    
    Args:
        ticker: ETF ticker symbol
        limit: Max articles to return
        days: Only return articles from last N days
    
    Returns:
        List of NewsArticleWithTickers objects
    """
    cutoff_date = datetime.now() - timedelta(days=days)
    
    # Query news that mention this ticker, ordered by relevance
    query = db.query(News).join(NewsTicker).filter(
        NewsTicker.ticker == ticker.upper(),
        News.time_published >= cutoff_date
    ).order_by(
        desc(NewsTicker.relevance_score),
        desc(News.time_published)
    ).limit(limit)
    
    articles = []
    for news in query.all():
        # Get all ticker sentiments for this article
        ticker_sentiments = db.query(NewsTicker).filter(
            NewsTicker.news_id == news.id
        ).all()
        
        ticker_list = [
            NewsTickerSentiment(
                ticker=ts.ticker,
                ticker_sentiment_score=ts.ticker_sentiment_score,
                ticker_sentiment_label=ts.ticker_sentiment_label,
                relevance_score=ts.relevance_score
            )
            for ts in ticker_sentiments
        ]
        
        article = NewsArticleWithTickers(
            id=news.id,
            title=news.title,
            url=news.url,
            source=news.source,
            summary=news.summary,
            banner_image=news.banner_image,
            time_published=news.time_published,
            overall_sentiment_score=news.overall_sentiment_score,
            overall_sentiment_label=news.overall_sentiment_label,
            tickers=ticker_list
        )
        articles.append(article)
    
    logger.info(f"📰 Retrieved {len(articles)} articles for {ticker}")
    return articles


def get_news_for_portfolio(
    tickers: List[str],
    db: Session,
    limit: int = 30,
    days: int = 7
) -> List[NewsArticleWithTickers]:
    """
    Retrieve news for multiple tickers (user's portfolio)
    Returns articles sorted by recency and relevance
    """
    cutoff_date = datetime.now() - timedelta(days=days)
    
    # Normalize tickers
    tickers_upper = [t.upper() for t in tickers]
    
    # Query news mentioning any of the portfolio tickers
    query = db.query(News).join(NewsTicker).filter(
        NewsTicker.ticker.in_(tickers_upper),
        News.time_published >= cutoff_date
    ).order_by(
        desc(News.time_published)
    ).limit(limit)
    
    articles = []
    seen_urls = set()
    
    for news in query.all():
        if news.url in seen_urls:
            continue
        seen_urls.add(news.url)
        
        # Get all ticker sentiments
        ticker_sentiments = db.query(NewsTicker).filter(
            NewsTicker.news_id == news.id
        ).all()
        
        ticker_list = [
            NewsTickerSentiment(
                ticker=ts.ticker,
                ticker_sentiment_score=ts.ticker_sentiment_score,
                ticker_sentiment_label=ts.ticker_sentiment_label,
                relevance_score=ts.relevance_score
            )
            for ts in ticker_sentiments
        ]
        
        article = NewsArticleWithTickers(
            id=news.id,
            title=news.title,
            url=news.url,
            source=news.source,
            summary=news.summary,
            banner_image=news.banner_image,
            time_published=news.time_published,
            overall_sentiment_score=news.overall_sentiment_score,
            overall_sentiment_label=news.overall_sentiment_label,
            tickers=ticker_list
        )
        articles.append(article)
    
    logger.info(f"📰 Retrieved {len(articles)} articles for portfolio ({len(tickers)} tickers)")
    return articles


def get_news_alerts(
    tickers: List[str],
    db: Session,
    days: int = 3,
    sentiment_threshold: float = -0.3,
    relevance_threshold: float = 0.5
) -> List[NewsAlert]:
    """
    Find high-impact negative news for portfolio tickers
    Used for alert notifications
    
    Args:
        tickers: List of portfolio tickers
        days: Look back N days
        sentiment_threshold: Alert if sentiment < this (negative)
        relevance_threshold: Only if relevance > this (significant mention)
    
    Returns:
        List of NewsAlert objects
    """
    cutoff_date = datetime.now() - timedelta(days=days)
    tickers_upper = [t.upper() for t in tickers]
    
    # Query highly negative news with high relevance
    query = db.query(News).join(NewsTicker).filter(
        NewsTicker.ticker.in_(tickers_upper),
        News.time_published >= cutoff_date,
        NewsTicker.ticker_sentiment_score < sentiment_threshold,
        NewsTicker.relevance_score > relevance_threshold
    ).order_by(
        NewsTicker.ticker_sentiment_score.asc()  # Most negative first
    ).limit(10)
    
    alerts = []
    for news in query.all():
        # Get affected tickers from user's portfolio
        affected = db.query(NewsTicker).filter(
            NewsTicker.news_id == news.id,
            NewsTicker.ticker.in_(tickers_upper),
            NewsTicker.ticker_sentiment_score < sentiment_threshold
        ).all()
        
        affected_tickers = [ts.ticker for ts in affected]
        
        # Generate alert reason
        avg_sentiment = sum(ts.ticker_sentiment_score for ts in affected) / len(affected)
        reason = f"Negative sentiment ({avg_sentiment:.2f}) detected for {', '.join(affected_tickers)}"
        
        alert = NewsAlert(
            article=NewsArticleWithTickers(
                id=news.id,
                title=news.title,
                url=news.url,
                source=news.source,
                summary=news.summary,
                banner_image=news.banner_image,
                time_published=news.time_published,
                overall_sentiment_score=news.overall_sentiment_score,
                overall_sentiment_label=news.overall_sentiment_label,
                tickers=[
                    NewsTickerSentiment(
                        ticker=ts.ticker,
                        ticker_sentiment_score=ts.ticker_sentiment_score,
                        ticker_sentiment_label=ts.ticker_sentiment_label,
                        relevance_score=ts.relevance_score
                    ) for ts in affected
                ]
            ),
            affected_tickers=affected_tickers,
            alert_reason=reason
        )
        alerts.append(alert)
    
    logger.info(f"🚨 Found {len(alerts)} high-impact alerts")
    return alerts


def refresh_news_for_tickers(tickers: List[str], db: Session) -> Dict[str, int]:
    """
    Fetch and store fresh news for a list of tickers
    Used by background jobs to refresh top 100 ETFs
    
    Returns:
        Dict with stats: {"api_calls": X, "new_articles": Y, "updated_articles": Z}
    """
    stats = {"api_calls": 0, "new_articles": 0, "updated_articles": 0}
    
    # Batch tickers into groups of 5 (more tickers = better API efficiency)
    # Alpha Vantage allows comma-separated tickers
    batch_size = 5
    batches = [tickers[i:i+batch_size] for i in range(0, len(tickers), batch_size)]
    
    for batch in batches:
        try:
            tickers_str = ",".join(batch)
            logger.info(f"🔄 Refreshing news for batch: {tickers_str}")
            
            # Fetch last 7 days of news
            time_from = (datetime.now() - timedelta(days=7)).strftime("%Y%m%dT%H%M")
            data = fetch_news_from_alpha_vantage(
                tickers=tickers_str,
                limit=50,
                time_from=time_from
            )
            stats["api_calls"] += 1
            
            # Parse and store
            articles = parse_alpha_vantage_response(data)
            new_count, updated_count = store_news_in_db(articles, db)
            
            stats["new_articles"] += new_count
            stats["updated_articles"] += updated_count
            
        except Exception as e:
            logger.error(f"❌ Failed to refresh batch {batch}: {str(e)}")
            continue
    
    logger.info(f"✅ Refresh complete: {stats}")
    return stats


def _build_topics_from_etf(etf: ETF) -> Optional[str]:
    """
    Build Alpha Vantage topics string from ETF metadata.
    """
    topic_set = {"financial_markets"}

    text_parts = [
        etf.etf_name or "",
        etf.category or "",
        etf.asset_class or "",
        etf.general_region or "",
        etf.index_tracked or "",
    ]
    context = " ".join(text_parts).lower()

    if any(k in context for k in ["tech", "technology", "nasdaq"]):
        topic_set.add("technology")
    if any(k in context for k in ["treasury", "bond", "fixed income", "rate", "income"]):
        topic_set.add("economy_monetary")
    if any(k in context for k in ["macro", "inflation", "gdp", "economic"]):
        topic_set.add("economy_macro")
    if any(k in context for k in ["energy", "oil", "gas"]):
        topic_set.add("energy_transportation")
    if any(k in context for k in ["real estate", "reit"]):
        topic_set.add("real_estate")

    # Keep topic list compact to avoid overly broad fetches.
    selected = sorted(topic_set)[:3]
    return ",".join(selected) if selected else None


def refresh_news_for_single_etf(ticker: str, db: Session) -> Dict[str, int]:
    """
    Fetch and store fresh news for one ETF using ticker + ETF metadata context.

    Strategy:
    - Call 1: precise ticker-based fetch
    - Call 2: context topics derived from ETF metadata (if available)
    """
    symbol = ticker.upper().strip()
    stats = {"api_calls": 0, "new_articles": 0, "updated_articles": 0}

    etf = db.query(ETF).filter(ETF.ticker == symbol).first()
    time_from = (datetime.now() - timedelta(days=7)).strftime("%Y%m%dT%H%M")

    # 1) Ticker-based fetch
    try:
        ticker_data = fetch_news_from_alpha_vantage(
            tickers=symbol,
            limit=50,
            time_from=time_from
        )
        stats["api_calls"] += 1
        ticker_articles = parse_alpha_vantage_response(ticker_data)
        new_count, updated_count = store_news_in_db(ticker_articles, db)
        stats["new_articles"] += new_count
        stats["updated_articles"] += updated_count
    except Exception as e:
        logger.error(f"❌ Ticker refresh failed for {symbol}: {str(e)}")

    # 2) Metadata-context fetch (topics)
    if etf is not None:
        topics = _build_topics_from_etf(etf)
        if topics:
            try:
                context_data = fetch_news_from_alpha_vantage(
                    tickers=symbol,
                    topics=topics,
                    limit=30,
                    time_from=time_from
                )
                stats["api_calls"] += 1
                context_articles = parse_alpha_vantage_response(context_data)
                new_count, updated_count = store_news_in_db(context_articles, db)
                stats["new_articles"] += new_count
                stats["updated_articles"] += updated_count
            except Exception as e:
                logger.error(f"❌ Context refresh failed for {symbol} (topics={topics}): {str(e)}")

    logger.info(f"✅ Single ETF refresh complete for {symbol}: {stats}")
    return stats
