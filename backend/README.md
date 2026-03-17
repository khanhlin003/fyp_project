# Backend — AI-Powered ETF Advisor

FastAPI backend serving ETF data, user authentication, portfolio management, AI-driven recommendations, and scenario analysis.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | FastAPI 0.104+ |
| Server | Uvicorn + Gunicorn |
| ORM | SQLAlchemy 2.0 |
| Database | PostgreSQL (Supabase) |
| Auth | JWT (HS256) + bcrypt |
| AI | OpenAI GPT-3.5-turbo |
| Validation | Pydantic v2 |
| Data | Pandas, NumPy |

## Project Structure

```
backend/
├── app/
│   ├── main.py                 # FastAPI app entrypoint, CORS, route registration
│   ├── database.py             # SQLAlchemy engine (Supabase/SSL), SessionLocal
│   ├── models.py               # ORM table definitions
│   ├── schemas.py              # Pydantic request/response models
│   ├── auth.py                 # JWT create/decode, bcrypt, get_current_user dependency
│   ├── routes/
│   │   ├── auth.py             # /auth — signup, login, profile
│   │   ├── etfs.py             # /etfs — browse and filter ETFs
│   │   ├── prices.py           # /etfs/{ticker}/prices — OHLCV history
│   │   ├── metrics.py          # /etfs/{ticker}/metrics — computed metrics
│   │   ├── news.py             # /news — news feed and alerts
│   │   ├── macro.py            # /macro — macroeconomic indicators
│   │   ├── quiz.py             # /quiz — risk questionnaire
│   │   ├── recommendations.py  # /recommendations — risk-profile ETF picks
│   │   ├── portfolio.py        # /portfolio — user holdings (JWT-gated)
│   │   ├── chatbot.py          # /chatbot — OpenAI ETF advisor (JWT-gated)
│   │   └── scenarios.py        # /scenarios — stress tests and VaR
│   └── services/
│       ├── metrics.py          # Returns, volatility, beta, Sharpe, max drawdown
│       ├── scenario_service.py # COVID crash simulation, shock scenarios, VaR
│       └── news_service.py     # News fetching, sentiment aggregation, alert detection
├── scripts/                    # Data ingestion scripts (ETF metadata, prices, macro)
├── create_tables.py            # One-time DB schema setup
├── create_news_tables.py       # News tables setup
├── requirements.txt
└── runtime.txt                 # Python version pin
```

## Setup

### Prerequisites

- Python 3.11+
- A Supabase (PostgreSQL) project
- OpenAI API key

### Installation

```bash
# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate       # macOS / Linux
.venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt
```

### Environment Variables

Create a `.env` file in the `backend/` directory:

```env
DATABASE_URL=postgresql+pg8000://...   # Supabase connection string
JWT_SECRET_KEY=your-secret-key
OPENAI_API_KEY=sk-...
FRONTEND_ORIGINS=http://localhost:3000,https://your-app.vercel.app
# Optional: allow all Vercel preview deployments
# FRONTEND_ORIGIN_REGEX=https://.*\\.vercel\\.app
```

### Database Initialisation

```bash
python create_tables.py
python create_news_tables.py
```

### Running the Server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`. Interactive docs are at `http://localhost:8000/docs`.

## API Reference

| Prefix | Endpoint | Description |
|---|---|---|
| `/auth` | `POST /auth/signup` | Register a new user |
| `/auth` | `POST /auth/login` | Login and receive a JWT |
| `/auth` | `GET /auth/me` | Get current user profile |
| `/auth` | `PUT /auth/me` | Update user profile |
| `/etfs` | `GET /etfs` | Browse ETFs (paginated, filterable) |
| `/etfs` | `GET /etfs/{ticker}` | Get ETF details |
| `/etfs` | `GET /etfs/{ticker}/prices` | Get OHLCV price history |
| `/etfs` | `GET /etfs/{ticker}/metrics` | Get computed performance metrics |
| `/etfs` | `GET /etfs/metrics/compare` | Compare metrics across tickers |
| `/news` | `GET /news/ticker/{ticker}` | News articles for a ticker |
| `/news` | `GET /news/portfolio/{user_id}` | News for portfolio holdings |
| `/news` | `GET /news/alerts/{user_id}` | High-impact negative news alerts |
| `/macro` | `GET /macro/indicators` | All macroeconomic indicators |
| `/macro` | `GET /macro/{indicator_name}` | Single indicator history |
| `/quiz` | `GET /quiz/questions` | Risk questionnaire questions |
| `/quiz` | `POST /quiz/submit` | Submit answers → risk profile |
| `/recommendations` | `GET /recommendations` | ETF picks by risk profile |
| `/portfolio` | `GET /portfolio` | User holdings (JWT required) |
| `/portfolio` | `POST /portfolio` | Add a holding (JWT required) |
| `/portfolio` | `PUT /portfolio/{id}` | Update a holding (JWT required) |
| `/portfolio` | `DELETE /portfolio/{id}` | Remove a holding (JWT required) |
| `/chatbot` | `POST /chatbot` | Ask the AI ETF advisor (JWT required) |
| `/scenarios` | `GET /scenarios/available` | List available stress scenarios |
| `/scenarios` | `POST /scenarios/analyze` | Run a stress test on a portfolio |
| `/scenarios` | `POST /scenarios/var` | Compute Value at Risk |

## Database Schema

| Table | Description |
|---|---|
| `etfs` | ETF metadata (ticker, issuer, returns, risk metrics, holdings, sector breakdown) |
| `etf_prices` | Daily OHLCV price history (up to 15 years) |
| `macro_indicators` | CPI, 10Y Treasury yield, Fed Funds Rate, GDP, VIX |
| `users` | User accounts with email/password auth and risk profile |
| `portfolios` | User holdings (ticker, quantity, purchase price/date) |
| `news` | News articles with sentiment scores and topic tags |
| `news_tickers` | Many-to-many mapping of news articles to tickers |

## Key Metrics Computed

- **Annualised returns** — 1M, 3M, 6M, 1Y, 3Y, 5Y
- **Volatility** — annualised daily standard deviation (`σ × √252`)
- **Beta** — vs SPY benchmark
- **Sharpe Ratio** — using live risk-free rate from `macro_indicators`
- **Maximum Drawdown**

## Data Ingestion Scripts

Located in `scripts/`, these are run manually or on a schedule to keep data fresh:

| Script | Purpose |
|---|---|
| `ingest_etf_metadata.py` | Scrape and upload ETF metadata |
| `ingest_prices.py` | Fetch OHLCV data via yfinance |
| `ingest_macro.py` | Fetch macro indicators from FRED |
| `update_prices_yfinance.py` | Incremental price updates |
| `upload_prices_to_supabase.py` | Bulk upload price data |
