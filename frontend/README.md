# Frontend — AI-Powered ETF Advisor

Next.js frontend for browsing ETFs, completing a risk questionnaire, managing a portfolio, and receiving AI-driven recommendations.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14.2.5 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Data Fetching | TanStack React Query v5 + Axios |
| Charts | Recharts v3 |
| Icons | lucide-react |
| Fonts | DM Sans + JetBrains Mono |

## Project Structure

```
frontend/
├── app/                        # Next.js App Router pages
│   ├── layout.tsx              # Root layout: fonts, Header, Providers
│   ├── globals.css
│   ├── page.tsx                # Landing page
│   ├── login/page.tsx          # Login form
│   ├── signup/page.tsx         # Signup form
│   ├── questionnaire/page.tsx  # Risk questionnaire
│   ├── recommendations/page.tsx# ETF recommendations
│   ├── etfs/
│   │   ├── page.tsx            # ETF discovery / browse
│   │   └── [ticker]/page.tsx   # ETF detail page
│   └── portfolio/page.tsx      # Portfolio dashboard (auth-gated)
├── components/
│   ├── Header.tsx              # Top navigation bar
│   ├── NewsFeed.tsx            # Scrollable news article list
│   ├── NewsCard.tsx            # News card with sentiment badge
│   ├── NewsModal.tsx           # News article detail modal
│   ├── NewsAlertBadge.tsx      # Alert badge for high-impact news
│   ├── ScenarioAnalysis.tsx    # Stress test UI
│   ├── VarAnalysis.tsx         # Value at Risk display
│   └── ErrorBoundary.tsx       # React error boundary
├── contexts/
│   └── AuthContext.tsx         # Auth state: user, token, login/logout helpers
└── lib/
    ├── api.ts                  # Axios client and all typed API call functions
    └── providers.tsx           # QueryClientProvider + AuthProvider wrapper
```

## Setup

### Prerequisites

- Node.js 18+
- Backend running at `http://localhost:8000` (or configure via env)

### Installation

```bash
cd frontend
npm install
```

### Environment Variables

Create a `.env.local` file in the `frontend/` directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Running the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

### Building for Production

```bash
npm run build
npm start
```

## Deploying Frontend To Vercel (Backend on Render)

1. Push your latest `frontend` code to GitHub.
2. In Vercel, import the repository and set Root Directory to `frontend`.
3. Keep the default framework detection (Next.js).
4. Add environment variable in Vercel:

```env
NEXT_PUBLIC_API_URL=https://your-render-service.onrender.com
```

5. Deploy.

After deployment:
- Update backend Render environment variable `FRONTEND_ORIGINS` with your Vercel URL.
- If you use Vercel preview deployments, set `FRONTEND_ORIGIN_REGEX=https://.*\\.vercel\\.app` in Render.
- Redeploy Render so CORS changes take effect.

## Pages

| Route | Description |
|---|---|
| `/` | Landing page — product hero and feature overview |
| `/login` | Email/password login |
| `/signup` | New account registration |
| `/questionnaire` | Multi-question risk quiz → conservative / balanced / aggressive profile |
| `/recommendations` | Top ETF picks for the selected risk profile |
| `/etfs` | Paginated, filterable ETF browse (category, asset class, region, search) |
| `/etfs/[ticker]` | ETF detail: price chart, performance metrics, news feed |
| `/portfolio` | Authenticated dashboard: holdings, P&L, allocation chart, news, scenario analysis, VaR |

## Authentication

- JWT tokens are stored in `localStorage` after login.
- `AuthContext` auto-rehydrates the session on mount by calling `GET /auth/me`.
- The token is injected into all Axios requests via `setAuthToken()`.
- Protected pages (e.g. `/portfolio`) redirect unauthenticated users to `/login`.

## Key Components

### `ScenarioAnalysis`
Lets users stress-test their portfolio against historical events (COVID-19 crash, Feb–Mar 2020) and hypothetical shocks (−10 %, −20 %, −30 %).

### `VarAnalysis`
Displays Value at Risk (VaR) estimates at configurable confidence levels for the user's portfolio.

### `NewsFeed` / `NewsCard` / `NewsModal`
Render news articles with sentiment labels (positive / neutral / negative) and surface urgent alerts via `NewsAlertBadge`.

## API Integration

All API calls are defined in `lib/api.ts` using Axios. TanStack React Query handles caching, loading states, and background refetching throughout the app.
