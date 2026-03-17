from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from dotenv import load_dotenv
import ssl
import logging
import time
from functools import wraps

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))
DATABASE_URL = os.getenv("DATABASE_URL")

# SSL context for Supabase connections
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

# Connection pool settings optimized for Supabase Pro + Render + pg8000
engine = create_engine(
    DATABASE_URL,
    pool_size=10,  # Supabase Pro allows more connections
    max_overflow=20,  # Allow up to 30 total connections
    pool_timeout=30,  # Wait 30s for available connection from pool
    pool_recycle=600,  # Recycle connections after 10 minutes
    pool_pre_ping=True,  # Test connections before using (prevents stale connections)
    connect_args={
        "ssl_context": ssl_context,
        "timeout": 60,  # Connection timeout in seconds
    },
    echo=False,  # Set to True for SQL debugging
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()


def retry_on_connection_error(max_retries=3, delay=1):
    """Decorator to retry database operations on connection errors."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    error_str = str(e).lower()
                    # Check if it's a connection error worth retrying
                    if any(x in error_str for x in ['timeout', 'connection', 'interface']):
                        logger.warning(f"Connection attempt {attempt + 1}/{max_retries} failed: {e}")
                        if attempt < max_retries - 1:
                            time.sleep(delay * (attempt + 1))  # Exponential backoff
                            continue
                    raise
            raise last_exception
        return wrapper
    return decorator


def get_db():
    """Dependency for FastAPI routes to get a database session with proper cleanup."""
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        logger.error(f"Database session error: {e}")
        db.rollback()
        raise
    finally:
        db.close()