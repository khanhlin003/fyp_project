# Comments: sg and us markets are inconsistent in terms of data availability.
# Check the consitency of data from both markets
from datetime import datetime
from unittest.mock import Base
"""
SQLAlchemy models for the backend.

This file imports the shared Base from `app.database` so that
`Base.metadata.create_all(engine)` works correctly from
`backend/create_tables.py`.

Columns are mapped to CSV header names when the header is
not a valid Python identifier (for example '1_month_return',
or '52_week_low'). Attribute names remain Python-friendly
and Column(...) sets the actual database column name.
"""
from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Date,
    BigInteger,
    Text,
    ForeignKey,
    DateTime,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB

# Import the shared Base from database module
from app.database import Base


class ETF(Base):
    __tablename__ = "etfs"

    # Primary identifier
    ticker = Column(String, primary_key=True)

    # Basic metadata (many fields are stored as strings because
    # the raw CSV contains formatted values like "$1,234.5 M" or "0.50%")
    etf_name = Column(String)
    issuer = Column(String)
    brand = Column(String)

    # CSV header is `inception` (e.g. "Mar 12, 1996")
    inception = Column(String)

    category = Column(String)
    asset_class = Column(String)
    asset_class_size = Column(String)
    asset_class_style = Column(String)
    general_region = Column(String)
    specific_region = Column(String)

    expense_ratio = Column(String)
    aum = Column(String)
    index_tracked = Column(String)

    # Returns: map CSV headers that start with a digit to Python-safe attrs
    return_1m = Column("1_month_return", String)
    return_3m = Column("3_month_return", String)
    return_ytd = Column("ytd_return", String)
    return_1y = Column("1_year_return", String)
    return_3y = Column("3_year_return", String)
    return_5y = Column("5_year_return", String)

    # 52-week low/high in CSV are '52_week_low'/'52_week_high'
    week_52_low = Column("52_week_low", String)
    week_52_high = Column("52_week_high", String)

    beta = Column(String)
    standard_deviation = Column(String)

    # Dividend fields in CSV: 'annual_dividend_rate', 'annual_dividend_yield', 'dividend'
    annual_dividend_rate = Column(String)
    annual_dividend_yield = Column(String)
    dividend = Column(String)
    dividend_date = Column(String)

    # Holdings / sector breakdown columns
    top_holdings = Column(Text)
    sector_breakdown = Column(Text)

    # Source and last updated from CSV
    source = Column(String)
    last_updated = Column(String)

    # Extra fields that may appear in other sources (keep them optional)
    shares_outstanding = Column(String, nullable=True)
    volatility_20d = Column(String, nullable=True)
    volatility_50d = Column(String, nullable=True)
    ma_20d = Column(String, nullable=True)
    ma_60d = Column(String, nullable=True)
    rsi_20d = Column(String, nullable=True)
    alternative_cheapest = Column(String, nullable=True)
    alternative_largest = Column(String, nullable=True)
    alternative_most_liquid = Column(String, nullable=True)
    analyst_report = Column(Text, nullable=True)


class ETFPrice(Base):
    __tablename__ = "etf_prices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String, ForeignKey("etfs.ticker"), index=True)
    date = Column(Date, index=True)
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float)
    volume = Column(BigInteger)


class MacroIndicator(Base):
    __tablename__ = "macro_indicators"
    id = Column(Integer, primary_key=True, autoincrement=True)
    indicator_name = Column(String, index=True)  # CPIAUCSL, DGS10, etc.
    date = Column(Date, index=True)
    value = Column(Float)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=True)
    risk_profile = Column(String)  # conservative, balanced, aggressive
    created_at = Column(DateTime, default=datetime.utcnow)


class Portfolio(Base):
    __tablename__ = "portfolios"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    ticker = Column(String, ForeignKey("etfs.ticker"))
    quantity = Column(Float)
    purchase_date = Column(Date)
    purchase_price = Column(Float)


class News(Base):
    """
    News articles from Alpha Vantage NEWS_SENTIMENT API.
    One article can mention multiple tickers (stored in news_tickers table).
    """
    __tablename__ = "news"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Article metadata
    title = Column(Text, nullable=False)
    url = Column(String, unique=True, nullable=False)
    source = Column(String)
    source_domain = Column(String)
    authors = Column(ARRAY(Text))  # Array of author names
    summary = Column(Text)
    banner_image = Column(String)
    time_published = Column(DateTime, nullable=False)
    
    # Overall sentiment scores
    overall_sentiment_score = Column(Float)  # -1 to +1
    overall_sentiment_label = Column(String)  # Bearish, Neutral, Bullish
    
    # Categories
    category = Column(String)
    topics = Column(JSONB)  # List of topic dicts [{topic: "...", relevance_score: "..."}]
    
    # Tracking
    created_at = Column(DateTime, default=datetime.utcnow)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class NewsTicker(Base):
    """
    Many-to-many relationship between news articles and tickers.
    Each article can mention multiple tickers, and each ticker has
    its own sentiment score and relevance for that article.
    """
    __tablename__ = "news_tickers"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    news_id = Column(Integer, ForeignKey("news.id", ondelete="CASCADE"), nullable=False)
    ticker = Column(String, nullable=False)
    
    # Ticker-specific sentiment scores
    ticker_sentiment_score = Column(Float)  # -1 to +1
    ticker_sentiment_label = Column(String)  # Bearish, Neutral, Bullish
    relevance_score = Column(Float)  # 0 to 1
    
    created_at = Column(DateTime, default=datetime.utcnow)
