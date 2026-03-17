"""
Pydantic schemas for API request/response validation
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime


# ETF Schemas
class ETFBase(BaseModel):
    ticker: str
    etf_name: Optional[str] = None
    issuer: Optional[str] = None
    brand: Optional[str] = None
    category: Optional[str] = None
    asset_class: Optional[str] = None
    expense_ratio: Optional[str] = None
    aum: Optional[str] = None
    ytd_return: Optional[str] = Field(None, validation_alias="return_ytd")
    beta: Optional[str] = None
    annual_dividend_yield: Optional[str] = None
    latest_price: Optional[float] = None
    latest_volume: Optional[int] = None
    
    class Config:
        from_attributes = True


class ETFDetail(ETFBase):
    """Complete ETF information with all 32 fields"""
    inception: Optional[str] = None
    asset_class_size: Optional[str] = None
    asset_class_style: Optional[str] = None
    general_region: Optional[str] = None
    specific_region: Optional[str] = None
    index_tracked: Optional[str] = None
    month_1_return: Optional[str] = Field(None, alias="1_month_return", validation_alias="return_1m")
    month_3_return: Optional[str] = Field(None, alias="3_month_return", validation_alias="return_3m")
    ytd_return: Optional[str] = Field(None, validation_alias="return_ytd")
    year_1_return: Optional[str] = Field(None, alias="1_year_return", validation_alias="return_1y")
    year_3_return: Optional[str] = Field(None, alias="3_year_return", validation_alias="return_3y")
    year_5_return: Optional[str] = Field(None, alias="5_year_return", validation_alias="return_5y")
    week_52_low: Optional[str] = Field(None, alias="52_week_low")
    week_52_high: Optional[str] = Field(None, alias="52_week_high")
    beta: Optional[str] = None
    standard_deviation: Optional[str] = None
    annual_dividend_rate: Optional[str] = None
    annual_dividend_yield: Optional[str] = None
    dividend: Optional[str] = None
    dividend_date: Optional[str] = None
    top_holdings: Optional[str] = None
    sector_breakdown: Optional[str] = None
    source: Optional[str] = None
    last_updated: Optional[str] = None
    analyst_report: Optional[str] = None

    class Config:
        from_attributes = True
        populate_by_name = True


class ETFList(BaseModel):
    """ETF list response with pagination"""
    total: int
    page: int
    page_size: int
    etfs: List[ETFBase]


# Price Schemas
class PriceData(BaseModel):
    date: date
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    close: float
    volume: Optional[int] = None

    class Config:
        from_attributes = True


class PriceHistory(BaseModel):
    ticker: str
    total_records: int
    date_range: dict
    prices: List[PriceData]


# Macro Indicator Schemas
class MacroData(BaseModel):
    date: date
    value: float

    class Config:
        from_attributes = True


class MacroIndicator(BaseModel):
    indicator_name: str
    total_records: int
    date_range: dict
    data: List[MacroData]


# Filter Schemas
class ETFFilters(BaseModel):
    category: Optional[str] = None
    asset_class: Optional[str] = None
    etf_type: Optional[str] = None
    region: Optional[str] = None
    min_aum: Optional[float] = None
    max_expense_ratio: Optional[float] = None
    search: Optional[str] = None  # Search by ticker or name


# News Schemas
class NewsTickerSentiment(BaseModel):
    """Ticker-specific sentiment within a news article"""
    ticker: str
    ticker_sentiment_score: Optional[float] = None
    ticker_sentiment_label: Optional[str] = None
    relevance_score: Optional[float] = None
    
    class Config:
        from_attributes = True


class NewsArticle(BaseModel):
    """News article with overall sentiment"""
    id: int
    title: str
    url: str
    source: Optional[str] = None
    summary: Optional[str] = None
    banner_image: Optional[str] = None
    time_published: datetime  # Python datetime object
    overall_sentiment_score: Optional[float] = None
    overall_sentiment_label: Optional[str] = None
    
    class Config:
        from_attributes = True


class NewsArticleWithTickers(NewsArticle):
    """News article with ticker-specific sentiment data"""
    tickers: List[NewsTickerSentiment] = []


class NewsResponse(BaseModel):
    """API response for news queries"""
    articles: List[NewsArticleWithTickers]
    total: int
    ticker: Optional[str] = None  # If filtered by ticker


class NewsAlert(BaseModel):
    """High-impact news alert"""
    article: NewsArticleWithTickers
    affected_tickers: List[str]
    alert_reason: str  # e.g., "Highly negative sentiment"
