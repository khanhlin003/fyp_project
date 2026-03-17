# ETF Recommendation Platform - Project Checklist

## 📊 Project Overview
AI-powered ETF recommendation platform with personalized portfolio suggestions based on user risk profiles.

---

## ✅ Phase 1: Data Collection & Preparation

### US Market Data
- [x] ETF metadata (2,187 ETFs) - ETFdb.com via pyetfdb_scraper
- [x] Historical prices (15 years, 2010-2025)
- [x] Macro indicators (CPI, Treasury Yield, Fed Funds, GDP, VIX)
- [x] **News data** - Alpha Vantage NEWS_SENTIMENT (free tier: 25 calls/day)
  - [x] Top 100 ETFs by AUM (daily refresh at 6 PM ET via APScheduler)
  - [x] User portfolio holdings (on-demand via API)
  - [x] On-demand fetch for any ETF on details page

### Singapore Market Data
- [x] ETF metadata (85 ETFs) - yfinance + SGX
- [x] Historical prices
- [ ] ~~Macro indicators~~ - Using US macro data
- [ ] **News data** - Alpha Vantage (same as US)

### Data Processing
- [x] Combined ETF metadata (2,272 total)
- [x] Combined price data (5,793,153 rows)
- [x] Combined macro indicators (15,585 rows)

### Calculate Metrics from Price Data (TODO)
> 💡 These metrics can be computed from `etf_prices` table instead of relying on stale metadata:
- [x] **YTD Return** - `(current_price - jan1_price) / jan1_price * 100`
- [x] **1M/3M/6M/1Y/3Y/5Y Returns** - Calculate from price differences
- [x] **Volatility (Std Dev)** - Standard deviation of daily returns
- [x] **Beta** - `Cov(ETF, SPY) / Var(SPY)` using daily returns
- [x] **Sharpe Ratio** - `(annualized_return - risk_free_rate) / annualized_volatility`
- [x] **Max Drawdown** - Largest peak-to-trough decline
- [x] **52-Week High/Low** - Max/Min close price in last 252 trading days

> **Implementation**: Backend service - Calculate on-demand per request
> - `GET /etfs/{ticker}/metrics` - Single ETF metrics
> - `GET /etfs/metrics/batch?tickers=SPY,QQQ` - Multiple ETFs (max 10)
> - `GET /etfs/metrics/compare?tickers=SPY,QQQ,VOO` - Side-by-side comparison (2-5 ETFs)

---

## ✅ Phase 2: Database Setup (Supabase)

### Tables Created & Populated
- [x] `etfs` - 2,272 rows (32 columns)
- [x] `etf_prices` - 5,793,153 rows
- [x] `macro_indicators` - 15,585 rows

### Tables Created & Ready
- [x] `users` - User authentication (JWT-based)
- [x] `portfolios` - User holdings
- [ ] `quiz_results` - Quiz history

### Tables to Create
- [x] `news` - Article metadata (title, url, source, sentiment, time_published)
- [x] `news_tickers` - Many-to-many (news ↔ tickers with ticker-specific sentiment & relevance) 


---

## ✅ Phase 3: Backend API (FastAPI)

### Project Structure
```
backend/
├── app/
│   ├── main.py           ✅
│   ├── models.py         ✅
│   ├── schemas.py        ✅
│   ├── database.py       ✅
│   └── routes/
│       ├── etfs.py       ✅
│       ├── prices.py     ✅
│       ├── macro.py      ✅
│       ├── quiz.py       ✅
│       └── recommendations.py ✅
```

### ETF Endpoints
- [x] `GET /etfs` - List with filters & pagination
- [x] `GET /etfs/{ticker}` - Full ETF details
- [x] `GET /etfs/{ticker}/summary` - Summary with latest price
- [x] `GET /etfs/filters/options` - Filter dropdown values

### Price Endpoints
- [x] `GET /etfs/{ticker}/prices` - Historical OHLCV
- [x] `GET /etfs/{ticker}/prices/latest` - Latest price
- [x] `GET /etfs/{ticker}/prices/chart` - Chart data (1m-max)

### Macro Endpoints
- [x] `GET /macro/indicators` - List all indicators
- [x] `GET /macro/{indicator_name}` - Indicator history
- [x] `GET /macro/{indicator_name}/latest` - Latest value
- [x] `GET /macro/dashboard/summary` - Dashboard summary

### Quiz & Risk Profile Endpoints
- [x] `GET /quiz/questions` - Fetch 15 questions
- [x] `POST /quiz/submit` - Submit answers → get profile
- [x] `GET /quiz/scoring-info` - Profile thresholds

### Recommendation Endpoints
- [x] `GET /recommendations` - ETFs by risk profile (basic)
- [x] `GET /recommendations/profiles` - Profile criteria
- [ ] `GET /recommendations/v2` - Advanced multi-factor scoring

> ⚠️ **Current:** Basic algorithm (beta + category filtering)
> 
> **TODO: Recommendation Engine v2**
> - [ ] Multi-factor scoring (risk 40%, performance 30%, cost 15%, liquidity 10%, diversification 5%)
> - [ ] Sharpe ratio in performance score
> - [ ] Sector diversity constraints (max 2 per sector)
> - [ ] Portfolio-aware (avoid duplicates)
> - [ ] Explainable score breakdown

### Auth Endpoints
- [x] `POST /auth/signup` - Create account
- [x] `POST /auth/login` - Login & get JWT token
- [x] `GET /auth/me` - Get current user profile
- [x] `PUT /auth/me` - Update user profile

### Portfolio Endpoints (Protected)
- [x] `GET /portfolio` - User's holdings with current prices
- [x] `POST /portfolio` - Add ETF to portfolio
- [x] `PUT /portfolio/{ticker}` - Update holding
- [x] `DELETE /portfolio/{ticker}` - Remove ETF

### AI Chatbot Endpoint (Requires OpenAI)
- [x] `POST /chatbot` - Ask AI about ETF (authenticated)

### Metrics Endpoints
- [x] `GET /etfs/{ticker}/metrics` - Live calculated metrics
- [x] `GET /etfs/metrics/batch` - Multiple ETFs metrics
- [x] `GET /etfs/metrics/compare` - Side-by-side comparison

### News & Sentiment Endpoints
- [x] `GET /news/ticker/{ticker}` - Latest news for specific ETF
- [x] `GET /news/portfolio/{user_id}` - Aggregated news for user's holdings
- [x] `GET /news/alerts/{user_id}` - High-impact news (sentiment < -0.3, relevance > 0.5)
- [x] `POST /news/refresh/top100` - Manual trigger for testing
- [x] Backend service: `news_service.py` with Alpha Vantage integration
- [x] Rate limiting: 5 calls/min, 25 calls/day tracking
- [x] Background job: Daily top 100 ETF news refresh (APScheduler at 6 PM ET)

### Background Jobs
- [x] **News refresh scheduler** - APScheduler running, daily 6 PM ET
- [ ] **Daily price updates** - Need Python 3.9+ or manual script execution
  - Script created: `backend/scripts/update_prices_simple.py`
  - **Issue**: Yahoo Finance API rate limiting + yfinance requires Python 3.9+
  - **Current workaround**: Manual execution via scheduler or upgrade Python
  - **Command**: `python update_prices_simple.py top 100` (update top 100 ETFs)
- [ ] Macro indicator refresh (monthly/quarterly from FRED)

### Scenario Analysis Endpoints
- [x] `GET /scenarios/available` - List all available scenarios
- [x] `POST /scenarios/analyze` - Run scenario on portfolio or custom holdings
- [x] `GET /scenarios/portfolio/covid` - Quick COVID-19 analysis

---

## ✅ Phase 4: AI Integration

### OpenAI Setup
- [x] Get API key from platform.openai.com
- [x] Add OPENAI_API_KEY to `.env`
- [x] Install `openai` package (v1.0.0+)

### AI Service Functions
- [x] `generate_etf_insight(etf_data, question)` - Answer ETF questions
- [ ] `explain_recommendation(etfs, profile)` - Explain why ETFs match (future)

### AI Endpoint
- [x] `POST /chatbot` - AI chatbot for ETF Q&A

---

## 🔄 Phase 4.5: Advanced Analytics Features

### Historical Scenario Analysis
- [x] Backend: Scenario replay service
  - [x] Historical scenarios (COVID-19 crash Feb-Mar 2020)
  - [x] Calculate portfolio impact using actual historical price movements
  - [x] Simple stress tests (±10%, ±20%, ±30% shocks)
  - [x] Historical VaR (95th percentile loss from past returns)
  - [x] Parametric VaR (assumes normal distribution of returns)
- [x] Endpoint: `POST /scenarios/analyze` - Test portfolio under scenarios
- [x] Endpoint: `GET /scenarios/available` - List available scenarios
- [x] Endpoint: `GET /scenarios/portfolio/covid` - Quick COVID analysis
- [x] Endpoint: `GET /scenarios/var` - Calculate Value at Risk (VaR)
- [x] Frontend: ScenarioAnalysis component with scenario selector
- [x] Frontend: Portfolio page integration with scenario results display

### News & Sentiment Integration
- [x] **Backend** ✅ COMPLETE
  - [x] Created `news_service.py` with Alpha Vantage NEWS_SENTIMENT
  - [x] Database models: `News` and `NewsTicker` SQLAlchemy models
  - [x] API endpoints: `/news/ticker/{ticker}`, `/news/portfolio`, `/news/alerts`
  - [x] APScheduler: Daily top 100 ETF refresh job (6 PM ET, ~20 calls)
  - [x] Rate limiter: 5 calls/min, 25 calls/day max
  - [x] Manual trigger: `POST /news/refresh/top100` for testing
- [x] **Frontend** ✅ COMPLETE
  - [x] NewsCard component - Article cards with sentiment badges and ticker mentions
  - [x] NewsFeed component - Grid layout with sentiment filtering
  - [x] NewsModal component - Full article details popup
  - [x] NewsAlertBadge component - Navbar notification with high-impact alerts
  - [x] API integration in `lib/api.ts` - All news endpoints added
  - [x] **Integration Pending:**
    - [x] Add NewsFeed to portfolio page
    - [x] Add NewsAlertBadge to navbar
    - [x] Add ticker-specific news to ETF details page

---

## 🔄 Phase 5: Frontend Development (Next.js/React)

### Project Setup
- [x] Initialize Next.js with TypeScript + Tailwind
- [x] Install dependencies (axios, react-query, recharts, lucide-react)
- [x] Configure API base URL (`http://localhost:8000`)

### Pages to Build
- [x] Landing page (`/`) - Hero, features, how it works sections
- [x] Risk questionnaire (`/questionnaire`) - 15-question quiz with result screen
- [x] ETF discovery (`/etfs`) - Search, filters, grid/list view, pagination
- [x] ETF details (`/etfs/[ticker]`) - Price chart, performance metrics, holdings breakdown
- [x] Recommendations (`/recommendations`) - Profile selection, ranked ETF cards with scores
- [x] Portfolio dashboard (`/portfolio`) - Holdings list, allocation chart, add/edit/remove ETFs (localStorage)
- [x] Login page (`/login`) - Email/password login with JWT
- [x] Signup page (`/signup`) - Create account with validation

### Components
- [x] Header/Navigation (responsive)
- [x] ETF card grid (with grid/list toggle)
- [x] Price chart (Recharts AreaChart with period selector)
- [x] Filter sidebar (asset class, region, market)
- [x] Quiz form (multi-step with progress bar)
- [x] Holdings breakdown (parsed JSON with visual bars)
- [x] Auth context & user menu (navbar dropdown)
- [x] Portfolio page with backend API (authenticated, persistent)
- [x] AI chatbox (on ETF details page, authenticated)
- [x] **News components**
  - [x] News feed list (portfolio page)
  - [x] News card with sentiment badge
  - [x] Alert notification icon (navbar with count)
  - [x] News detail modal
- [x] **Scenario Analysis component**
  - [x] Scenario selector with COVID-19 and stress tests
  - [x] Portfolio impact display with color-coded results
  - [x] Holdings breakdown with individual ETF performance

---

## 🔄 Phase 6: Testing & Deployment

### Testing
- [ ] API endpoint testing (Swagger UI)
- [ ] Frontend E2E testing
- [ ] Cross-browser testing
- [ ] Mobile responsive testing

### Backend Deployment
- [x] Deploy to Render/Railway
- [x] Set environment variables
- [ ] Test production API

### Frontend Deployment
- [x] Deploy to Vercel
- [x] Update API base URL
- [ ] Test production site

---

## 🔄 Phase 7: Documentation

### README
- [ ] Project overview
- [ ] Tech stack
- [ ] Setup instructions
- [ ] API documentation

### Demo
- [ ] Create demo guide
- [ ] Record demo video (5 min)

---
## 🔮 Optional Enhancements (If Time Permits)

- [ ] Real-time price updates (WebSocket)
- [ ] Email alerts for price movements
- [ ] Export portfolio to PDF
- [ ] Historical backtesting tool
- [ ] Mobile app (React Native)
- [ ] Social features (share portfolios)
- [ ] Tax optimization suggestions
- [ ] Dividend reinvestment calculator

---

## 📈 Current Progress

| Phase | Status | Completion |
|-------|--------|------------|
| Data Collection | ✅ Complete | 100% |
| Database Setup | ✅ Complete | 100% |
| Backend API - Core | ✅ Complete | 100% |
| **News & Sentiment Backend** | ✅ Complete | 100% |
| **News & Sentiment Frontend** | ✅ Complete | 100% |
| **Scenario Analysis** | ✅ Complete | 100% |
| **Recommendation Engine v2** | 🔄 Pending | 0% |
| **Automated Price Updates** | 🔄 Pending | 0% |
| AI Integration | ✅ Complete | 90% |
| Frontend - Core | ✅ Complete | 95% |
| Frontend - Analytics | ✅ Complete | 100% |
| Testing | ❌ Not Started | 0% |
| Deployment | 🔄 In Progress | 80% |
| Documentation | ❌ Not Started | 0% |

**Overall Progress: ~75%** (core complete, 2 advanced features pending)

---

## 🚀 Quick Commands

<!-- local host  -->
```bash
# Start backend server
cd /Users/linhtrankhanh/Downloads/fyp/project/backend
source ../venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Start frontend dev server
cd /Users/linhtrankhanh/Downloads/fyp/project/frontend
npm run dev

# API Documentation
open http://localhost:8000/docs

# Frontend App
open http://localhost:3000

# Test quiz endpoint
curl -X POST http://localhost:8000/quiz/submit \
  -H "Content-Type: application/json" \
  -d '{"answers": {"q1": "C", "q2": "B", "q3": "D", "q4": "C", "q5": "C", "q6": "C", "q7": "C", "q8": "C", "q9": "C", "q10": "C", "q11": "C", "q12": "C", "q13": "B", "q14": "C", "q15": "B"}}'

# Test recommendations
curl "http://localhost:8000/recommendations?profile=conservative&limit=5"
```

<!-- cloud service -->
<!-- supabase database-->
<!-- vercel front end -->
<!-- render back end -->