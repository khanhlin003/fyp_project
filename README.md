# AI-Powered ETF Advisor

An accessible, web-based ETF recommendation platform for retail investors in Singapore and the US markets. It combines quantitative finance (Modern Portfolio Theory) with Generative AI (GPT) to deliver personalised ETF recommendations, portfolio risk analysis, scenario stress-testing, and real-time news-driven alerts — all in plain language.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Environment Variables](#environment-variables)
- [Data](#data)
- [API Overview](#api-overview)

---

## Features

- **Personalised ETF Recommendations** — Users complete a short risk-tolerance questionnaire (Conservative / Balanced / Aggressive) and receive 3–4 tailored ETF suggestions ranked by Sharpe ratio, max drawdown, and volatility.
- **Scenario Analysis & Stress Testing** — Monte Carlo simulations against historical crises (2008 crash, COVID-19) and hypothetical macro shocks (rising rates, energy crisis).
- **Real-Time News & Alerts** — GPT-powered news summarisation with positive/negative/neutral impact scoring; alerts when portfolio ETFs are affected.
- **Explainable AI Dashboard** — Interactive chatbox per ETF for plain-language Q&A backed by holdings data, macro signals, and recent news.
- **Portfolio Dashboard** — Track saved ETFs, view risk metrics, run scenario simulations, and monitor live news impact.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React 18, Tailwind CSS, Recharts |
| Backend | Python, FastAPI, SQLAlchemy, APScheduler |
| Database | PostgreSQL |
| AI / ML | OpenAI GPT API, MPT (Sharpe, drawdown, volatility) |
| Data Sources | Yahoo Finance, Alpha Vantage, Finnhub, FRED |
| Auth | JWT (python-jose), bcrypt |

---

## Project Structure

```
project/
├── frontend/            # Next.js / React app
│   └── src/             # App source (pages, components, contexts, lib)
├── backend/             # FastAPI app
│   ├── app/             # Routes, services, models, schemas
│   └── scripts/         # One-off ETL / price-update scripts
├── data/                # Raw & processed data used for DB seeding
│   ├── official/        # Cleaned price & macro CSVs (SG & US)
│   ├── processed/       # Combined ETF metadata & quality ETF list
│   └── user_info/       # Quiz questions (quiz_qus.json) — read at runtime
├── notebooks/           # Jupyter notebooks for data prep & analytics
├── etf_scrap/           # ETF metadata scraping utilities
├── docs/                # Project documentation & report
├── requirements.txt     # Python dependencies (see also frontend/src/package.json)
└── README.md
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL (running locally or a connection URL)

### Backend Setup

```bash
# 1. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # macOS / Linux
# venv\Scripts\activate         # Windows

# 2. Install dependencies
pip install -r requirements.txt

# 3. Copy and fill in environment variables
cp backend/.env.example backend/.env

# 4. Run database migrations
cd backend
alembic upgrade head

# 5. Start the API server
uvicorn app.main:app --reload
# API available at http://localhost:8000
# Docs at http://localhost:8000/docs
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
# App available at http://localhost:3000
```

---

## Environment Variables

Create a `backend/.env` file with the following keys:

```env
DATABASE_URL=postgresql+pg8000://user:password@localhost:5432/etf_db
SECRET_KEY=your_jwt_secret
OPENAI_API_KEY=your_openai_key
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
FINNHUB_API_KEY=your_finnhub_key
```

---

## Data

All data files live under `data/`. Only `data/user_info/quiz_qus.json` is read at runtime by the backend. Everything else (`data/official/`, `data/processed/`) was used offline via Jupyter notebooks to seed the database.

To update ETF prices manually:

```bash
cd backend
python scripts/update_prices_simple.py
```

---

## API Overview

| Prefix | Description |
|--------|-------------|
| `GET /etfs` | List all ETFs with filters |
| `GET /etfs/{ticker}/prices` | Historical price data |
| `GET /etfs/{ticker}/metrics` | Sharpe, volatility, drawdown, beta |
| `GET /recommendations` | ETF recommendations by risk profile |
| `GET /macro/{indicator_name}` | Macro indicator time series |
| `GET /news/ticker/{ticker}` | News & sentiment for an ETF |
| `POST /scenarios/analyze` | Run Monte Carlo / stress test |
| `POST /quiz/submit` | Submit risk questionnaire |
| `POST /auth/signup` · `POST /auth/login` | Authentication |
| `GET/POST /portfolio` | User portfolio (auth required) |

Full interactive docs: `http://localhost:8000/docs`