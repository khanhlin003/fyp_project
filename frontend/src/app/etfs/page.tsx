'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { getETFs, getFilterOptions, ETF } from '@/lib/api';
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Loader2,
  AlertCircle,
  X,
} from 'lucide-react';

function ETFDiscoveryContent() {
  const router = useRouter();

  const [etfs, setETFs] = useState<ETF[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [showFilters, setShowFilters] = useState(false);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [category, setCategory] = useState('');
  const [assetClass, setAssetClass] = useState('');
  const [etfType, setEtfType] = useState('');
  const [region, setRegion] = useState('');
  const [ytdTrend, setYtdTrend] = useState<'all' | 'positive' | 'negative'>('all');
  const [betaBand, setBetaBand] = useState<'all' | 'defensive' | 'market' | 'aggressive'>('all');
  const [expenseCap, setExpenseCap] = useState<'all' | '0.10' | '0.25' | '0.50'>('all');
  const [rankMetric, setRankMetric] = useState<'none' | 'ytd' | 'expense' | 'beta' | 'price' | 'volume' | 'aum'>('none');
  const [rankOrder, setRankOrder] = useState<'asc' | 'desc'>('desc');
  const [showFiltersDesktopPanel, setShowFiltersDesktopPanel] = useState(true);
  const [showFiltersMobilePanel, setShowFiltersMobilePanel] = useState(true);
  const [openGuide, setOpenGuide] = useState<string | null>(null);

  const [filterOptions, setFilterOptions] = useState<{
    categories: string[];
    asset_classes: string[];
    etf_types: string[];
    regions: string[];
  }>({ categories: [], asset_classes: [], etf_types: [], regions: [] });

  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const options = await getFilterOptions();
        setFilterOptions({
          categories: Array.isArray(options?.categories) ? options.categories : [],
          asset_classes: Array.isArray(options?.asset_classes) ? options.asset_classes : [],
          etf_types: Array.isArray(options?.etf_types) ? options.etf_types : [],
          regions: Array.isArray(options?.regions) ? options.regions : [],
        });
      } catch (err) {
        console.error('Failed to fetch filter options:', err);
      }
    };
    fetchFilterOptions();
  }, []);

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
      if (etfType) params.etf_type = etfType;
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
  }, [page, pageSize, search, category, assetClass, etfType, region]);

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
      if (rankMetric === 'price') return etf.latest_price ?? null;
      if (rankMetric === 'volume') return etf.latest_volume ?? null;
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setSearchInput('');
    setCategory('');
    setAssetClass('');
    setEtfType('');
    setRegion('');
    setYtdTrend('all');
    setBetaBand('all');
    setExpenseCap('all');
    setRankMetric('none');
    setRankOrder('desc');
    setPage(1);
  };

  const handleTableSort = (metric: 'ytd' | 'expense' | 'beta' | 'price' | 'volume' | 'aum') => {
    setPage(1);

    if (rankMetric === metric) {
      setRankOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
      return;
    }

    setRankMetric(metric);
    setRankOrder('desc');
  };

  const hasActiveFilters =
    search ||
    category ||
    assetClass ||
    etfType ||
    region ||
    ytdTrend !== 'all' ||
    betaBand !== 'all' ||
    expenseCap !== 'all';

  const hasQuickFilters = ytdTrend !== 'all' || betaBand !== 'all' || expenseCap !== 'all';
  const totalPages = Math.ceil(total / pageSize);
  const visibleCount = rankedETFs.length;

  const guideItems = [
    {
      key: 'what-is-etf',
      title: 'What is an ETF?',
      body: 'An ETF is a basket of securities traded like a stock. It gives instant diversification with one trade.',
    },
    {
      key: 'how-to-select',
      title: 'How to Select an ETF',
      body: 'Check objective fit, expense ratio, liquidity, AUM size, and whether risk profile matches your goal.',
    },
    {
      key: 'key-metrics',
      title: 'How to Read Key Metrics',
      body: 'YTD shows year-to-date return. Expense ratio is annual cost. Beta reflects sensitivity to market moves.',
    },
  ];

  const goToNextGuide = (currentKey: string) => {
    const currentIndex = guideItems.findIndex((item) => item.key === currentKey);
    if (currentIndex < 0) return;
    const next = guideItems[currentIndex + 1];
    setOpenGuide(next ? next.key : null);
  };

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
      <main className="pt-16 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <form onSubmit={handleSearch} className="max-w-xl mb-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input
                type="text"
                placeholder="Search ETFs by name or ticker..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border-2 border-zinc-200 bg-white rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </form>

          <div className="mb-6 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
            Please do the risk quiz to get ETF recommendations for your wallet.{' '}
            <button
              type="button"
              onClick={() => router.push('/questionnaire')}
              className="font-semibold text-indigo-700 underline underline-offset-2 hover:text-indigo-900"
            >
              Go to Risk Quiz
            </button>
          </div>

          <div className="lg:grid lg:grid-cols-[1fr_280px] lg:gap-8">
            <div className="lg:order-1">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowFilters(true)}
                    className="lg:hidden flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm text-sm font-medium text-zinc-600"
                  >
                    <Filter className="w-4 h-4" />
                    Filters
                    {hasActiveFilters && <span className="w-2 h-2 bg-indigo-500 rounded-full" />}
                  </button>

                  <span className="text-sm text-zinc-500">
                    {hasQuickFilters ? `${visibleCount} ETFs on this page` : `${total.toLocaleString()} ETFs found`}
                  </span>
                </div>
              </div>

              {hasActiveFilters && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {search && <FilterPill label={`Search: ${search}`} onRemove={() => { setSearch(''); setSearchInput(''); }} />}
                  {category && <FilterPill label={category} onRemove={() => setCategory('')} />}
                  {assetClass && <FilterPill label={assetClass} onRemove={() => setAssetClass('')} />}
                  {etfType && <FilterPill label={`Type: ${etfType}`} onRemove={() => setEtfType('')} />}
                  {region && <FilterPill label={region} onRemove={() => setRegion('')} />}
                  {ytdTrend !== 'all' && (
                    <FilterPill
                      label={`YTD: ${ytdTrend === 'positive' ? 'Positive' : 'Negative'}`}
                      onRemove={() => setYtdTrend('all')}
                    />
                  )}
                  {betaBand !== 'all' && <FilterPill label={`Beta: ${betaBand}`} onRemove={() => setBetaBand('all')} />}
                  {expenseCap !== 'all' && <FilterPill label={`Expense <= ${expenseCap}%`} onRemove={() => setExpenseCap('all')} />}
                </div>
              )}

              {loading && (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                </div>
              )}

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

              {!loading && !error && rankedETFs.length > 0 && (
                <>
                  {hasQuickFilters && (
                    <div className="mb-4 text-xs text-zinc-500 bg-zinc-100 rounded-lg px-3 py-2">
                      Quick filters currently apply to ETFs on this loaded page.
                    </div>
                  )}

                  <ETFTable
                    etfs={rankedETFs}
                    showRank={rankMetric !== 'none'}
                    rankMetric={rankMetric}
                    rankOrder={rankOrder}
                    onSort={handleTableSort}
                    formatReturn={formatReturn}
                    getReturnColor={getReturnColor}
                  />

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 bg-white rounded-xl p-4 shadow-sm">
                    <span className="text-sm text-zinc-500">
                      {hasQuickFilters
                        ? `Showing ${rankedETFs.length} ETFs after quick filters`
                        : `Showing ${((page - 1) * pageSize) + 1} - ${Math.min(page * pageSize, total)} of ${total.toLocaleString()}`}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-2 border border-zinc-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:border-blue-500 transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>

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
                                page === pageNum ? 'bg-indigo-500 text-white' : 'hover:bg-zinc-100 text-zinc-600'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="p-2 border border-zinc-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:border-blue-500 transition-colors"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>

                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                      className="px-3 py-2 border border-zinc-200 rounded-lg text-sm"
                    >
                      <option value={12}>12 per page</option>
                      <option value={24}>24 per page</option>
                      <option value={48}>48 per page</option>
                    </select>
                  </div>
                </>
              )}

              {!loading && !error && rankedETFs.length === 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                  <Search className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-zinc-900 mb-2">No ETFs Found</h3>
                  <p className="text-zinc-600 mb-6">Try adjusting your filters or search terms</p>
                  <button
                    onClick={clearFilters}
                    className="px-6 py-2 bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-600"
                  >
                    Clear Filters
                  </button>
                </div>
              )}
            </div>

            <aside className="hidden lg:block lg:order-2">
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
                    <button onClick={clearFilters} className="text-sm text-indigo-500 hover:text-indigo-600">
                      Clear all
                    </button>
                  )}
                </div>

                {showFiltersDesktopPanel && (
                  <FiltersForm
                    category={category}
                    setCategory={setCategory}
                    assetClass={assetClass}
                    setAssetClass={setAssetClass}
                    etfType={etfType}
                    setEtfType={setEtfType}
                    region={region}
                    setRegion={setRegion}
                    ytdTrend={ytdTrend}
                    setYtdTrend={setYtdTrend}
                    betaBand={betaBand}
                    setBetaBand={setBetaBand}
                    expenseCap={expenseCap}
                    setExpenseCap={setExpenseCap}
                    setPage={setPage}
                    filterOptions={filterOptions}
                  />
                )}
              </div>

              <QuickGuide
                guideItems={guideItems}
                openGuide={openGuide}
                setOpenGuide={setOpenGuide}
                goToNextGuide={goToNextGuide}
              />
            </aside>
          </div>
        </div>
      </main>

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
              <FiltersForm
                category={category}
                setCategory={setCategory}
                assetClass={assetClass}
                setAssetClass={setAssetClass}
                etfType={etfType}
                setEtfType={setEtfType}
                region={region}
                setRegion={setRegion}
                ytdTrend={ytdTrend}
                setYtdTrend={setYtdTrend}
                betaBand={betaBand}
                setBetaBand={setBetaBand}
                expenseCap={expenseCap}
                setExpenseCap={setExpenseCap}
                setPage={setPage}
                filterOptions={filterOptions}
              />
            )}

            <QuickGuide
              guideItems={guideItems}
              openGuide={openGuide}
              setOpenGuide={setOpenGuide}
              goToNextGuide={goToNextGuide}
              mobile
            />

            <div className="flex gap-3">
              <button
                onClick={clearFilters}
                className="flex-1 py-3 border-2 border-zinc-200 rounded-xl font-medium text-zinc-600"
              >
                Clear All
              </button>
              <button
                onClick={() => {
                  setShowFilters(false);
                  setPage(1);
                }}
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

function FiltersForm(props: {
  category: string;
  setCategory: (v: string) => void;
  assetClass: string;
  setAssetClass: (v: string) => void;
  etfType: string;
  setEtfType: (v: string) => void;
  region: string;
  setRegion: (v: string) => void;
  ytdTrend: 'all' | 'positive' | 'negative';
  setYtdTrend: (v: 'all' | 'positive' | 'negative') => void;
  betaBand: 'all' | 'defensive' | 'market' | 'aggressive';
  setBetaBand: (v: 'all' | 'defensive' | 'market' | 'aggressive') => void;
  expenseCap: 'all' | '0.10' | '0.25' | '0.50';
  setExpenseCap: (v: 'all' | '0.10' | '0.25' | '0.50') => void;
  setPage: (v: number) => void;
  filterOptions: {
    categories: string[];
    asset_classes: string[];
    etf_types: string[];
    regions: string[];
  };
}) {
  return (
    <>
      <div className="mb-6">
        <label className="block text-sm font-medium text-zinc-600 mb-2">Category</label>
        <select
          value={props.category}
          onChange={(e) => {
            props.setCategory(e.target.value);
            props.setPage(1);
          }}
          className="w-full p-2.5 border-2 border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">All Categories</option>
          {props.filterOptions.categories.slice(0, 20).map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-zinc-600 mb-2">Asset Class</label>
        <select
          value={props.assetClass}
          onChange={(e) => {
            props.setAssetClass(e.target.value);
            props.setPage(1);
          }}
          className="w-full p-2.5 border-2 border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">All Asset Classes</option>
          {props.filterOptions.asset_classes.map((ac) => (
            <option key={ac} value={ac}>
              {ac}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-zinc-600 mb-2">ETF Type</label>
        <select
          value={props.etfType}
          onChange={(e) => {
            props.setEtfType(e.target.value);
            props.setPage(1);
          }}
          className="w-full p-2.5 border-2 border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">All Types</option>
          {((props.filterOptions.etf_types?.length ?? 0) > 0 ? props.filterOptions.etf_types : ['ACTIVE', 'PASSIVE']).map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-zinc-600 mb-2">Region</label>
        <select
          value={props.region}
          onChange={(e) => {
            props.setRegion(e.target.value);
            props.setPage(1);
          }}
          className="w-full p-2.5 border-2 border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">All Regions</option>
          {props.filterOptions.regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div className="pt-2 border-t border-zinc-100">
        <div className="mb-4">
          <label className="block text-sm font-medium text-zinc-600 mb-2">YTD Direction</label>
          <select
            value={props.ytdTrend}
            onChange={(e) => {
              props.setYtdTrend(e.target.value as 'all' | 'positive' | 'negative');
              props.setPage(1);
            }}
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
            value={props.betaBand}
            onChange={(e) => {
              props.setBetaBand(e.target.value as 'all' | 'defensive' | 'market' | 'aggressive');
              props.setPage(1);
            }}
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
            value={props.expenseCap}
            onChange={(e) => {
              props.setExpenseCap(e.target.value as 'all' | '0.10' | '0.25' | '0.50');
              props.setPage(1);
            }}
            className="w-full p-2.5 border-2 border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="all">No Limit</option>
            <option value="0.10">0.10%</option>
            <option value="0.25">0.25%</option>
            <option value="0.50">0.50%</option>
          </select>
        </div>
      </div>

    </>
  );
}

function QuickGuide({
  guideItems,
  openGuide,
  setOpenGuide,
  goToNextGuide,
  mobile = false,
}: {
  guideItems: { key: string; title: string; body: string }[];
  openGuide: string | null;
  setOpenGuide: (v: string | null) => void;
  goToNextGuide: (currentKey: string) => void;
  mobile?: boolean;
}) {
  return (
    <div className={`${mobile ? 'mb-6 pt-4 border-t border-zinc-100' : 'bg-indigo-50 rounded-2xl shadow-sm p-4 mt-4 border border-indigo-100'} ${mobile ? 'bg-indigo-50 rounded-2xl p-4 border border-indigo-100' : ''}`}>
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
  );
}

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

function ETFTable({
  etfs,
  showRank,
  rankMetric,
  rankOrder,
  onSort,
  formatReturn,
  getReturnColor,
}: {
  etfs: ETF[];
  showRank: boolean;
  rankMetric: 'none' | 'ytd' | 'expense' | 'beta' | 'price' | 'volume' | 'aum';
  rankOrder: 'asc' | 'desc';
  onSort: (metric: 'ytd' | 'expense' | 'beta' | 'price' | 'volume' | 'aum') => void;
  formatReturn: (v: string | null) => string;
  getReturnColor: (v: string | null) => string;
}) {
  const router = useRouter();
  const formatLatestPrice = (value?: number | null) => {
    if (value == null) return 'N/A';
    return value.toFixed(2);
  };

  const formatLatestVolume = (value?: number | null) => {
    if (value == null) return 'N/A';
    return value.toLocaleString();
  };

  const renderSortHeader = (label: string, metric: 'ytd' | 'expense' | 'beta' | 'price' | 'volume' | 'aum') => {
    const isActive = rankMetric === metric;
    const direction = isActive ? (rankOrder === 'desc' ? '▼' : '▲') : '';

    return (
      <button
        type="button"
        onClick={() => onSort(metric)}
        className={`inline-flex items-center justify-end gap-1.5 ml-auto transition-colors ${
          isActive ? 'text-indigo-600' : 'text-zinc-600 hover:text-zinc-900'
        }`}
      >
        <span>{label}</span>
        {isActive ? (
          <span className="text-[10px] leading-none">{direction}</span>
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5" />
        )}
      </button>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-x-auto">
      <table className="w-full min-w-[860px]">
        <thead className="bg-zinc-50 border-b border-zinc-200">
          <tr>
            {showRank && <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 uppercase">Rank</th>}
            <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 uppercase">Ticker</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 uppercase">ETF Name</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 uppercase">Category</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600 uppercase">{renderSortHeader('YTD', 'ytd')}</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600 uppercase">{renderSortHeader('Expense', 'expense')}</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600 uppercase">{renderSortHeader('Beta', 'beta')}</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600 uppercase">{renderSortHeader('Latest Price', 'price')}</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600 uppercase">{renderSortHeader('Latest Volume', 'volume')}</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600 uppercase">{renderSortHeader('AUM', 'aum')}</th>
          </tr>
        </thead>
        <tbody>
          {etfs.map((etf, index) => (
            <tr
              key={etf.ticker}
              onClick={() => router.push(`/etfs/${etf.ticker}`)}
              className="border-b border-zinc-100 hover:bg-indigo-50/40 cursor-pointer transition-colors"
            >
              {showRank && <td className="px-4 py-3 text-sm text-zinc-600 font-medium">#{index + 1}</td>}
              <td className="px-4 py-3 text-sm font-mono font-semibold text-indigo-700">{etf.ticker}</td>
              <td className="px-4 py-3 text-sm text-zinc-900 max-w-[180px] truncate">{etf.etf_name}</td>
              <td className="px-4 py-3 text-sm text-zinc-600 max-w-[140px] truncate">{etf.category || 'N/A'}</td>
              <td className={`px-4 py-3 text-sm text-right font-semibold ${getReturnColor(etf.ytd_return)}`}>
                {formatReturn(etf.ytd_return)}
              </td>
              <td className="px-4 py-3 text-sm text-right text-zinc-700">{etf.expense_ratio || 'N/A'}</td>
              <td className="px-4 py-3 text-sm text-right text-zinc-700">{etf.beta || 'N/A'}</td>
              <td className="px-4 py-3 text-sm text-right text-zinc-700">{formatLatestPrice(etf.latest_price)}</td>
              <td className="px-4 py-3 text-sm text-right text-zinc-700">{formatLatestVolume(etf.latest_volume)}</td>
              <td className="px-4 py-3 text-sm text-right text-zinc-700">{etf.aum || 'N/A'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-4 py-2 text-xs text-zinc-500 border-t border-zinc-100 bg-zinc-50">
        Tip: Click any row to open the ETF detail page.
      </div>
    </div>
  );
}

export default function ETFDiscoveryPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
          <div className="text-zinc-600">Loading...</div>
        </div>
      }
    >
      <ETFDiscoveryContent />
    </Suspense>
  );
}
