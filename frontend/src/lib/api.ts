/**
 * API Client for ETF Recommendation Backend
 */
import axios from 'axios';

// API Base URL - change this for production
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Set authentication token for API requests
export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

// Get authentication token from localStorage (for initial setup)
if (typeof window !== 'undefined') {
  const token = localStorage.getItem('authToken');
  if (token) {
    setAuthToken(token);
  }
}

// Types
export interface ETF {
  ticker: string;
  etf_name: string;
  category: string | null;
  asset_class: string | null;
  expense_ratio: string | null;
  aum: string | null;
  ytd_return: string | null;
  beta: string | null;
  annual_dividend_yield: string | null;
}

export interface ETFDetail extends ETF {
  issuer: string | null;
  brand: string | null;
  asset_class_size: string | null;
  asset_class_style: string | null;
  general_region: string | null;
  specific_region: string | null;
  inception: string | null;
  index_tracked: string | null;
  '1_month_return': string | null;
  '3_month_return': string | null;
  '1_year_return': string | null;
  '3_year_return': string | null;
  '5_year_return': string | null;
  standard_deviation: string | null;
  '52_week_low': string | null;
  '52_week_high': string | null;
  top_holdings: string | null;
  sector_breakdown: string | null;
  analyst_report: string | null;
}

export interface ETFListResponse {
  etfs: ETF[];
  total: number;
  page: number;
  page_size: number;
}

export interface PriceData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface QuizQuestion {
  question_id: number;
  question_text: string;
  question_type: string;
  options: {
    option_id: string;
    text: string;
    points: number;
  }[];
  scoring_note?: string;
}

export interface QuizQuestionsResponse {
  title: string;
  description: string;
  total_questions: number;
  questions: QuizQuestion[];
}

export interface QuizResult {
  total_score: number;
  max_possible_score: number;
  percentage: number;
  risk_profile: string;
  profile_description: string;
  breakdown: {
    question_id: number;
    question_text: string;
    selected_option: string;
    points_earned: number;
    max_points: number;
  }[];
}

export interface NewsTicker {
  ticker: string;
  ticker_sentiment_score: number;
  ticker_sentiment_label: string;
  relevance_score: number;
}

export interface NewsArticle {
  id: number;
  title: string;
  url: string;
  source: string;
  summary: string;
  banner_image?: string;
  time_published: string;
  overall_sentiment_score: number;
  overall_sentiment_label: string;
  tickers: NewsTicker[];
}

export interface NewsAlert {
  article: {
    id: number;
    title: string;
    url: string;
    overall_sentiment_score: number;
  };
  affected_tickers: string[];
  alert_reason: string;
}

export interface RecommendedETF {
  ticker: string;
  etf_name: string;
  category: string | null;
  asset_class: string | null;
  expense_ratio: string | null;
  aum: string | null;
  ytd_return: string | null;
  beta: string | null;
  annual_dividend_yield: string | null;
  recommendation_score: number;
  recommendation_reason: string;
}

export interface RecommendationResponse {
  risk_profile: string;
  profile_description: string;
  total_matches: number;
  recommendations: RecommendedETF[];
  filter_criteria: {
    beta_range: string;
    preferred_categories: string[];
    avoid_categories: string[];
  };
}

export interface MacroIndicator {
  indicator_name: string;
  description: string;
  latest_value: number;
  latest_date: string;
  total_records: number;
}

export interface ETFMetrics {
  return_1m: number | null;
  return_3m: number | null;
  return_6m: number | null;
  return_ytd: number | null;
  return_1y: number | null;
  return_3y: number | null;
  return_5y: number | null;
  volatility: number | null;
  beta: number | null;
  sharpe_ratio: number | null;
  max_drawdown: number | null;
  week_52_high: number | null;
  week_52_low: number | null;
  risk_free_rate_used: number | null;
}

export interface ETFMetricsResponse {
  ticker: string;
  latest_price: number | null;
  latest_date: string | null;
  data_points: number;
  metrics: ETFMetrics;
}

// API Functions

// ETFs
export const getETFs = async (params?: {
  page?: number;
  page_size?: number;
  category?: string;
  asset_class?: string;
  region?: string;
  search?: string;
}): Promise<ETFListResponse> => {
  const { data } = await api.get('/etfs', { params });
  return data;
};

export const getETFDetail = async (ticker: string): Promise<ETFDetail> => {
  const { data } = await api.get(`/etfs/${ticker}`);
  return data;
};

export const getETFSummary = async (ticker: string) => {
  const { data } = await api.get(`/etfs/${ticker}/summary`);
  return data;
};

export const getFilterOptions = async () => {
  const { data } = await api.get('/etfs/filters/options');
  return data;
};

// Prices
export const getETFPrices = async (ticker: string, params?: {
  days?: number;
  start_date?: string;
  end_date?: string;
}): Promise<{ ticker: string; prices: PriceData[] }> => {
  const { data } = await api.get(`/etfs/${ticker}/prices`, { params });
  return data;
};

export const getETFChartData = async (ticker: string, period: string = '1y') => {
  const { data } = await api.get(`/etfs/${ticker}/prices/chart`, { params: { period } });
  return data;
};

// Metrics
export const getETFMetrics = async (ticker: string): Promise<ETFMetricsResponse> => {
  const { data } = await api.get(`/etfs/${ticker}/metrics`);
  return data;
};

export const compareETFMetrics = async (tickers: string[]): Promise<{ comparison: any[]; metrics_description: Record<string, string> }> => {
  const { data } = await api.get('/etfs/metrics/compare', { params: { tickers: tickers.join(',') } });
  return data;
};

// Macro
export const getMacroIndicators = async (): Promise<{ indicators: MacroIndicator[] }> => {
  const { data } = await api.get('/macro/indicators');
  return data;
};

export const getMacroDashboard = async () => {
  const { data } = await api.get('/macro/dashboard/summary');
  return data;
};

// Quiz
export const getQuizQuestions = async (): Promise<QuizQuestionsResponse> => {
  const { data } = await api.get('/quiz/questions');
  return data;
};

export const submitQuiz = async (answers: Record<string, string>): Promise<QuizResult> => {
  const { data } = await api.post('/quiz/submit', { answers });
  return data;
};

export const getQuizScoringInfo = async () => {
  const { data } = await api.get('/quiz/scoring-info');
  return data;
};

// Recommendations
export const getRecommendations = async (
  profile: 'conservative' | 'balanced' | 'aggressive',
  limit: number = 10
): Promise<RecommendationResponse> => {
  const { data } = await api.get('/recommendations', { params: { profile, limit } });
  return data;
};

export const getRecommendationProfiles = async () => {
  const { data } = await api.get('/recommendations/profiles');
  return data;
};

// News
export const getNewsByTicker = async (ticker: string, limit: number = 10): Promise<NewsArticle[]> => {
  const { data } = await api.get(`/news/ticker/${ticker}`, { params: { limit } });
  return data.articles || [];
};

export const getPortfolioNews = async (userId: number, limit: number = 20): Promise<NewsArticle[]> => {
  const { data } = await api.get(`/news/portfolio/${userId}`, { params: { limit } });
  return data.articles || [];
};

export const getNewsAlerts = async (
  userId: number, 
  limit: number = 5, 
  sentimentThreshold: number = -0.3,
  relevanceThreshold: number = 0.5
): Promise<NewsAlert[]> => {
  const { data } = await api.get(`/news/alerts/${userId}`, { 
    params: { limit, sentiment_threshold: sentimentThreshold, relevance_threshold: relevanceThreshold } 
  });
  return data.alerts || [];
};

export const refreshTopNews = async (): Promise<{ status: string; message: string; stats: any }> => {
  const { data } = await api.post('/news/refresh/top100');
  return data;
};

export const refreshTickerNews = async (ticker: string): Promise<{ status: string; message: string; stats: any }> => {
  const { data } = await api.post(`/news/refresh/ticker/${ticker}`);
  return data;
};

export const refreshPortfolioNews = async (userId: number): Promise<{ status: string; message: string; stats: any; tickers?: string[] }> => {
  const { data } = await api.post(`/news/refresh/portfolio/${userId}`);
  return data;
};

// ============================================
// SCENARIO ANALYSIS API
// ============================================

export interface ScenarioOption {
  id: string;
  name: string;
  description: string;
  period?: string;
  type: 'historical' | 'stress_test';
  requires_data?: boolean;
  shock_percent?: number;
}

export interface HoldingImpact {
  ticker: string;
  quantity: number;
  initial_value: number;
  scenario_value: number;
  change_percent: number;
  change_amount: number;
  max_drawdown?: number;
  historical_prices?: {
    start: number;
    end: number;
  };
  note?: string;
}

export interface ScenarioResult {
  scenario_name: string;
  description?: string;
  period?: {
    start: string;
    end: string;
    duration_days: number;
  };
  shock_applied?: number;
  portfolio_summary: {
    initial_value: number;
    scenario_value: number;
    change_amount: number;
    change_percent: number;
    holdings_count: number;
  };
  holdings: HoldingImpact[];
  insights?: {
    worst_performer: string | null;
    worst_decline: number | null;
    best_performer: string | null;
    best_performance: number | null;
  };
}

export const getAvailableScenarios = async (): Promise<ScenarioOption[]> => {
  const { data } = await api.get('/scenarios/available');
  return data.scenarios;
};

export const analyzeScenario = async (
  scenarioId: string,
  holdings?: Array<{ ticker: string; quantity: number; purchase_price: number }>
): Promise<ScenarioResult> => {
  const { data } = await api.post('/scenarios/analyze', {
    scenario_id: scenarioId,
    holdings: holdings || undefined
  });
  return data;
};

export const analyzePortfolioCovid = async (): Promise<ScenarioResult> => {
  const { data } = await api.get('/scenarios/portfolio/covid');
  return data;
};

// VaR Types
export interface VarMethod {
  var_amount: number;
  var_percent: number;
  description: string;
}

export interface CVarMethod {
  var_amount: number;
  var_percent: number;
  description: string;
}

export interface PortfolioStatistics {
  mean_daily_return: number;
  daily_volatility: number;
  annualized_volatility: number;
  worst_day_return: number;
  best_day_return: number;
}

export interface HoldingAnalysis {
  ticker: string;
  weight: number;
  data_points: number;
}

export interface VarResult {
  portfolio_value: number;
  confidence_level: number;
  time_horizon_days: number;
  data_points: number;
  var_methods: {
    historical: VarMethod;
    parametric: VarMethod;
  };
  cvar_methods: {
    historical: CVarMethod;
    parametric: CVarMethod;
  };
  portfolio_statistics: PortfolioStatistics;
  holdings_analyzed: HoldingAnalysis[];
}

export const getPortfolioVar = async (
  confidenceLevel: number = 0.95,
  timeHorizonDays: number = 252
): Promise<VarResult> => {
  const { data } = await api.get('/scenarios/var', {
    params: { 
      confidence_level: confidenceLevel, 
      time_horizon_days: timeHorizonDays 
    }
  });
  return data;
};

export default api;

