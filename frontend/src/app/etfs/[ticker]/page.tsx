'use client';

import { useState, useEffect, type ReactNode } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { getETFDetail, getETFChartData, getETFMetrics, ETFDetail, ETFMetricsResponse, getNewsByTicker, NewsArticle, refreshTickerNews } from '@/lib/api';
import NewsFeed from '@/components/NewsFeed';
import { 
  ArrowLeft, Star, TrendingUp, TrendingDown, Loader2, AlertCircle,
  ExternalLink, PieChart, BarChart3, Calendar, DollarSign,
  Activity, Target, Info, MessageCircle, X
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts';

interface PageProps {
  params: Promise<{ ticker: string }>;
}

const TERM_EXPLANATIONS: Record<string, string> = {
  ytd: 'Year-to-date return: percentage gain or loss from the start of the current year until now.',
  expenseRatio: 'Annual fee charged by the ETF manager, shown as a percentage of your investment.',
  aum: 'Assets Under Management: the total market value of assets managed by the ETF.',
  beta: 'How sensitive the ETF is to market moves. 1 means similar to market; above 1 means more volatile.',
  dividendYield: 'Annual dividends paid by the ETF divided by its current price.',
  range52w: 'The lowest and highest prices the ETF traded at during the last 52 weeks.',
  volatility: 'How much returns fluctuate over time. Higher volatility means larger price swings.',
  sharpe: 'Risk-adjusted return. Higher Sharpe ratio generally means better return per unit of risk.',
  maxDrawdown: 'Largest peak-to-trough decline over the selected period.',
  return1m: 'Total return over the last 1 month.',
  return3m: 'Total return over the last 3 months.',
  return6m: 'Total return over the last 6 months.',
  return1y: 'Total return over the last 12 months.',
  return3y: 'Total return over the last 3 years.',
};

export default function ETFDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { ticker } = useParams() as { ticker: string };
  const { token, isAuthenticated } = useAuth();
  
  const [etf, setETF] = useState<ETFDetail | null>(null);
  const [metrics, setMetrics] = useState<ETFMetricsResponse | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('1y');
  const [tickerNews, setTickerNews] = useState<NewsArticle[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [showChatbot, setShowChatbot] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addQuantity, setAddQuantity] = useState('1');
  const [addPrice, setAddPrice] = useState('');
  const [addDate, setAddDate] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  
  const periods = [
    { value: '1m', label: '1M' },
    { value: '3m', label: '3M' },
    { value: '6m', label: '6M' },
    { value: '1y', label: '1Y' },
    { value: '3y', label: '3Y' },
    { value: '5y', label: '5Y' },
    { value: 'max', label: 'MAX' },
  ];

  useEffect(() => {
    const fetchETF = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getETFDetail(ticker);
        setETF(data);
      } catch (err) {
        setError('Failed to load ETF details. Please try again.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchETF();
  }, [ticker]);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setMetricsLoading(true);
        const data = await getETFMetrics(ticker);
        setMetrics(data);
      } catch (err) {
        console.error('Failed to load metrics:', err);
      } finally {
        setMetricsLoading(false);
      }
    };
    fetchMetrics();
  }, [ticker]);

  useEffect(() => {
    const fetchChart = async () => {
      try {
        setChartLoading(true);
        const response = await getETFChartData(ticker, selectedPeriod);
        // Transform data for recharts - API returns { ticker, period, data: [...], summary }
        const transformed = response.data?.map((p: any) => ({
          date: p.date,
          price: p.close,
        })) || [];
        setChartData(transformed);
      } catch (err) {
        console.error('Failed to load chart:', err);
      } finally {
        setChartLoading(false);
      }
    };
    fetchChart();
  }, [ticker, selectedPeriod]);

  useEffect(() => {
    const fetchTickerNews = async () => {
      try {
        setNewsLoading(true);
        const data = await getNewsByTicker(ticker, 6);
        setTickerNews(data);
      } catch (error) {
        console.error('Failed to fetch ticker news:', error);
      } finally {
        setNewsLoading(false);
      }
    };
    fetchTickerNews();
  }, [ticker]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('favoriteETFs') || '[]';
      const favorites = JSON.parse(raw) as string[];
      setIsFavorite(favorites.includes(ticker.toUpperCase()));
    } catch {
      setIsFavorite(false);
    }
  }, [ticker]);

  const toggleFavorite = () => {
    try {
      const raw = localStorage.getItem('favoriteETFs') || '[]';
      const favorites = JSON.parse(raw) as string[];
      const symbol = ticker.toUpperCase();
      let next: string[];

      if (favorites.includes(symbol)) {
        next = favorites.filter((t) => t !== symbol);
        setIsFavorite(false);
      } else {
        next = [...favorites, symbol];
        setIsFavorite(true);
      }

      localStorage.setItem('favoriteETFs', JSON.stringify(next));
    } catch (e) {
      console.error('Failed to toggle favorite:', e);
    }
  };

  const openAddToPortfolio = () => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    setAddError(null);
    setAddSuccess(null);
    setShowAddModal(true);
  };

  const submitAddToPortfolio = async () => {
    if (!token) {
      setAddError('Please log in to add ETF to portfolio.');
      return;
    }

    const quantity = Number(addQuantity);
    const purchasePrice = addPrice.trim() ? Number(addPrice) : undefined;

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setAddError('Please enter a valid quantity greater than 0.');
      return;
    }

    if (purchasePrice != null && (!Number.isFinite(purchasePrice) || purchasePrice <= 0)) {
      setAddError('Purchase price must be greater than 0.');
      return;
    }

    try {
      setAddLoading(true);
      setAddError(null);
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/portfolio`,
        {
          ticker: ticker.toUpperCase(),
          quantity,
          purchase_price: purchasePrice,
          purchase_date: addDate || undefined,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setAddSuccess(`${ticker.toUpperCase()} added to portfolio.`);
      setShowAddModal(false);
      setAddQuantity('1');
      setAddPrice('');
      setAddDate('');
    } catch (err: any) {
      setAddError(err?.response?.data?.detail || 'Failed to add ETF to portfolio.');
    } finally {
      setAddLoading(false);
    }
  };

  // Format helpers
  const formatReturn = (value: string | null) => {
    if (!value) return 'N/A';
    const num = parseFloat(value.replace('%', ''));
    if (isNaN(num)) return value;
    return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
  };

  const getReturnColor = (value: string | null) => {
    if (!value) return 'text-[#71717a]';
    const num = parseFloat(value.replace('%', ''));
    if (isNaN(num)) return 'text-[#71717a]';
    return num >= 0 ? 'text-[#1cb08a]' : 'text-[#d44a4a]';
  };

  const formatCurrency = (value: string | null) => {
    if (!value) return 'N/A';
    return value;
  };

  const formatXAxisDate = (value: string) => {
    const date = new Date(value);

    if (selectedPeriod === '5y' || selectedPeriod === 'max') {
      return date.toLocaleDateString('en-US', { year: '2-digit' });
    }

    if (selectedPeriod === '3y') {
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    }

    if (selectedPeriod === '1y') {
      return date.toLocaleDateString('en-US', { month: 'short' });
    }

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const xAxisMinTickGap = selectedPeriod === '5y' || selectedPeriod === 'max' ? 44 : selectedPeriod === '3y' ? 36 : 24;
  const betaDisplay = etf?.beta || 'N/A';
  const summaryFromDb = etf?.analyst_report?.trim() || '';
  const summaryParts = [
    etf?.etf_name ? `${etf.etf_name} (${etf.ticker})` : etf?.ticker,
    etf?.issuer ? `is issued by ${etf.issuer}` : null,
    etf?.asset_class ? `and classified as ${etf.asset_class}` : null,
    etf?.category ? `with a ${etf.category} focus` : null,
    etf?.general_region ? `primarily in ${etf.general_region}` : null,
    etf?.index_tracked ? `tracking ${etf.index_tracked}` : null,
  ].filter(Boolean);
  const generatedSummary = summaryParts.length > 0 ? `${summaryParts.join(' ')}.` : '';
  const etfSummary = summaryFromDb || generatedSummary || 'Summary not available for this ETF yet.';

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#64748b] animate-spin mx-auto mb-4" />
          <p className="text-[#3f3f46]">Loading ETF details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !etf) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(15,23,42,0.08)] border-[1.5px] border-[#e5e7eb] p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-[#d44a4a] mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[#0d1117] mb-2">ETF Not Found</h2>
          <p className="text-[#3f3f46] mb-6">{error || `Could not find ETF with ticker "${ticker}"`}</p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => router.back()}
              className="px-6 py-2.5 bg-[#6366f1] text-white rounded-lg font-medium hover:bg-[#4f46e5]"
            >
              Go Back
            </button>
            <Link href="/etfs" className="px-6 py-2.5 border border-[#e5e7eb] text-[#3f3f46] rounded-lg font-medium hover:bg-[#f9fafb]">
              Browse ETFs
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Main Content */}
      <main className="pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <div className="py-4">
            <nav className="flex items-center gap-2 text-sm text-[#71717a]">
              <Link href="/etfs" className="hover:text-[#27272a]">ETFs</Link>
              <span>/</span>
              <span className="text-[#0d1117] font-medium">{ticker}</span>
            </nav>
          </div>

          {/* ETF Header */}
          <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(15,23,42,0.08)] border-[1.5px] border-[#e5e7eb] p-5 sm:p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-[#0d1117]">{etf.etf_name}</h1>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-base text-[#71717a]">{etf.ticker}</span>
                  {etf.issuer && (
                    <span className="px-2 py-1 bg-[#f8fafc] text-[#3f3f46] text-xs rounded-full">
                      {etf.issuer}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleFavorite}
                  className="p-2 border border-[#e5e7eb] rounded-lg hover:bg-[#f9fafb] transition-colors"
                  title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Star className={`w-5 h-5 ${isFavorite ? 'text-yellow-500 fill-yellow-400' : 'text-[#71717a]'}`} />
                </button>
                <button
                  onClick={openAddToPortfolio}
                  className="px-4 py-2 bg-[#6366f1] text-white rounded-lg font-medium hover:bg-[#4f46e5] transition-colors"
                >
                  Add to Portfolio
                </button>
              </div>
            </div>

            {(addSuccess || addError) && (
              <div className={`mt-3 text-sm ${addSuccess ? 'text-[#1cb08a]' : 'text-[#d44a4a]'}`}>
                {addSuccess || addError}
              </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              <StatCard 
                label={<TermLabel label="YTD Return" explanation={TERM_EXPLANATIONS.ytd} />} 
                value={formatReturn(etf.ytd_return)} 
                valueClass={getReturnColor(etf.ytd_return)}
              />
              <StatCard 
                label={<TermLabel label="Expense Ratio" explanation={TERM_EXPLANATIONS.expenseRatio} />} 
                value={etf.expense_ratio || 'N/A'} 
              />
              <StatCard 
                label={<TermLabel label="AUM" explanation={TERM_EXPLANATIONS.aum} />} 
                value={formatCurrency(etf.aum)} 
              />
              <StatCard 
                label={<TermLabel label="Beta" explanation={TERM_EXPLANATIONS.beta} />} 
                value={betaDisplay} 
              />
              <StatCard 
                label={<TermLabel label="Dividend Yield" explanation={TERM_EXPLANATIONS.dividendYield} />} 
                value={etf.annual_dividend_yield || 'N/A'} 
              />
              <StatCard 
                label={<TermLabel label="52W Range" explanation={TERM_EXPLANATIONS.range52w} />} 
                value={etf['52_week_low'] && etf['52_week_high'] ? `${etf['52_week_low']} - ${etf['52_week_high']}` : 'N/A'} 
                small
              />
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Content - 2 columns */}
            <div className="lg:col-span-2 space-y-6">
              {/* ETF Summary */}
              <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(15,23,42,0.08)] border-[1.5px] border-[#e5e7eb] p-6">
                <h2 className="text-lg font-semibold text-[#0d1117] mb-2">ETF Summary</h2>
                <p className="text-sm leading-relaxed text-[#3f3f46]">{etfSummary}</p>
              </div>

              {/* Price Chart */}
              <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(15,23,42,0.08)] border-[1.5px] border-[#e5e7eb] p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                  <h2 className="text-lg font-semibold text-[#0d1117]">Price History</h2>
                  <div className="flex gap-1 bg-[#f8fafc] p-1 rounded-lg overflow-x-auto">
                    {periods.map((period) => (
                      <button
                        key={period.value}
                        onClick={() => setSelectedPeriod(period.value)}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                          selectedPeriod === period.value
                            ? 'bg-[#6366f1] text-white'
                            : 'text-[#3f3f46] hover:bg-[#f1f5f9]'
                        }`}
                      >
                        {period.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-80">
                  {chartLoading ? (
                    <div className="h-full flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-[#64748b] animate-spin" />
                    </div>
                  ) : chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis 
                          dataKey="date" 
                          interval="preserveStartEnd"
                          minTickGap={xAxisMinTickGap}
                          tick={{ fontSize: 12, fill: '#71717a' }}
                          tickFormatter={formatXAxisDate}
                        />
                        <YAxis 
                          tick={{ fontSize: 12, fill: '#71717a' }}
                          tickFormatter={(value) => `$${value.toFixed(0)}`}
                          domain={['auto', 'auto']}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'white', 
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                          }}
                          formatter={(value) => typeof value === 'number' ? [`$${value.toFixed(2)}`, 'Price'] : ['', 'Price']}
                          labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { 
                            year: 'numeric', month: 'long', day: 'numeric' 
                          })}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="price" 
                          stroke="#0ea5e9" 
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorPrice)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-[#71717a]">
                      No chart data available
                    </div>
                  )}
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(15,23,42,0.08)] border-[1.5px] border-[#e5e7eb] p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-[#0d1117]">Performance</h2>
                  {metricsLoading && <Loader2 className="w-5 h-5 text-[#64748b] animate-spin" />}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  <MetricCard 
                    label={<TermLabel label="1 Month" explanation={TERM_EXPLANATIONS.return1m} />} 
                    value={metrics?.metrics.return_1m != null ? `${metrics.metrics.return_1m >= 0 ? '+' : ''}${metrics.metrics.return_1m.toFixed(2)}%` : formatReturn(etf['1_month_return'])} 
                    valueClass={metrics?.metrics.return_1m != null ? (metrics.metrics.return_1m >= 0 ? 'text-[#1cb08a]' : 'text-[#d44a4a]') : getReturnColor(etf['1_month_return'])} 
                  />
                  <MetricCard 
                    label={<TermLabel label="3 Months" explanation={TERM_EXPLANATIONS.return3m} />} 
                    value={metrics?.metrics.return_3m != null ? `${metrics.metrics.return_3m >= 0 ? '+' : ''}${metrics.metrics.return_3m.toFixed(2)}%` : formatReturn(etf['3_month_return'])} 
                    valueClass={metrics?.metrics.return_3m != null ? (metrics.metrics.return_3m >= 0 ? 'text-[#1cb08a]' : 'text-[#d44a4a]') : getReturnColor(etf['3_month_return'])} 
                  />
                  <MetricCard 
                    label={<TermLabel label="6 Months" explanation={TERM_EXPLANATIONS.return6m} />} 
                    value={metrics?.metrics.return_6m != null ? `${metrics.metrics.return_6m >= 0 ? '+' : ''}${metrics.metrics.return_6m.toFixed(2)}%` : 'N/A'} 
                    valueClass={metrics?.metrics.return_6m != null ? (metrics.metrics.return_6m >= 0 ? 'text-[#1cb08a]' : 'text-[#d44a4a]') : 'text-[#71717a]'} 
                  />
                  <MetricCard 
                    label={<TermLabel label="YTD" explanation={TERM_EXPLANATIONS.ytd} />} 
                    value={metrics?.metrics.return_ytd != null ? `${metrics.metrics.return_ytd >= 0 ? '+' : ''}${metrics.metrics.return_ytd.toFixed(2)}%` : formatReturn(etf.ytd_return)} 
                    valueClass={metrics?.metrics.return_ytd != null ? (metrics.metrics.return_ytd >= 0 ? 'text-[#1cb08a]' : 'text-[#d44a4a]') : getReturnColor(etf.ytd_return)} 
                  />
                  <MetricCard 
                    label={<TermLabel label="1 Year" explanation={TERM_EXPLANATIONS.return1y} />} 
                    value={metrics?.metrics.return_1y != null ? `${metrics.metrics.return_1y >= 0 ? '+' : ''}${metrics.metrics.return_1y.toFixed(2)}%` : formatReturn(etf['1_year_return'])} 
                    valueClass={metrics?.metrics.return_1y != null ? (metrics.metrics.return_1y >= 0 ? 'text-[#1cb08a]' : 'text-[#d44a4a]') : getReturnColor(etf['1_year_return'])} 
                  />
                  <MetricCard 
                    label={<TermLabel label="3 Years" explanation={TERM_EXPLANATIONS.return3y} />} 
                    value={metrics?.metrics.return_3y != null ? `${metrics.metrics.return_3y >= 0 ? '+' : ''}${metrics.metrics.return_3y.toFixed(2)}%` : formatReturn(etf['3_year_return'])} 
                    valueClass={metrics?.metrics.return_3y != null ? (metrics.metrics.return_3y >= 0 ? 'text-[#1cb08a]' : 'text-[#d44a4a]') : getReturnColor(etf['3_year_return'])} 
                  />
                </div>
              </div>

              {/* Risk Analytics */}
              <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(15,23,42,0.08)] border-[1.5px] border-[#e5e7eb] p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-[#0d1117]">Risk Analytics</h2>
                  {metricsLoading && <Loader2 className="w-5 h-5 text-[#64748b] animate-spin" />}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 bg-[rgba(14,165,233,0.10)] rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="w-4 h-4 text-[#0284c7]" />
                      <p className="text-xs text-[#0284c7] font-medium uppercase tracking-wide inline-flex items-center gap-1">
                        Volatility
                        <TermInfo explanation={TERM_EXPLANATIONS.volatility} />
                      </p>
                    </div>
                    <p className="text-xl font-bold text-[#0d1117]">
                      {metrics?.metrics.volatility != null ? `${metrics.metrics.volatility.toFixed(2)}%` : 'N/A'}
                    </p>
                    <p className="text-xs text-[#0284c7] mt-1">Annualized</p>
                  </div>
                  <div className="p-4 bg-[rgba(148,163,184,0.18)] rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-4 h-4 text-[#475569]" />
                      <p className="text-xs text-[#475569] font-medium uppercase tracking-wide inline-flex items-center gap-1">
                        Beta
                        <TermInfo explanation={TERM_EXPLANATIONS.beta} />
                      </p>
                    </div>
                    <p className="text-xl font-bold text-[#0d1117]">
                      {betaDisplay}
                    </p>
                    <p className="text-xs text-[#475569] mt-1">Provider-reported</p>
                  </div>
                  <div className="p-4 bg-[rgba(28,176,138,0.10)] rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-[#1cb08a]" />
                      <p className="text-xs text-[#1cb08a] font-medium uppercase tracking-wide inline-flex items-center gap-1">
                        Sharpe Ratio
                        <TermInfo explanation={TERM_EXPLANATIONS.sharpe} />
                      </p>
                    </div>
                    <p className="text-xl font-bold text-[#0d1117]">
                      {metrics?.metrics.sharpe_ratio != null ? metrics.metrics.sharpe_ratio.toFixed(2) : 'N/A'}
                    </p>
                    <p className="text-xs text-[#1cb08a] mt-1">Risk-adjusted</p>
                  </div>
                  <div className="p-4 bg-[rgba(212,74,74,0.10)] rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingDown className="w-4 h-4 text-[#d44a4a]" />
                      <p className="text-xs text-[#d44a4a] font-medium uppercase tracking-wide inline-flex items-center gap-1">
                        Max Drawdown
                        <TermInfo explanation={TERM_EXPLANATIONS.maxDrawdown} />
                      </p>
                    </div>
                    <p className="text-xl font-bold text-[#0d1117]">
                      {metrics?.metrics.max_drawdown != null ? `${metrics.metrics.max_drawdown.toFixed(2)}%` : 'N/A'}
                    </p>
                    <p className="text-xs text-[#d44a4a] mt-1">Worst decline</p>
                  </div>
                </div>
                {metrics?.latest_price && (
                  <div className="mt-4 pt-4 border-t border-[#e5e7eb] flex flex-wrap gap-4 text-sm text-[#71717a]">
                    <span>Latest Price: <span className="font-semibold text-[#0d1117]">${metrics.latest_price.toFixed(2)}</span></span>
                    <span>52W High: <span className="font-semibold text-[#1cb08a]">${metrics.metrics.week_52_high?.toFixed(2) || 'N/A'}</span></span>
                    <span>52W Low: <span className="font-semibold text-[#d44a4a]">${metrics.metrics.week_52_low?.toFixed(2) || 'N/A'}</span></span>
                    <span>Data as of: <span className="font-medium">{metrics.latest_date}</span></span>
                  </div>
                )}
              </div>

              {/* Holdings Breakdown */}
              {etf.top_holdings && (
                <HoldingsBreakdown holdingsData={etf.top_holdings} />
              )}
            </div>

            {/* Sidebar - 1 column */}
            <div className="space-y-6">
              {/* AI Chatbot Trigger */}
              <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(15,23,42,0.08)] border-[1.5px] border-[#e5e7eb] p-6">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <h2 className="text-lg font-semibold text-[#0d1117]">ETF AI Chatbot</h2>
                  <MessageCircle className="w-5 h-5 text-[#6366f1]" />
                </div>
                <p className="text-[#52525b] text-sm mb-4">
                  Ask questions about this ETF, risk, and historical behavior.
                </p>
                <button
                  onClick={() => setShowChatbot(true)}
                  className="w-full py-2.5 bg-[#6366f1] text-white rounded-lg font-medium hover:bg-[#4f46e5] transition-colors"
                >
                  Open Chatbot
                </button>
              </div>

              {/* ETF Info */}
              <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(15,23,42,0.08)] border-[1.5px] border-[#e5e7eb] p-6">
                <h2 className="text-lg font-semibold text-[#0d1117] mb-4">ETF Information</h2>
                <div className="space-y-4">
                  <InfoRow label="Category" value={etf.category} />
                  <InfoRow label="Asset Class" value={etf.asset_class} />
                  <InfoRow label="Asset Class Size" value={etf.asset_class_size} />
                  <InfoRow label="Asset Class Style" value={etf.asset_class_style} />
                  <InfoRow label="Region" value={etf.general_region} />
                  <InfoRow label="Specific Region" value={etf.specific_region} />
                  <InfoRow label="Inception Date" value={etf.inception} />
                  <InfoRow label="Index Tracked" value={etf.index_tracked} />
                </div>
              </div>

              {/* Risk Metrics */}
              <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(15,23,42,0.08)] border-[1.5px] border-[#e5e7eb] p-6">
                <h2 className="text-lg font-semibold text-[#0d1117] mb-4">Risk Metrics</h2>
                <div className="space-y-4">
                  <InfoRow label="Beta" value={betaDisplay} />
                  <InfoRow label="Volatility" value={metrics?.metrics.volatility ? `${metrics.metrics.volatility.toFixed(2)}%` : etf.standard_deviation} />
                  <InfoRow label="Sharpe Ratio" value={metrics?.metrics.sharpe_ratio?.toFixed(2) || 'N/A'} />
                  <InfoRow label="Max Drawdown" value={metrics?.metrics.max_drawdown ? `${metrics.metrics.max_drawdown.toFixed(2)}%` : 'N/A'} />
                  <InfoRow label="52 Week Low" value={metrics?.metrics.week_52_low ? `$${metrics.metrics.week_52_low.toFixed(2)}` : etf['52_week_low']} />
                  <InfoRow label="52 Week High" value={metrics?.metrics.week_52_high ? `$${metrics.metrics.week_52_high.toFixed(2)}` : etf['52_week_high']} />
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(15,23,42,0.08)] border-[1.5px] border-[#e5e7eb] p-6 text-[#0d1117]">
                <h2 className="text-lg font-semibold mb-2">Get Personalized Advice</h2>
                <p className="text-[#52525b] text-sm mb-4">
                  Take our risk assessment quiz to see if this ETF matches your investment profile.
                </p>
                <Link 
                  href="/questionnaire"
                  className="block w-full py-2.5 bg-[#6366f1] text-white rounded-lg font-medium text-center hover:bg-[#4f46e5] transition-colors"
                >
                  Take Quiz
                </Link>
              </div>

            </div>
          </div>

          {/* News Section */}
          <ETFNewsSection 
            ticker={ticker} 
            news={tickerNews} 
            loading={newsLoading}
            onRefresh={async () => {
              try {
                setNewsLoading(true);
                await refreshTickerNews(ticker);
                const data = await getNewsByTicker(ticker, 6);
                setTickerNews(data);
              } catch (error) {
                console.error('Failed to refresh news:', error);
                try {
                  const data = await getNewsByTicker(ticker, 6);
                  setTickerNews(data);
                } catch (fetchError) {
                  console.error('Failed to fetch ticker news after refresh attempt:', fetchError);
                }
              } finally {
                setNewsLoading(false);
              }
            }}
          />

          {showChatbot && (
            <Chatbot
              etf={etf}
              onClose={() => setShowChatbot(false)}
            />
          )}

          {showAddModal && (
            <div className="fixed inset-0 z-50 bg-black/40 p-4 flex items-center justify-center">
              <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#e5e7eb] p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-[#0d1117]">Add to Portfolio</h3>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="p-1.5 rounded-md text-[#71717a] hover:bg-[#f4f4f5]"
                    aria-label="Close add-to-portfolio modal"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-[#3f3f46] mb-1">Ticker</label>
                    <input
                      value={ticker.toUpperCase()}
                      disabled
                      className="w-full px-3 py-2 border border-[#e5e7eb] rounded-lg bg-[#fafafa] text-[#71717a]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#3f3f46] mb-1">Quantity</label>
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={addQuantity}
                      onChange={(e) => setAddQuantity(e.target.value)}
                      className="w-full px-3 py-2 border border-[#e5e7eb] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#3f3f46] mb-1">Purchase Price (optional)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={addPrice}
                      onChange={(e) => setAddPrice(e.target.value)}
                      placeholder="Leave empty to use latest price"
                      className="w-full px-3 py-2 border border-[#e5e7eb] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#3f3f46] mb-1">Purchase Date (optional)</label>
                    <input
                      type="date"
                      value={addDate}
                      onChange={(e) => setAddDate(e.target.value)}
                      className="w-full px-3 py-2 border border-[#e5e7eb] rounded-lg"
                    />
                  </div>
                </div>

                {addError && <p className="mt-3 text-sm text-[#d44a4a]">{addError}</p>}

                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-2.5 border border-[#e5e7eb] rounded-lg text-[#3f3f46]"
                    disabled={addLoading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitAddToPortfolio}
                    className="flex-1 py-2.5 bg-[#6366f1] text-white rounded-lg font-medium hover:bg-[#4f46e5] disabled:opacity-50"
                    disabled={addLoading}
                  >
                    {addLoading ? 'Adding...' : 'Add ETF'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// Stat Card Component
function StatCard({ label, value, valueClass = 'text-[#0d1117]', small = false }: { 
  label: ReactNode; 
  value: string; 
  valueClass?: string;
  small?: boolean;
}) {
  return (
    <div className="p-3 bg-[#f8fafc] rounded-xl">
      <p className="text-[11px] text-[#71717a] uppercase tracking-wide mb-1">{label}</p>
      <p className={`${small ? 'text-xs' : 'text-base'} font-semibold font-mono leading-tight ${valueClass}`}>{value}</p>
    </div>
  );
}

// Metric Card Component
function MetricCard({ label, value, valueClass = 'text-[#0d1117]' }: { 
  label: ReactNode; 
  value: string; 
  valueClass?: string;
}) {
  return (
    <div className="text-center p-4 bg-[#f8fafc] rounded-xl">
      <p className={`text-xl font-bold font-mono ${valueClass}`}>{value}</p>
      <p className="text-xs text-[#71717a] mt-1">{label}</p>
    </div>
  );
}

// Info Row Component
function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-[#e5e7eb] last:border-0">
      <span className="text-sm text-[#71717a]">{label}</span>
      <span className="text-sm font-medium text-[#0d1117] text-right max-w-[60%] truncate">
        {value || 'N/A'}
      </span>
    </div>
  );
}

function TermLabel({ label, explanation }: { label: string; explanation: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span>{label}</span>
      <TermInfo explanation={explanation} />
    </span>
  );
}

function TermInfo({ explanation }: { explanation: string }) {
  return (
    <span className="relative inline-flex group">
      <button
        type="button"
        className="text-[#71717a] hover:text-[#0d1117] focus:outline-none"
        aria-label={explanation}
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-56 -translate-x-1/2 rounded-md bg-[#0f172a] px-2.5 py-2 text-[11px] font-normal normal-case leading-relaxed tracking-normal text-white shadow-lg group-hover:block group-focus-within:block">
        {explanation}
      </span>
    </span>
  );
}

// Holdings Breakdown Component
function HoldingsBreakdown({ holdingsData }: { holdingsData: string }) {
  // Parse the JSON data - it's an array of dictionaries
  let breakdowns: Record<string, number>[] = [];
  
  try {
    // Handle Python-style single quotes by replacing them
    const jsonString = holdingsData.replace(/'/g, '"');
    breakdowns = JSON.parse(jsonString);
  } catch (e) {
    console.error('Failed to parse holdings data:', e);
    return null;
  }

  // Category labels for each breakdown (based on typical ETF data structure)
  const categoryLabels = [
    'Region',
    'Country', 
    'Sector',
    'Market Cap',
    'Holdings',
    'Asset Type',
    'Industry'
  ];

  // Color schemes for different categories
  const colorSchemes = [
    { bg: 'bg-sky-100', text: 'text-sky-700', bar: 'bg-sky-500' },
    { bg: 'bg-green-100', text: 'text-green-700', bar: 'bg-green-500' },
    { bg: 'bg-slate-100', text: 'text-slate-700', bar: 'bg-slate-500' },
    { bg: 'bg-orange-100', text: 'text-orange-700', bar: 'bg-orange-500' },
    { bg: 'bg-pink-100', text: 'text-pink-700', bar: 'bg-pink-500' },
    { bg: 'bg-cyan-100', text: 'text-cyan-700', bar: 'bg-cyan-500' },
    { bg: 'bg-amber-100', text: 'text-amber-700', bar: 'bg-amber-500' },
  ];

  // Filter out empty breakdowns
  const validBreakdowns = breakdowns
    .map((breakdown, idx) => ({ breakdown, label: categoryLabels[idx] || `Category ${idx + 1}`, colors: colorSchemes[idx % colorSchemes.length] }))
    .filter(({ breakdown }) => breakdown && Object.keys(breakdown).length > 0);

  if (validBreakdowns.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(15,23,42,0.08)] border-[1.5px] border-[#e5e7eb] p-6">
      <h2 className="text-lg font-semibold text-[#0d1117] mb-6">Holdings Breakdown</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {validBreakdowns.map(({ breakdown, label, colors }, idx) => (
          <div key={idx} className="space-y-3">
            <h3 className="text-sm font-semibold text-[#3f3f46] uppercase tracking-wide">{label}</h3>
            <div className="space-y-2">
              {Object.entries(breakdown)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([name, percentage]) => (
                  <div key={name} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#3f3f46] truncate pr-2">{name}</span>
                      <span className="font-medium text-[#0d1117]">{percentage.toFixed(2)}%</span>
                    </div>
                    <div className="h-2 bg-[#f8fafc] rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${colors.bar} rounded-full transition-all duration-300`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Chatbot Component
function Chatbot({ etf, onClose }: { etf: ETFDetail; onClose: () => void }) {
  const { token } = useAuth();
  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim()) return;
    setMessages((msgs) => [...msgs, { role: 'user', content: input }]);
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post(
        '/chatbot',
        {
          question: input,
          etf_symbol: etf.ticker,
          etf_context: `ETF: ${etf.etf_name}. Category: ${etf.category}. Asset Class: ${etf.asset_class}. Region: ${etf.general_region}.`,
        },
        {
          baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setMessages((msgs) => [...msgs, { role: 'bot', content: res.data.answer }]);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to get response.');
    } finally {
      setLoading(false);
      setInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-4 flex items-center justify-center">
      <div className="w-full max-w-2xl max-h-[85vh] overflow-hidden bg-white rounded-2xl shadow-2xl border border-[#e5e7eb] p-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-[#0d1117]">ETF AI Chatbot</h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-[#71717a] hover:bg-[#f4f4f5]"
          aria-label="Close chatbot"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="h-48 overflow-y-auto border border-[#e5e7eb] rounded-lg p-2 mb-2 bg-[#f8fafc]">
        {messages.length === 0 && (
          <div className="text-[#71717a] text-sm text-center mt-12">Ask anything about this ETF!</div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`mb-2 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`px-3 py-2 rounded-lg max-w-[80%] text-sm ${msg.role === 'user' ? 'bg-[#0f172a] text-white' : 'bg-[#f8fafc] text-[#0d1117]'}`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start mb-2">
            <div className="px-3 py-2 rounded-lg bg-[#f8fafc] text-[#71717a] text-sm animate-pulse">Thinking...</div>
          </div>
        )}
      </div>
      <form onSubmit={handleSend} className="flex gap-2">
        <input
          type="text"
          className="flex-1 border border-[#e5e7eb] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[rgba(14,165,233,0.35)]"
          placeholder="Ask a question about this ETF..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <button
          type="submit"
          className="px-4 py-2 bg-[#6366f1] text-white rounded-lg font-medium hover:bg-[#4f46e5] disabled:opacity-50"
          disabled={loading || !input.trim()}
        >
          Send
        </button>
      </form>
      {error && <div className="text-[#d44a4a] text-xs mt-2">{error}</div>}
      </div>
    </div>
  );
}

function ETFNewsSection({ ticker, news, loading, onRefresh }: { ticker: string; news: any[]; loading: boolean; onRefresh: () => void }) {
  return (
    <section className="mt-12">
      <h2 className="text-2xl font-bold text-[#0d1117] mb-6">
        Latest News for {ticker}
      </h2>
      <NewsFeed 
        articles={news} 
        onRefresh={onRefresh}
        loading={loading}
      />
    </section>
  );
}
