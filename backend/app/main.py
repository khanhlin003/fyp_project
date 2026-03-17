"""
FastAPI Main Application
ETF Recommendation Platform Backend
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="ETF Recommendation API",
    description="AI-powered ETF recommendation platform with personalized portfolio suggestions",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Initialize scheduler
scheduler = AsyncIOScheduler()


def get_cors_origins() -> list[str]:
    """Parse comma-separated frontend origins from environment."""
    origins_raw = os.getenv("FRONTEND_ORIGINS", "http://localhost:3000")
    origins = [origin.strip() for origin in origins_raw.split(",") if origin.strip()]
    return origins or ["http://localhost:3000"]

# Configure CORS for frontend access
cors_origins = get_cors_origins()
cors_origin_regex = os.getenv("FRONTEND_ORIGIN_REGEX")
logger.info("CORS allow_origins configured: %s", cors_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "ETF Recommendation API",
        "version": "1.0.0",
        "status": "active",
        "endpoints": {
            "docs": "/docs",
            "auth": "/auth/signup, /auth/login, /auth/me",
            "wallets": "/wallets (requires auth)",
            "etfs": "/etfs",
            "prices": "/etfs/{ticker}/prices",
            "metrics": "/etfs/{ticker}/metrics, /etfs/metrics/batch, /etfs/metrics/compare",
            "news": "/news/ticker/{ticker}, /news/portfolio/{user_id}, /news/alerts/{user_id}",
            "scenarios": "/scenarios/available, /scenarios/analyze, /scenarios/portfolio/covid, /scenarios/var",
            "macro": "/macro/{indicator_name}",
            "quiz": "/quiz/questions, /quiz/submit, /quiz/scoring-info",
            "recommendations": "/recommendations?profile=conservative|balanced|aggressive",
            "portfolio": "/portfolio (requires auth)"
        }
    }

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "database": "connected"}


# Import and register routes

from app.routes import etfs, prices, macro, quiz, recommendations, auth, portfolio, chatbot, metrics, news, scenarios, wallets

app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(wallets.router, prefix="/wallets", tags=["Wallets"])
app.include_router(etfs.router, prefix="/etfs", tags=["ETFs"])
app.include_router(prices.router, prefix="/etfs", tags=["Prices"])
app.include_router(metrics.router, prefix="/etfs", tags=["Metrics"])
app.include_router(news.router, prefix="/news", tags=["News & Sentiment"])
app.include_router(macro.router, prefix="/macro", tags=["Macro Indicators"])
app.include_router(quiz.router, prefix="/quiz", tags=["Quiz & Risk Profile"])
app.include_router(recommendations.router, prefix="/recommendations", tags=["Recommendations"])
app.include_router(portfolio.router, prefix="/portfolio", tags=["Portfolio"])
app.include_router(scenarios.router, tags=["Scenario Analysis"])

# Register chatbot endpoint
app.include_router(chatbot.router, tags=["Chatbot"])


# Background Jobs
def refresh_top_100_news_job():
    """
    Background job to refresh news for top 100 ETFs
    Runs daily at 6 PM ET (after market close)
    Uses 20 API calls (5 tickers per call * 20 batches)
    """
    from app.database import SessionLocal
    from app.services.news_service import refresh_news_for_tickers
    from sqlalchemy import text
    
    logger.info("🔄 Starting daily news refresh job...")
    
    db = SessionLocal()
    try:
        # Get top 100 ETFs by AUM (Assets Under Management)
        query = text("""
            SELECT ticker 
            FROM etfs 
            WHERE aum IS NOT NULL 
            ORDER BY 
                CAST(REPLACE(REPLACE(aum, 'B', ''), 'M', '') AS FLOAT) * 
                CASE 
                    WHEN aum LIKE '%B%' THEN 1000000000
                    WHEN aum LIKE '%M%' THEN 1000000
                    ELSE 1
                END DESC
            LIMIT 100
        """)
        result = db.execute(query)
        top_tickers = [row[0] for row in result.fetchall()]
        
        if not top_tickers:
            logger.warning("⚠️ No ETFs found in database for news refresh")
            return
        
        logger.info(f"📊 Refreshing news for {len(top_tickers)} top ETFs...")
        
        # Refresh news (will use ~20 API calls for 100 tickers)
        stats = refresh_news_for_tickers(top_tickers, db)
        
        logger.info(f"✅ News refresh complete: {stats}")
        
    except Exception as e:
        logger.error(f"❌ News refresh job failed: {str(e)}")
    finally:
        db.close()


@app.on_event("startup")
async def start_scheduler():
    """
    Start background scheduler on application startup
    Schedules daily news refresh at 6 PM ET
    """
    logger.info("🚀 Starting background scheduler...")
    
    # Schedule daily news refresh at 6 PM Eastern Time (after market close)
    scheduler.add_job(
        refresh_top_100_news_job,
        trigger=CronTrigger(hour=18, minute=0, timezone="US/Eastern"),
        id="refresh_top_100_news",
        name="Daily Top 100 ETFs News Refresh",
        replace_existing=True
    )
    
    scheduler.start()
    logger.info("✅ Scheduler started - Daily news refresh at 6:00 PM ET")


@app.on_event("shutdown")
async def shutdown_scheduler():
    """Shutdown scheduler gracefully"""
    logger.info("🛑 Shutting down scheduler...")
    scheduler.shutdown()
    logger.info("✅ Scheduler stopped")
