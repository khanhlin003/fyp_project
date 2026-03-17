'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getETFs, getFilterOptions, ETF, ETFListResponse } from '@/lib/api';
import { 
  Search, Filter, Grid, List, ChevronLeft, ChevronRight, 
  Loader2, AlertCircle, Star, TrendingUp, TrendingDown,
  X
} from 'lucide-react';

function ETFDiscoveryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // State
  const [etfs, setETFs] = useState<ETF[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  
  // Filters
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [category, setCategory] = useState('');
  const [assetClass, setAssetClass] = useState('');
  const [region, setRegion] = useState('');
  const [ytdTrend, setYtdTrend] = useState<'all' | 'positive' | 'negative'>('all');
  const [betaBand, setBetaBand] = useState<'all' | 'defensive' | 'market' | 'aggressive'>('all');
  const [expenseCap, setExpenseCap] = useState<'all' | '0.10' | '0.25' | '0.50'>('all');
  const [rankMetric, setRankMetric] = useState<'none' | 'ytd' | 'expense' | 'beta' | 'dividend' | 'aum'>('none');
  const [rankOrder, setRankOrder] = useState<'asc' | 'desc'>('desc');
  const [showFiltersDesktopPanel, setShowFiltersDesktopPanel] = useState(true);
  const [showFiltersMobilePanel, setShowFiltersMobilePanel] = useState(true);
  const [openGuide, setOpenGuide] = useState<string | null>(null);
  
  // Filter options
  const [filterOptions, setFilterOptions] = useState<{
    categories: string[];
    asset_classes: string[];
    regions: string[];
  }>({ categories: [], asset_classes: [], regions: [] });

  // Fetch filter options on mount
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const options = await getFilterOptions();
        setFilterOptions(options);
      } catch (err) {
        console.error('Failed to fetch filter options:', err);
      }
    };
    fetchFilterOptions();
  }, []);

  // Fetch ETFs
  const fetchETFs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string | number> = {
        page,
        page_size: pageSize,
      };
      if (search) params.search = search;
      if (category) params.category = category;
      if (assetClass) params.asset_class = assetClass;
      if (region) params.region = region;
      
      const data = await getETFs(params);
      setETFs(data.etfs);
      setTotal(data.total);
    } catch (err) {
      setError('Failed to load ETFs. Please make sure the backend server is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, category, assetClass, region]);

  useEffect(() => {
    fetchETFs();
  }, [fetchETFs]);

  const parsePercent = (value: string | null): number | null => {
    if (!value) return null;
    const numeric = parseFloat(value.replace('%', '').replace(/,/g, '').trim());
    return Number.isNaN(numeric) ? null : numeric;
  };

  const parseNumber = (value: string | null): number | null => {
    if (!value) return null;
    const numeric = parseFloat(value.replace(/[^0-9.-]/g, '').trim());
    return Number.isNaN(numeric) ? null : numeric;
  };

  const parseAUM = (value: string | null): number | null => {
    if (!value) return null;
    const clean = value.toUpperCase().replace(/\$/g, '').replace(/,/g, '').trim();
    const match = clean.match(/^([0-9]*\.?[0-9]+)\s*([KMBT])?$/);
    if (!match) {
      const fallback = parseFloat(clean.replace(/[^0-9.-]/g, ''));
      return Number.isNaN(fallback) ? null : fallback;
    }
    const num = parseFloat(match[1]);
    const unit = match[2] || '';
    const multipliers: Record<string, number> = {
      K: 1_000,
      M: 1_000_000,
      B: 1_000_000_000,
      T: 1_000_000_000_000,
      '': 1,
    };
    return num * multipliers[unit];
  };

  const filteredETFs = useMemo(() => {
    return etfs.filter((etf) => {
      const ytd = parsePercent(etf.ytd_return);
      const beta = parseNumber(etf.beta);
      const expense = parsePercent(etf.expense_ratio);

      if (ytdTrend === 'positive' && (ytd == null || ytd < 0)) return false;
      if (ytdTrend === 'negative' && (ytd == null || ytd >= 0)) return false;

      if (betaBand === 'defensive' && (beta == null || beta >= 1.0)) return false;
      if (betaBand === 'market' && (beta == null || beta < 0.9 || beta > 1.1)) return false;
      if (betaBand === 'aggressive' && (beta == null || beta <= 1.1)) return false;

      if (expenseCap !== 'all') {
        const cap = parseFloat(expenseCap);
        if (expense == null || expense > cap) return false;
      }

      return true;
    });
  }, [etfs, ytdTrend, betaBand, expenseCap]);

  const rankedETFs = useMemo(() => {
    if (rankMetric === 'none') return filteredETFs;

    const getMetricValue = (etf: ETF): number | null => {
      if (rankMetric === 'ytd') return parsePercent(etf.ytd_return);
      if (rankMetric === 'expense') return parsePercent(etf.expense_ratio);
      if (rankMetric === 'beta') return parseNumber(etf.beta);
      if (rankMetric === 'dividend') return parsePercent(etf.annual_dividend_yield);
      if (rankMetric === 'aum') return parseAUM(etf.aum);
      return null;
    };

    return [...filteredETFs].sort((a, b) => {
      const aValue = getMetricValue(a);
      const bValue = getMetricValue(b);

      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      return rankOrder === 'desc' ? bValue - aValue : aValue - bValue;
    });
  }, [filteredETFs, rankMetric, rankOrder]);

  // Handle search submit
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearch('');
    setSearchInput('');
    setCategory('');
    setAssetClass('');
    setRegion('');
    setYtdTrend('all');
    setBetaBand('all');
    setExpenseCap('all');
    setRankMetric('none');
    setRankOrder('desc');
    setPage(1);
  };

  const hasActiveFilters = search || category || assetClass || region || ytdTrend !== 'all' || betaBand !== 'all' || expenseCap !== 'all' || rankMetric !== 'none';
  const hasQuickFilters = ytdTrend !== 'all' || betaBand !== 'all' || expenseCap !== 'all';
  const totalPages = Math.ceil(total / pageSize);
  const visibleCount = rankedETFs.length;

  const guideItems = [
    {
      key: 'what-is-etf',
      title: 'What is an ETF?',
      body: 'An ETF (Exchange-Traded Fund) is a basket of securities that trades like a stock. It gives diversification in one trade and usually has lower fees than active funds.',
    },
    {
      key: 'how-to-select',
      title: 'How to Select an ETF',
      body: 'Start with your goal, then compare expense ratio, tracking quality, liquidity (volume/spread), AUM size, and whether the ETF risk (beta/volatility) fits your profile.',
    },
    {
      key: 'key-metrics',
      title: 'How to Read Key Metrics',
      body: 'YTD shows year-to-date performance. Expense ratio is annual fee. Beta measures market sensitivity. Higher beta means larger ups and downs versus the market.',
    },
  ];

  const goToNextGuide = (currentKey: string) => {
    const currentIndex = guideItems.findIndex((item) => item.key === currentKey);
    if (currentIndex < 0) return;
    const next = guideItems[currentIndex + 1];
    setOpenGuide(next ? next.key : null);
  };

  // Format return values
  const formatReturn = (value: string | null) => {
    if (!value) return 'N/A';
    const num = parseFloat(value.replace('%', ''));
    if (isNaN(num)) return value;
    return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
  };

  const getReturnColor = (value: string | null) => {
    if (!value) return 'text-zinc-500';
    const num = parseFloat(value.replace('%', ''));
    if (isNaN(num)) return 'text-zinc-500';
    return num >= 0 ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Search Bar Header */}
      <div className="bg-white shadow-sm py-4 mb-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <form onSubmit={handleSearch} className="max-w-xl mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input
                type="text"
                placeholder="Search ETFs by name or ticker..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border-2 border-zinc-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </form>
        </div>
      </div>

      {/* Main Content */}
      <main className="pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-8">
            
            {/* Filters Sidebar - Desktop */}
            <aside className="hidden lg:block">
              <div className="bg-white rounded-2xl shadow-sm p-6 sticky top-20">
                <div className="flex items-center justify-between mb-6">
                  <button
                    onClick={() => setShowFiltersDesktopPanel((prev) => !prev)}
                    className="flex items-center gap-2"
                  >
                    <h2 className="text-lg font-semibold text-zinc-900">Filters</h2>
                    <ChevronRight className={`w-4 h-4 text-zinc-500 transition-transform ${showFiltersDesktopPanel ? 'rotate-90' : ''}`} />
                  </button>
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="text-sm text-indigo-500 hover:text-indigo-600"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {showFiltersDesktopPanel && (
                  <>
                
                {/* Category Filter */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-zinc-600 mb-2">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => { setCategory(e.target.value); setPage(1); }}
                    className="w-full p-2.5 border-2 border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="">All Categories</option>
                    {filterOptions.categories.slice(0, 20).map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                
                {/* Asset Class Filter */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-zinc-600 mb-2">
                    Asset Class
                  </label>
                  <select
                    value={assetClass}
                    onChange={(e) => { setAssetClass(e.target.value); setPage(1); }}
                    className="w-full p-2.5 border-2 border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="">All Asset Classes</option>
                    {filterOptions.asset_classes.map((ac) => (
                      <option key={ac} value={ac}>{ac}</option>
                    ))}
                  </select>
                </div>
                
                {/* Region Filter */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-zinc-600 mb-2">
                    Region
                  </label>
                  <select
                    value={region}
                    onChange={(e) => { setRegion(e.target.value); setPage(1); }}
                    className="w-full p-2.5 border-2 border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="">All Regions</option>
                    {filterOptions.regions.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 border-t border-zinc-100">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-zinc-600 mb-2">YTD Direction</label>
                    <select
                      value={ytdTrend}
                      onChange={(e) => { setYtdTrend(e.target.value as typeof ytdTrend); setPage(1); }}
                      className="w-full p-2.5 border-2 border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="all">All</option>
                      <option value="positive">Positive YTD</option>
                      <option value="negative">Negative YTD</option>
                    </select>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-zinc-600 mb-2">Beta Profile</label>
                    <select
                      value={betaBand}
                      onChange={(e) => { setBetaBand(e.target.value as typeof betaBand); setPage(1); }}
                      className="w-full p-2.5 border-2 border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="all">All</option>
                      <option value="defensive">Defensive (&lt; 1.0)</option>
                      <option value="market">Market-like (0.9 - 1.1)</option>
                      <option value="aggressive">Aggressive (&gt; 1.1)</option>
                    </select>
                  </div>

                  <div className="mb-2">
                    <label className="block text-sm font-medium text-zinc-600 mb-2">Max Expense Ratio</label>
                    <select
                      value={expenseCap}
                      onChange={(e) => { setExpenseCap(e.target.value as typeof expenseCap); setPage(1); }}
                      className="w-full p-2.5 border-2 border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="all">No Limit</option>
                      <option value="0.10">0.10%</option>
                      <option value="0.25">0.25%</option>
                      <option value="0.50">0.50%</option>
                    </select>
                  </div>
                </div>

                {/* Ranking */}
                <div className="mt-4 pt-2 border-t border-zinc-100">
                  <label className="block text-sm font-medium text-zinc-600 mb-2">Rank ETFs By</label>
                  <select
                    value={rankMetric}
                    onChange={(e) => { setRankMetric(e.target.value as typeof rankMetric); setPage(1); }}
                    className="w-full p-2.5 border-2 border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 mb-3"
                  >
                    <option value="none">No Ranking</option>
                    <option value="ytd">YTD Return</option>
                    <option value="expense">Expense Ratio</option>
                    <option value="beta">Beta</option>
                    <option value="dividend">Dividend Yield</option>
                    <option value="aum">AUM</option>
                  </select>

                  <select
                    value={rankOrder}
                    onChange={(e) => setRankOrder(e.target.value as typeof rankOrder)}
                    disabled={rankMetric === 'none'}
                    className="w-full p-2.5 border-2 border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
                  >
                    <option value="desc">High to Low</option>
                    <option value="asc">Low to High</option>
                  </select>
                </div>
                </>
                )}

              </div>

              {/* ETF Quick Guide (Separate Section) */}
              <div className="bg-indigo-50 rounded-2xl shadow-sm p-4 mt-4 border border-indigo-100">
                <h3 className="text-sm font-semibold text-indigo-900 mb-3">ETF Quick Guide</h3>
                <div className="space-y-2">
                  {guideItems.map((item) => {
                    const isOpen = openGuide === item.key;
                    const isLast = guideItems[guideItems.length - 1]?.key === item.key;
                    return (
                      <div key={item.key} className="border border-indigo-200 rounded-lg bg-white/70">
                        <button
                          onClick={() => setOpenGuide(isOpen ? null : item.key)}
                          className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                        >
                          <span className="text-sm font-medium text-zinc-700">{item.title}</span>
                          <ChevronRight className={`w-4 h-4 text-zinc-500 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                        </button>
                        {isOpen && (
                          <div className="px-3 pb-3 text-xs leading-relaxed text-zinc-600">
                            <p>{item.body}</p>
                            {!isLast && (
                              <button
                                onClick={() => goToNextGuide(item.key)}
                                className="mt-2 text-xs font-medium text-indigo-700 hover:text-indigo-800"
                              >
                                Next guide &gt;
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </aside>

            {/* Content Area */}
            <div>
              {/* Mobile Filter Button & View Toggle */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowFilters(true)}
                    className="lg:hidden flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm text-sm font-medium text-zinc-600"
                  >
                    <Filter className="w-4 h-4" />
                    Filters
                    {hasActiveFilters && (
                      <span className="w-2 h-2 bg-indigo-500 rounded-full" />
                    )}
                  </button>
                  
                  <span className="text-sm text-zinc-500">
                    {hasQuickFilters ? `${visibleCount} ETFs on this page` : `${total.toLocaleString()} ETFs found`}
                  </span>
                </div>

                {/* View Toggle */}
                <div className="flex items-center gap-1 bg-white rounded-lg p-1 shadow-sm">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-md transition-colors ${
                      viewMode === 'grid' 
                        ? 'bg-indigo-500 text-white' 
                        : 'text-zinc-400 hover:text-zinc-600'
                    }`}
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-md transition-colors ${
                      viewMode === 'list' 
                        ? 'bg-indigo-500 text-white' 
                        : 'text-zinc-400 hover:text-zinc-600'
                    }`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Active Filters Pills */}
              {hasActiveFilters && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {search && (
                    <FilterPill label={`Search: ${search}`} onRemove={() => { setSearch(''); setSearchInput(''); }} />
                  )}
                  {category && (
                    <FilterPill label={category} onRemove={() => setCategory('')} />
                  )}
                  {assetClass && (
                    <FilterPill label={assetClass} onRemove={() => setAssetClass('')} />
                  )}
                  {region && (
                    <FilterPill label={region} onRemove={() => setRegion('')} />
                  )}
                  {ytdTrend !== 'all' && (
                    <FilterPill
                      label={`YTD: ${ytdTrend === 'positive' ? 'Positive' : 'Negative'}`}
                      onRemove={() => setYtdTrend('all')}
                    />
                  )}
                  {betaBand !== 'all' && (
                    <FilterPill label={`Beta: ${betaBand}`} onRemove={() => setBetaBand('all')} />
                  )}
                  {expenseCap !== 'all' && (
                    <FilterPill label={`Expense <= ${expenseCap}%`} onRemove={() => setExpenseCap('all')} />
                  )}
                  {rankMetric !== 'none' && (
                    <FilterPill
                      label={`Rank: ${rankMetric} (${rankOrder === 'desc' ? 'High-Low' : 'Low-High'})`}
                      onRemove={() => { setRankMetric('none'); setRankOrder('desc'); }}
                    />
                  )}
                </div>
              )}

              {/* Loading State */}
              {loading && (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                </div>
              )}

              {/* Error State */}
              {error && !loading && (
                <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                  <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-zinc-900 mb-2">Unable to Load ETFs</h3>
                  <p className="text-zinc-600 mb-4">{error}</p>
                  <button
                    onClick={fetchETFs}
                    className="px-6 py-2 bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-600"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* ETF Grid */}
              {!loading && !error && rankedETFs.length > 0 && (
                <>
                  {hasQuickFilters && (
                    <div className="mb-4 text-xs text-zinc-500 bg-zinc-100 rounded-lg px-3 py-2">
                      Quick filters currently apply to ETFs on this loaded page.
                    </div>
                  )}
                  <div className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6'
                      : 'flex flex-col gap-4'
                  }>
                    {rankedETFs.map((etf, index) => (
                      viewMode === 'grid' 
                        ? <ETFCard key={etf.ticker} etf={etf} rank={rankMetric !== 'none' ? index + 1 : null} formatReturn={formatReturn} getReturnColor={getReturnColor} />
                        : <ETFListItem key={etf.ticker} etf={etf} rank={rankMetric !== 'none' ? index + 1 : null} formatReturn={formatReturn} getReturnColor={getReturnColor} />
                    ))}
                  </div>

                  {/* Pagination */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 bg-white rounded-xl p-4 shadow-sm">
                    <span className="text-sm text-zinc-500">
                      {hasQuickFilters
                        ? `Showing ${rankedETFs.length} ETFs after quick filters`
                        : `Showing ${((page - 1) * pageSize) + 1} - ${Math.min(page * pageSize, total)} of ${total.toLocaleString()}`}
                    </span>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-2 border border-zinc-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:border-blue-500 transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      
                      {/* Page Numbers */}
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (page <= 3) {
                            pageNum = i + 1;
                          } else if (page >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = page - 2 + i;
                          }
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setPage(pageNum)}
                              className={`w-10 h-10 rounded-lg font-medium text-sm transition-colors ${
                                page === pageNum
                                  ? 'bg-indigo-500 text-white'
                                  : 'hover:bg-zinc-100 text-zinc-600'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>
                      
                      <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="p-2 border border-zinc-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:border-blue-500 transition-colors"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                    
                    <select
                      value={pageSize}
                      onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                      className="px-3 py-2 border border-zinc-200 rounded-lg text-sm"
                    >
                      <option value={12}>12 per page</option>
                      <option value={24}>24 per page</option>
                      <option value={48}>48 per page</option>
                    </select>
                  </div>
                </>
              )}

              {/* Empty State */}
              {!loading && !error && rankedETFs.length === 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                  <Search className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-zinc-900 mb-2">No ETFs Found</h3>
                  <p className="text-zinc-600 mb-6">
                    Try adjusting your filters or search terms
                  </p>
                  <button
                    onClick={clearFilters}
                    className="px-6 py-2 bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-600"
                  >
                    Clear Filters
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Filters Modal */}
      {showFilters && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowFilters(false)} />
          <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => setShowFiltersMobilePanel((prev) => !prev)}
                className="flex items-center gap-2"
              >
                <h2 className="text-lg font-semibold text-zinc-900">Filters</h2>
                <ChevronRight className={`w-4 h-4 text-zinc-500 transition-transform ${showFiltersMobilePanel ? 'rotate-90' : ''}`} />
              </button>
              <button onClick={() => setShowFilters(false)}>
                <X className="w-6 h-6 text-zinc-500" />
              </button>
            </div>

            {showFiltersMobilePanel && (
              <>
            
            {/* Category */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-zinc-600 mb-2">Category</label>
              <select
                value={category}
                onChange={(e) => { setCategory(e.target.value); setPage(1); }}
                className="w-full p-3 border-2 border-zinc-200 rounded-xl"
              >
                <option value="">All Categories</option>
                {filterOptions.categories.slice(0, 20).map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            
            {/* Asset Class */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-zinc-600 mb-2">Asset Class</label>
              <select
                value={assetClass}
                onChange={(e) => { setAssetClass(e.target.value); setPage(1); }}
                className="w-full p-3 border-2 border-zinc-200 rounded-xl"
              >
                <option value="">All Asset Classes</option>
                {filterOptions.asset_classes.map((ac) => (
                  <option key={ac} value={ac}>{ac}</option>
                ))}
              </select>
            </div>
            
            {/* Region */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-zinc-600 mb-2">Region</label>
              <select
                value={region}
                onChange={(e) => { setRegion(e.target.value); setPage(1); }}
                className="w-full p-3 border-2 border-zinc-200 rounded-xl"
              >
                <option value="">All Regions</option>
                {filterOptions.regions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="mb-6 pt-2 border-t border-zinc-100">
              <div className="mb-4">
                <label className="block text-sm font-medium text-zinc-600 mb-2">YTD Direction</label>
                <select
                  value={ytdTrend}
                  onChange={(e) => { setYtdTrend(e.target.value as typeof ytdTrend); setPage(1); }}
                  className="w-full p-3 border-2 border-zinc-200 rounded-xl"
                >
                  <option value="all">All</option>
                  <option value="positive">Positive YTD</option>
                  <option value="negative">Negative YTD</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-zinc-600 mb-2">Beta Profile</label>
                <select
                  value={betaBand}
                  onChange={(e) => { setBetaBand(e.target.value as typeof betaBand); setPage(1); }}
                  className="w-full p-3 border-2 border-zinc-200 rounded-xl"
                >
                  <option value="all">All</option>
                  <option value="defensive">Defensive (&lt; 1.0)</option>
                  <option value="market">Market-like (0.9 - 1.1)</option>
                  <option value="aggressive">Aggressive (&gt; 1.1)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-600 mb-2">Max Expense Ratio</label>
                <select
                  value={expenseCap}
                  onChange={(e) => { setExpenseCap(e.target.value as typeof expenseCap); setPage(1); }}
                  className="w-full p-3 border-2 border-zinc-200 rounded-xl"
                >
                  <option value="all">No Limit</option>
                  <option value="0.10">0.10%</option>
                  <option value="0.25">0.25%</option>
                  <option value="0.50">0.50%</option>
                </select>
              </div>
            </div>

            {/* Ranking */}
            <div className="mb-6 pt-2 border-t border-zinc-100">
              <label className="block text-sm font-medium text-zinc-600 mb-2">Rank ETFs By</label>
              <select
                value={rankMetric}
                onChange={(e) => { setRankMetric(e.target.value as typeof rankMetric); setPage(1); }}
                className="w-full p-3 border-2 border-zinc-200 rounded-xl mb-3"
              >
                <option value="none">No Ranking</option>
                <option value="ytd">YTD Return</option>
                <option value="expense">Expense Ratio</option>
                <option value="beta">Beta</option>
                <option value="dividend">Dividend Yield</option>
                <option value="aum">AUM</option>
              </select>

              <select
                value={rankOrder}
                onChange={(e) => setRankOrder(e.target.value as typeof rankOrder)}
                disabled={rankMetric === 'none'}
                className="w-full p-3 border-2 border-zinc-200 rounded-xl disabled:opacity-50"
              >
                <option value="desc">High to Low</option>
                <option value="asc">Low to High</option>
              </select>
            </div>
            </>
            )}

            {/* ETF Quick Guide */}
            <div className="mb-6 pt-4 border-t border-zinc-100 bg-indigo-50 rounded-2xl p-4 border border-indigo-100">
              <h3 className="text-sm font-semibold text-zinc-900 mb-3">ETF Quick Guide</h3>
              <div className="space-y-2">
                {guideItems.map((item) => {
                  const isOpen = openGuide === item.key;
                  const isLast = guideItems[guideItems.length - 1]?.key === item.key;
                  return (
                    <div key={item.key} className="border border-indigo-200 rounded-lg bg-white/70">
                      <button
                        onClick={() => setOpenGuide(isOpen ? null : item.key)}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                      >
                        <span className="text-sm font-medium text-zinc-700">{item.title}</span>
                        <ChevronRight className={`w-4 h-4 text-zinc-500 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                      </button>
                      {isOpen && (
                        <div className="px-3 pb-3 text-xs leading-relaxed text-zinc-600">
                          <p>{item.body}</p>
                          {!isLast && (
                            <button
                              onClick={() => goToNextGuide(item.key)}
                              className="mt-2 text-xs font-medium text-indigo-700 hover:text-indigo-800"
                            >
                              Next guide &gt;
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={clearFilters}
                className="flex-1 py-3 border-2 border-zinc-200 rounded-xl font-medium text-zinc-600"
              >
                Clear All
              </button>
              <button
                onClick={() => { setShowFilters(false); setPage(1); }}
                className="flex-1 py-3 bg-indigo-500 text-white rounded-xl font-medium"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Filter Pill Component
function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-indigo-700 rounded-full text-sm">
      {label}
      <button onClick={onRemove} className="hover:bg-blue-200 rounded-full p-0.5">
        <X className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}

// ETF Card Component (Grid View)
function ETFCard({ 
  etf, 
  rank,
  formatReturn, 
  getReturnColor 
}: { 
  etf: ETF; 
  rank?: number | null;
  formatReturn: (v: string | null) => string;
  getReturnColor: (v: string | null) => string;
}) {
  const router = useRouter();
  
  return (
    <div 
      onClick={() => router.push(`/etfs/${etf.ticker}`)}
      className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-sm transition-all cursor-pointer border-2 border-transparent hover:border-indigo-200 group"
    >
      {rank != null && (
        <div className="mb-3 inline-flex items-center px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">
          #{rank}
        </div>
      )}
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-zinc-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
              {etf.etf_name}
            </h3>
            <span className="text-sm font-mono text-zinc-500">{etf.ticker}</span>
          </div>
          <Star className="w-5 h-5 text-zinc-300 hover:text-yellow-400 transition-colors" />
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-2 bg-zinc-50 rounded-lg">
          <p className={`text-sm font-semibold font-mono ${getReturnColor(etf.ytd_return)}`}>
            {formatReturn(etf.ytd_return)}
          </p>
          <p className="text-xs text-zinc-500">YTD</p>
        </div>
        <div className="text-center p-2 bg-zinc-50 rounded-lg">
          <p className="text-sm font-semibold font-mono text-zinc-700">
            {etf.expense_ratio || 'N/A'}
          </p>
          <p className="text-xs text-zinc-500">Expense</p>
        </div>
        <div className="text-center p-2 bg-zinc-50 rounded-lg">
          <p className="text-sm font-semibold font-mono text-zinc-700">
            {etf.beta || 'N/A'}
          </p>
          <p className="text-xs text-zinc-500">Beta</p>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-4">
        {etf.category && (
          <span className="px-2 py-1 bg-blue-100 text-indigo-700 text-xs rounded-full line-clamp-1">
            {etf.category}
          </span>
        )}
        {etf.asset_class && (
          <span className="px-2 py-1 bg-zinc-100 text-zinc-600 text-xs rounded-full">
            {etf.asset_class}
          </span>
        )}
      </div>

      {/* AUM & Dividend */}
      <div className="flex justify-between text-xs text-zinc-500 pt-3 border-t border-zinc-100">
        <span>AUM: {etf.aum || 'N/A'}</span>
        <span>Div: {etf.annual_dividend_yield || 'N/A'}</span>
      </div>
    </div>
  );
}

// ETF List Item Component (List View)
function ETFListItem({ 
  etf, 
  rank,
  formatReturn, 
  getReturnColor 
}: { 
  etf: ETF; 
  rank?: number | null;
  formatReturn: (v: string | null) => string;
  getReturnColor: (v: string | null) => string;
}) {
  const router = useRouter();
  
  return (
    <div 
      onClick={() => router.push(`/etfs/${etf.ticker}`)}
      className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer border-2 border-transparent hover:border-indigo-200 flex items-center gap-4"
    >
      {rank != null && (
        <div className="w-12 flex-shrink-0 text-center">
          <span className="inline-flex items-center justify-center px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">
            #{rank}
          </span>
        </div>
      )}
      {/* Ticker */}
      <div className="w-20 flex-shrink-0">
        <span className="font-mono font-semibold text-indigo-600">{etf.ticker}</span>
      </div>
      
      {/* Name & Category */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-zinc-900 truncate">{etf.etf_name}</h3>
        <p className="text-sm text-zinc-500 truncate">{etf.category || 'Uncategorized'}</p>
      </div>
      
      {/* Metrics */}
      <div className="hidden sm:flex items-center gap-6 flex-shrink-0">
        <div className="text-right">
          <p className={`text-sm font-semibold font-mono ${getReturnColor(etf.ytd_return)}`}>
            {formatReturn(etf.ytd_return)}
          </p>
          <p className="text-xs text-zinc-500">YTD</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold font-mono text-zinc-700">{etf.expense_ratio || 'N/A'}</p>
          <p className="text-xs text-zinc-500">Expense</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold font-mono text-zinc-700">{etf.aum || 'N/A'}</p>
          <p className="text-xs text-zinc-500">AUM</p>
        </div>
      </div>
      
      <ChevronRight className="w-5 h-5 text-zinc-400 flex-shrink-0" />
    </div>
  );
}

export default function ETFDiscoveryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50 flex items-center justify-center"><div className="text-zinc-600">Loading...</div></div>}>
      <ETFDiscoveryContent />
    </Suspense>
  );
}
