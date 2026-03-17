'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { getPortfolioNews, NewsArticle, getAvailableScenarios, ScenarioOption, getPortfolioVar, VarResult, refreshPortfolioNews } from '@/lib/api';
import NewsFeed from '@/components/NewsFeed';
import ScenarioAnalysis from '@/components/ScenarioAnalysis';
import VarAnalysis from '@/components/VarAnalysis';
import { 
  TrendingUp, TrendingDown, Trash2, Plus, Search, Loader2, 
  AlertCircle, PieChart, Wallet, ArrowUpRight, ArrowDownRight,
  RefreshCw, X, Check, Edit2, BarChart3, DollarSign, LogIn, Info, ChevronDown, ChevronUp
} from 'lucide-react';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface PortfolioHolding {
  id: number;
  ticker: string;
  quantity: number;
  purchase_price: number;
  purchase_date: string;
  etf_name: string | null;
  category: string | null;
  current_price: number | null;
  current_value: number | null;
  gain_loss: number | null;
  gain_loss_percent: number | null;
}

interface PortfolioResponse {
  total_value: number;
  total_cost: number;
  total_gain_loss: number;
  total_gain_loss_percent: number;
  holdings_count: number;
  holdings: PortfolioHolding[];
}

interface PortfolioTimeseriesPoint {
  date: string;
  invested_capital: number;
  market_value: number;
  unrealized_pl: number;
  unrealized_return_percent: number;
}

interface ETFSearchResult {
  ticker: string;
  name: string;
  asset_class: string | null;
  category: string | null;
}

const COLORS = ['#55b2c9', '#1cb08a', '#F59E0B', '#d44a4a', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

const PORTFOLIO_INFO = {
  marketValue: 'Current market value of all holdings based on latest available prices.',
  investedCapital: 'Total amount invested: sum of quantity multiplied by average cost for each holding.',
  unrealizedPL: 'Profit or loss if you sold now. Calculated as Market Value minus Invested Capital.',
  unrealizedReturn: 'Unrealized P/L divided by Invested Capital, shown as a percentage.',
  growthChart: 'Daily portfolio valuation based on historical ETF prices from your first purchase date.',
  quantity: 'Number of ETF units currently held.',
  purchaseDate: 'Date when this holding was purchased.',
  avgCost: 'Average purchase price per unit for this holding.',
  lastPrice: 'Latest available market close price per unit.',
  marketValueCol: 'Current value of this holding: quantity multiplied by latest price.',
  unrealizedPLCol: 'Unrealized return for this holding based on current value versus cost basis.',
  weight: 'This holding as a percentage of total portfolio market value.',
};

export default function PortfolioPage() {
  const router = useRouter();
  const { user, token, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [portfolioTimeseries, setPortfolioTimeseries] = useState<PortfolioTimeseriesPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTicker, setSearchTicker] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<ETFSearchResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [newQuantity, setNewQuantity] = useState<string>('');
  const [newPrice, setNewPrice] = useState<string>('');
  const [newPurchaseDate, setNewPurchaseDate] = useState<string>('');
  const [addLoading, setAddLoading] = useState(false);
  const [editingTicker, setEditingTicker] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState<string>('');
  const [editPrice, setEditPrice] = useState<string>('');
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [scenarios, setScenarios] = useState<ScenarioOption[]>([]);
  const [activeInsightTab, setActiveInsightTab] = useState<'scenario' | 'var' | 'news'>('scenario');
  const [showVisualsSection, setShowVisualsSection] = useState(true);
  const [showHoldingsSection, setShowHoldingsSection] = useState(true);
  const [showInsightsSection, setShowInsightsSection] = useState(false);

  // Fetch portfolio data from backend
  const fetchPortfolio = async () => {
    if (!token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const portfolioRes = await axios.get<PortfolioResponse>(`${API_BASE_URL}/portfolio`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPortfolio(portfolioRes.data);

      try {
        const timeseriesRes = await axios.get<PortfolioTimeseriesPoint[]>(`${API_BASE_URL}/portfolio/timeseries`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPortfolioTimeseries(timeseriesRes.data || []);
      } catch (timeseriesErr) {
        console.warn('Failed to load portfolio timeseries:', timeseriesErr);
        setPortfolioTimeseries([]);
      }
    } catch (err) {
      console.error('Failed to fetch portfolio:', err);
      setError('Failed to load portfolio. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch news data
  const fetchNews = async () => {
    if (!user?.id) return;
    try {
      setNewsLoading(true);
      const data = await getPortfolioNews(user.id, 20);
      setNews(data);
    } catch (error) {
      console.error('Failed to fetch news:', error);
    } finally {
      setNewsLoading(false);
    }
  };

  const handleRefreshNews = async () => {
    try {
      setNewsLoading(true);
      if (user?.id) {
        await refreshPortfolioNews(user.id);
      }
      if (user?.id) {
        const data = await getPortfolioNews(user.id, 20);
        setNews(data);
      }
    } catch (error) {
      console.error('Failed to refresh news:', error);
      if (user?.id) {
        try {
          const data = await getPortfolioNews(user.id, 20);
          setNews(data);
        } catch (fetchError) {
          console.error('Failed to fetch news after refresh attempt:', fetchError);
        }
      }
    } finally {
      setNewsLoading(false);
    }
  };

  // Fetch available scenarios
  const fetchScenarios = async () => {
    try {
      const data = await getAvailableScenarios();
      setScenarios(data);
    } catch (error) {
      console.error('Failed to fetch scenarios:', error);
    }
  };

  // Fetch portfolio when authenticated
  useEffect(() => {
    if (isAuthenticated && token) {
      fetchPortfolio();
      fetchNews();
      fetchScenarios();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [isAuthenticated, token, authLoading]);

  // Search for ETF
  const handleSearch = async () => {
    if (!searchTicker.trim()) return;
    setSearchLoading(true);
    setSearchError(null);
    setSearchResult(null);
    
    try {
      const response = await axios.get(`${API_BASE_URL}/etfs/${searchTicker.toUpperCase()}`);
      setSearchResult({
        ticker: response.data.ticker,
        name: response.data.name,
        asset_class: response.data.asset_class,
        category: response.data.category
      });
    } catch (err) {
      setSearchError('ETF not found. Please check the ticker symbol.');
    } finally {
      setSearchLoading(false);
    }
  };

  // Add ETF to portfolio
  const handleAddETF = async () => {
    if (!searchResult || !newQuantity || !token) return;
    
    const quantity = parseFloat(newQuantity);
    const price = parseFloat(newPrice) || 0;
    
    if (isNaN(quantity) || quantity <= 0) {
      setSearchError('Please enter a valid quantity');
      return;
    }
    
    setAddLoading(true);
    setSearchError(null);
    
    try {
      await axios.post(
        `${API_BASE_URL}/portfolio`,
        {
          ticker: searchResult.ticker,
          quantity,
          purchase_price: price,
          purchase_date: newPurchaseDate || undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Refresh portfolio
      await fetchPortfolio();
      
      // Reset modal
      setShowAddModal(false);
      setSearchTicker('');
      setSearchResult(null);
      setNewQuantity('');
      setNewPrice('');
      setNewPurchaseDate('');
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.detail) {
        setSearchError(err.response.data.detail);
      } else {
        setSearchError('Failed to add ETF. Please try again.');
      }
    } finally {
      setAddLoading(false);
    }
  };

  // Remove ETF from portfolio
  const handleRemoveETF = async (ticker: string) => {
    if (!token) return;
    
    try {
      await axios.delete(`${API_BASE_URL}/portfolio/${ticker}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchPortfolio();
    } catch (err) {
      console.error('Failed to remove ETF:', err);
    }
  };

  // Update ETF holdings
  const handleUpdateETF = async (ticker: string) => {
    if (!token) return;
    
    const quantity = parseFloat(editQuantity);
    const price = parseFloat(editPrice) || 0;
    
    if (isNaN(quantity) || quantity <= 0) return;
    
    try {
      await axios.put(
        `${API_BASE_URL}/portfolio/${ticker}`,
        { quantity, purchase_price: price },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchPortfolio();
      setEditingTicker(null);
    } catch (err) {
      console.error('Failed to update ETF:', err);
    }
  };

  // Prepare pie chart data
  const pieData = portfolio?.holdings.map((item, index) => ({
    name: item.ticker,
    value: item.current_value || item.quantity * item.purchase_price,
    color: COLORS[index % COLORS.length]
  })).filter(d => d.value > 0) || [];

  const growthData = portfolioTimeseries.map((p) => ({
    date: p.date,
    investedCapital: p.invested_capital,
    currentMarketValue: p.market_value,
  }));

  const growthChart = useMemo(() => {
    if (growthData.length <= 120) {
      return {
        resolution: 'daily' as const,
        data: growthData,
      };
    }

    if (growthData.length <= 365) {
      const weekly = new Map<string, (typeof growthData)[number]>();
      growthData.forEach((point) => {
        const d = new Date(point.date);
        const day = d.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        d.setDate(d.getDate() + diffToMonday);
        const key = d.toISOString().slice(0, 10);
        weekly.set(key, { ...point, date: key });
      });
      return {
        resolution: 'weekly' as const,
        data: Array.from(weekly.values()),
      };
    }

    const monthly = new Map<string, (typeof growthData)[number]>();
    growthData.forEach((point) => {
      const d = new Date(point.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      monthly.set(key, { ...point, date: key });
    });
    return {
      resolution: 'monthly' as const,
      data: Array.from(monthly.values()),
    };
  }, [growthData]);

  const formatGrowthXAxis = (value: string) => {
    const d = new Date(value);
    if (growthChart.resolution === 'daily') {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    if (growthChart.resolution === 'weekly') {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  const formatGrowthTooltipLabel = (label: string) => {
    const d = new Date(label);
    if (growthChart.resolution === 'monthly') {
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const hasPortfolioHoldings = !!portfolio && portfolio.holdings.length > 0;
  const canShowScenario = isAuthenticated && hasPortfolioHoldings && scenarios.length > 0;
  const canShowVar = isAuthenticated && !!user;
  const canShowNews = isAuthenticated && !!user;

  const availableInsightTabs = [
    canShowScenario ? 'scenario' : null,
    canShowVar ? 'var' : null,
    canShowNews ? 'news' : null,
  ].filter((tab): tab is 'scenario' | 'var' | 'news' => tab !== null);

  useEffect(() => {
    if (availableInsightTabs.length === 0) return;
    if (!availableInsightTabs.includes(activeInsightTab)) {
      setActiveInsightTab(availableInsightTabs[0]);
    }
  }, [activeInsightTab, availableInsightTabs]);

  // Show login prompt if not authenticated
  if (!authLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-white">
        {/* Login Required Message */}
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
          <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(85,178,201,0.06)] border-[1.5px] border-[#cae7ee] p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-[rgba(85,178,201,0.12)] rounded-full flex items-center justify-center mx-auto mb-6">
              <LogIn className="w-8 h-8 text-[#3d96ad]" />
            </div>
            <h1 className="text-2xl font-bold text-[#0d1117] mb-3">Sign in to view your portfolio</h1>
            <p className="text-[#3a5260] mb-8">
              Create an account or sign in to track your ETF holdings and see your portfolio performance.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/login"
                className="px-6 py-3 bg-[#6366f1] text-white rounded-xl font-medium hover:bg-[#4f46e5] transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="px-6 py-3 border border-[#cae7ee] text-[#3a5260] rounded-xl font-medium hover:bg-[#f0f8fa] transition-colors"
              >
                Create Account
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0d1117]">My Portfolio</h1>
            <p className="text-[#3a5260] mt-1">Track your ETF holdings and performance</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchPortfolio}
              className="flex items-center gap-2 px-4 py-2 border border-[#cae7ee] rounded-lg text-[#3a5260] hover:bg-[#f0f8fa] transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-[#55b2c9] animate-spin mb-4" />
            <p className="text-[#3a5260]">Loading portfolio...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-[#d44a4a12] border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-[#d44a4a] flex-shrink-0" />
            <p className="text-[#d44a4a]">{error}</p>
          </div>
        )}

        {/* Empty Portfolio */}
        {!loading && portfolio && portfolio.holdings.length === 0 && (
          <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(85,178,201,0.06)] border-[1.5px] border-[#cae7ee] p-12 text-center">
            <div className="w-16 h-16 bg-[#f0f8fa] rounded-full flex items-center justify-center mx-auto mb-6">
              <Wallet className="w-8 h-8 text-[#7a9fad]" />
            </div>
            <h2 className="text-xl font-semibold text-[#0d1117] mb-2">Your portfolio is empty</h2>
            <p className="text-[#3a5260] mb-6">Start building your portfolio by adding ETFs</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#6366f1] text-white rounded-xl font-medium hover:bg-[#4f46e5] transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Your First ETF
            </button>
          </div>
        )}

        {/* Portfolio Content */}
        {!loading && portfolio && portfolio.holdings.length > 0 && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <div className="bg-white rounded-xl border border-[#cae7ee] p-4">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 bg-[rgba(85,178,201,0.12)] rounded-lg flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-[#3d96ad]" />
                  </div>
                  <span className="text-[#3a5260] text-xs inline-flex items-center gap-1">
                    Market Value
                    <InfoTooltip text={PORTFOLIO_INFO.marketValue} />
                  </span>
                </div>
                <p className="text-xl font-bold text-[#0d1117]">
                  ${portfolio.total_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              
              <div className="bg-white rounded-xl border border-[#cae7ee] p-4">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 bg-[#f0f8fa] rounded-lg flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-[#3a5260]" />
                  </div>
                  <span className="text-[#3a5260] text-xs inline-flex items-center gap-1">
                    Invested Capital
                    <InfoTooltip text={PORTFOLIO_INFO.investedCapital} />
                  </span>
                </div>
                <p className="text-xl font-bold text-[#0d1117]">
                  ${portfolio.total_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              
              <div className="bg-white rounded-xl border border-[#cae7ee] p-4">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${portfolio.total_gain_loss >= 0 ? 'bg-[#1cb08a12]' : 'bg-[#d44a4a12]'}`}>
                    {portfolio.total_gain_loss >= 0 ? (
                      <ArrowUpRight className="w-4 h-4 text-[#1cb08a]" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 text-[#d44a4a]" />
                    )}
                  </div>
                  <span className="text-[#3a5260] text-xs inline-flex items-center gap-1">
                    Unrealized P/L
                    <InfoTooltip text={PORTFOLIO_INFO.unrealizedPL} />
                  </span>
                </div>
                <p className={`text-xl font-bold ${portfolio.total_gain_loss >= 0 ? 'text-[#1cb08a]' : 'text-[#d44a4a]'}`}>
                  {portfolio.total_gain_loss >= 0 ? '+' : ''}${portfolio.total_gain_loss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              
              <div className="bg-white rounded-xl border border-[#cae7ee] p-4">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${portfolio.total_gain_loss_percent >= 0 ? 'bg-[#1cb08a12]' : 'bg-[#d44a4a12]'}`}>
                    <BarChart3 className={`w-4 h-4 ${portfolio.total_gain_loss_percent >= 0 ? 'text-[#1cb08a]' : 'text-[#d44a4a]'}`} />
                  </div>
                  <span className="text-[#3a5260] text-xs inline-flex items-center gap-1">
                    Unrealized Return
                    <InfoTooltip text={PORTFOLIO_INFO.unrealizedReturn} />
                  </span>
                </div>
                <p className={`text-xl font-bold ${portfolio.total_gain_loss_percent >= 0 ? 'text-[#1cb08a]' : 'text-[#d44a4a]'}`}>
                  {portfolio.total_gain_loss_percent >= 0 ? '+' : ''}{portfolio.total_gain_loss_percent.toFixed(2)}%
                </p>
              </div>
            </div>

            {/* Growth and Allocation */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#0d1117]">Portfolio Visuals</h2>
              <button
                onClick={() => setShowVisualsSection((prev) => !prev)}
                className="inline-flex items-center gap-1 text-sm text-[#3a5260] hover:text-[#0d1117]"
              >
                {showVisualsSection ? 'Hide' : 'Show'}
                {showVisualsSection ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {showVisualsSection && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
              <div className="lg:col-span-3 bg-white rounded-xl border border-[#cae7ee] p-6">
                <h2 className="text-lg font-semibold text-[#0d1117] mb-1 inline-flex items-center gap-1">
                  Portfolio Growth Since Purchase
                  <InfoTooltip text={PORTFOLIO_INFO.growthChart} />
                </h2>
                <p className="text-xs text-[#7a9fad] mb-4">Daily valuation based on historical prices from your first purchase date.</p>
                <div className="h-52">
                  {growthChart.data.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={growthChart.data}>
                        <defs>
                          <linearGradient id="investedFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="marketFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="date"
                          interval="preserveStartEnd"
                          minTickGap={32}
                          tick={{ fontSize: 12, fill: '#64748b' }}
                          tickFormatter={formatGrowthXAxis}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: '#64748b' }}
                          tickFormatter={(value) => `$${(Number(value) / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          formatter={(value: number | undefined, name) => {
                            const safeValue = typeof value === 'number' ? value : 0;
                            return [
                              `$${safeValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                              name === 'investedCapital' ? 'Invested Capital' : 'Current Market Value'
                            ];
                          }}
                          labelFormatter={formatGrowthTooltipLabel}
                        />
                        <Area type="monotone" dataKey="investedCapital" stroke="#64748b" fill="url(#investedFill)" strokeWidth={2} />
                        <Area type="monotone" dataKey="currentMarketValue" stroke="#6366f1" fill="url(#marketFill)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm text-[#7a9fad]">
                      Not enough historical price data to visualize growth.
                    </div>
                  )}
                </div>
              </div>

              {/* Pie Chart */}
              <div className="bg-white rounded-xl border border-[#cae7ee] p-5">
                <h2 className="text-lg font-semibold text-[#0d1117] mb-4 flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-[#55b2c9]" />
                  Allocation
                </h2>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPie>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={38}
                        outerRadius={62}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value?: number) => [`$${(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Value']}
                      />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 mt-4 max-h-40 overflow-y-auto pr-1">
                  {pieData.map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-[#3a5260]">{item.name}</span>
                      </div>
                      <span className="text-[#0d1117] font-medium">
                        {((item.value / portfolio.total_value) * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            )}

            {/* Holdings List */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#0d1117]">Holdings</h2>
              <button
                onClick={() => setShowHoldingsSection((prev) => !prev)}
                className="inline-flex items-center gap-1 text-sm text-[#3a5260] hover:text-[#0d1117]"
              >
                {showHoldingsSection ? 'Hide' : 'Show'}
                {showHoldingsSection ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {showHoldingsSection && (
            <div className="bg-white rounded-xl border border-[#cae7ee] overflow-hidden">
                <div className="p-6 border-b border-[#cae7ee] flex items-center justify-between gap-4">
                  <h2 className="text-lg font-semibold text-[#0d1117] flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-[#55b2c9]" />
                    Holdings ({portfolio.holdings_count})
                  </h2>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#6366f1] text-white rounded-lg text-sm font-medium hover:bg-[#4f46e5] transition-colors whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    Add ETF
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead className="bg-[#f8fafc] text-[#64748b]">
                      <tr>
                        <th className="text-left font-medium px-4 py-3">Ticker</th>
                        <th className="text-left font-medium px-4 py-3">Name</th>
                        <th className="text-right font-medium px-4 py-3">
                          <span className="inline-flex items-center gap-1">Quantity <InfoTooltip text={PORTFOLIO_INFO.quantity} /></span>
                        </th>
                        <th className="text-right font-medium px-4 py-3">
                          <span className="inline-flex items-center gap-1">Purchase Date <InfoTooltip text={PORTFOLIO_INFO.purchaseDate} /></span>
                        </th>
                        <th className="text-right font-medium px-4 py-3">
                          <span className="inline-flex items-center gap-1">Avg. Cost <InfoTooltip text={PORTFOLIO_INFO.avgCost} /></span>
                        </th>
                        <th className="text-right font-medium px-4 py-3">
                          <span className="inline-flex items-center gap-1">Last Price <InfoTooltip text={PORTFOLIO_INFO.lastPrice} /></span>
                        </th>
                        <th className="text-right font-medium px-4 py-3">
                          <span className="inline-flex items-center gap-1">Market Value <InfoTooltip text={PORTFOLIO_INFO.marketValueCol} /></span>
                        </th>
                        <th className="text-right font-medium px-4 py-3">
                          <span className="inline-flex items-center gap-1">Unrealized P/L <InfoTooltip text={PORTFOLIO_INFO.unrealizedPLCol} /></span>
                        </th>
                        <th className="text-right font-medium px-4 py-3">
                          <span className="inline-flex items-center gap-1">Weight <InfoTooltip text={PORTFOLIO_INFO.weight} /></span>
                        </th>
                        <th className="text-right font-medium px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolio.holdings.map((holding) => (
                        <tr key={holding.ticker} className="border-t border-[#cae7ee] hover:bg-[#f8fafc]">
                          <td className="px-4 py-3">
                            <Link href={`/etfs/${holding.ticker}`} className="font-semibold text-[#0d1117] hover:text-[#3d96ad] transition-colors">
                              {holding.ticker}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-[#64748b] max-w-[220px] truncate">
                            {holding.etf_name || holding.category || 'ETF'}
                          </td>
                          <td className="px-4 py-3 text-right text-[#0d1117]">
                            {editingTicker === holding.ticker ? (
                              <input
                                type="number"
                                value={editQuantity}
                                onChange={(e) => setEditQuantity(e.target.value)}
                                className="w-24 ml-auto px-2 py-1 border border-[#cae7ee] rounded text-sm text-right"
                              />
                            ) : (
                              holding.quantity
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-[#0d1117]">
                            {holding.purchase_date
                              ? new Date(holding.purchase_date).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })
                              : '-'}
                          </td>
                          <td className="px-4 py-3 text-right text-[#0d1117]">
                            {editingTicker === holding.ticker ? (
                              <input
                                type="number"
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value)}
                                className="w-24 ml-auto px-2 py-1 border border-[#cae7ee] rounded text-sm text-right"
                              />
                            ) : (
                              `$${holding.purchase_price.toFixed(2)}`
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-[#0d1117]">
                            ${(holding.current_price ?? 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right text-[#0d1117] font-medium">
                            ${(holding.current_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className={`px-4 py-3 text-right font-medium ${(holding.gain_loss_percent ?? 0) >= 0 ? 'text-[#1cb08a]' : 'text-[#d44a4a]'}`}>
                            {(holding.gain_loss_percent ?? 0) >= 0 ? '+' : ''}{(holding.gain_loss_percent ?? 0).toFixed(2)}%
                          </td>
                          <td className="px-4 py-3 text-right text-[#0d1117]">
                            {portfolio.total_value > 0 ? (((holding.current_value || 0) / portfolio.total_value) * 100).toFixed(1) : '0.0'}%
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              {editingTicker === holding.ticker ? (
                                <>
                                  <button
                                    onClick={() => handleUpdateETF(holding.ticker)}
                                    className="p-2 bg-[#1cb08a] text-white rounded-lg hover:bg-[#179972]"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setEditingTicker(null)}
                                    className="p-2 bg-[#f1f5f9] text-[#3a5260] rounded-lg hover:bg-[#e2e8f0]"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingTicker(holding.ticker);
                                      setEditQuantity(holding.quantity.toString());
                                      setEditPrice(holding.purchase_price.toString());
                                    }}
                                    className="p-2 text-[#7a9fad] hover:text-[#55b2c9] hover:bg-[#f0f8fa] rounded-lg transition-colors"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleRemoveETF(holding.ticker)}
                                    className="p-2 text-[#7a9fad] hover:text-[#d44a4a] hover:bg-[#d44a4a12] rounded-lg transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            </div>
            )}
          </>
        )}

        {/* Insights Tabs */}
        {availableInsightTabs.length > 0 && (
          <section className="mt-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#0d1117]">Insights</h2>
              <button
                onClick={() => setShowInsightsSection((prev) => !prev)}
                className="inline-flex items-center gap-1 text-sm text-[#3a5260] hover:text-[#0d1117]"
              >
                {showInsightsSection ? 'Hide' : 'Show'}
                {showInsightsSection ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {showInsightsSection && (
            <>
            <div className="bg-white rounded-xl border border-[#cae7ee] p-2 sm:p-3 mb-6">
              <div className="flex flex-wrap gap-2">
                {canShowScenario && (
                  <button
                    onClick={() => setActiveInsightTab('scenario')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeInsightTab === 'scenario'
                        ? 'bg-[#6366f1] text-white'
                        : 'text-[#3a5260] hover:bg-[#f0f8fa]'
                    }`}
                  >
                    Scenario Analysis
                  </button>
                )}
                {canShowVar && (
                  <button
                    onClick={() => setActiveInsightTab('var')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeInsightTab === 'var'
                        ? 'bg-[#6366f1] text-white'
                        : 'text-[#3a5260] hover:bg-[#f0f8fa]'
                    }`}
                  >
                    Tail Risk (VaR/CVaR)
                  </button>
                )}
                {canShowNews && (
                  <button
                    onClick={() => setActiveInsightTab('news')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeInsightTab === 'news'
                        ? 'bg-[#6366f1] text-white'
                        : 'text-[#3a5260] hover:bg-[#f0f8fa]'
                    }`}
                  >
                    Portfolio News
                  </button>
                )}
              </div>
            </div>

            {activeInsightTab === 'scenario' && canShowScenario && (
              <ScenarioAnalysis scenarios={scenarios} compact={true} />
            )}

            {activeInsightTab === 'var' && canShowVar && (
              <VarAnalysis onCalculate={getPortfolioVar} compact={true} />
            )}

            {activeInsightTab === 'news' && canShowNews && (
              <section>
                <h2 className="text-2xl font-bold text-[#0d1117] mb-6">
                  Portfolio News & Sentiment
                </h2>
                <NewsFeed 
                  articles={news} 
                  onRefresh={handleRefreshNews}
                  loading={newsLoading}
                  compact={true}
                />
              </section>
            )}
            </>
            )}
          </section>
        )}
      </main>

      {/* Add ETF Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-[#0d1117]">Add ETF to Portfolio</h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSearchTicker('');
                  setSearchResult(null);
                  setSearchError(null);
                  setNewPurchaseDate('');
                }}
                className="p-2 text-[#7a9fad] hover:text-[#3a5260] hover:bg-[#f0f8fa] rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-[#3a5260] mb-2">
                Search by Ticker
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchTicker}
                  onChange={(e) => setSearchTicker(e.target.value.toUpperCase())}
                  placeholder="e.g., SPY, QQQ, VTI"
                  className="flex-1 px-4 py-2 border border-[#cae7ee] rounded-lg focus:ring-2 focus:ring-[rgba(85,178,201,0.3)] focus:border-[#55b2c9]"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button
                  onClick={handleSearch}
                  disabled={searchLoading}
                  className="px-4 py-2 bg-[#6366f1] text-white rounded-lg hover:bg-[#4f46e5] disabled:opacity-50"
                >
                  {searchLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Search Error */}
            {searchError && (
              <div className="bg-[#d44a4a12] border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#d44a4a]" />
                <span className="text-sm text-[#d44a4a]">{searchError}</span>
              </div>
            )}

            {/* Search Result */}
            {searchResult && (
              <div className="border border-[#cae7ee] rounded-xl p-4 mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-[#55b2c9] rounded-lg flex items-center justify-center text-white font-bold">
                    {searchResult.ticker.slice(0, 3)}
                  </div>
                  <div>
                    <p className="font-semibold text-[#0d1117]">{searchResult.ticker}</p>
                    <p className="text-sm text-[#7a9fad] truncate">{searchResult.name}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#3a5260] mb-1">Quantity</label>
                    <input
                      type="number"
                      value={newQuantity}
                      onChange={(e) => setNewQuantity(e.target.value)}
                      placeholder="10"
                      min="0"
                      step="any"
                      className="w-full px-3 py-2 border border-[#cae7ee] rounded-lg focus:ring-2 focus:ring-[rgba(85,178,201,0.3)]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#3a5260] mb-1">Purchase Price</label>
                    <input
                      type="number"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      placeholder="450.00"
                      min="0"
                      step="any"
                      className="w-full px-3 py-2 border border-[#cae7ee] rounded-lg focus:ring-2 focus:ring-[rgba(85,178,201,0.3)]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#3a5260] mb-1">Buy Date</label>
                    <input
                      type="date"
                      value={newPurchaseDate}
                      onChange={(e) => setNewPurchaseDate(e.target.value)}
                      className="w-full px-3 py-2 border border-[#cae7ee] rounded-lg focus:ring-2 focus:ring-[rgba(85,178,201,0.3)]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSearchTicker('');
                  setSearchResult(null);
                  setSearchError(null);
                  setNewPurchaseDate('');
                }}
                className="flex-1 px-4 py-2 border border-[#cae7ee] text-[#3a5260] rounded-lg hover:bg-[#f0f8fa]"
              >
                Cancel
              </button>
              <button
                onClick={handleAddETF}
                disabled={!searchResult || !newQuantity || addLoading}
                className="flex-1 px-4 py-2 bg-[#6366f1] text-white rounded-lg hover:bg-[#4f46e5] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {addLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Add to Portfolio
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex group">
      <button
        type="button"
        className="text-[#7a9fad] hover:text-[#3a5260] focus:outline-none"
        aria-label={text}
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-56 -translate-x-1/2 rounded-md bg-[#0f172a] px-2.5 py-2 text-[11px] font-normal normal-case leading-relaxed tracking-normal text-white shadow-lg group-hover:block group-focus-within:block">
        {text}
      </span>
    </span>
  );
}
