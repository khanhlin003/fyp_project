'use client';

import { useState } from 'react';
import { AxiosError } from 'axios';
import { TrendingDown, BarChart3, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { analyzeScenario, ScenarioOption, ScenarioResult } from '@/lib/api';

type AnalysisTargetType = 'portfolio' | 'wallet' | 'etf';

interface ScenarioAnalysisProps {
  scenarios: ScenarioOption[];
  wallets: Array<{ id: number; name: string }>;
  tickers: string[];
  onAnalyze?: (result: ScenarioResult) => void;
  compact?: boolean;
}

export default function ScenarioAnalysis({ scenarios, wallets, tickers, onAnalyze, compact = false }: ScenarioAnalysisProps) {
  const [selectedScenario, setSelectedScenario] = useState<string>('covid-crash');
  const [targetType, setTargetType] = useState<AnalysisTargetType>('portfolio');
  const [selectedWalletId, setSelectedWalletId] = useState<number | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string>('');
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);

    if (targetType === 'wallet' && !selectedWalletId) {
      setError('Please select a wallet to analyze.');
      setLoading(false);
      return;
    }

    if (targetType === 'etf' && !selectedTicker) {
      setError('Please select an ETF ticker to analyze.');
      setLoading(false);
      return;
    }
    
    try {
      const data = await analyzeScenario(selectedScenario, undefined, {
        target_type: targetType,
        wallet_id: targetType === 'wallet' ? selectedWalletId || undefined : undefined,
        ticker: targetType === 'etf' ? selectedTicker : undefined,
      });
      setResult(data);
      setShowDetails(true);
      onAnalyze?.(data);
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ detail?: string }>;
      setError(axiosErr.response?.data?.detail || 'Failed to analyze scenario');
    } finally {
      setLoading(false);
    }
  };

  const getScenarioIcon = (type: string) => {
    if (type === 'historical') return <BarChart3 className="w-5 h-5" />;
    return <TrendingDown className="w-5 h-5" />;
  };

  const getChangeColor = (changePercent: number) => {
    if (changePercent >= 0) return 'text-[#1cb08a]';
    if (changePercent >= -10) return 'text-[#d4860a]';
    if (changePercent >= -20) return 'text-[#d4860a]';
    return 'text-[#d44a4a]';
  };

  const selectedScenarioData = scenarios.find(s => s.id === selectedScenario);

  return (
    <div className={`bg-white rounded-lg shadow-[0_4px_16px_rgba(85,178,201,0.12)] border-[1.5px] border-[#cae7ee] ${compact ? 'p-4' : 'p-6'}`}>
      {/* Scenario Selector */}
      <div className={compact ? 'mb-4' : 'mb-6'}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div>
            <label className="block text-sm font-medium text-[#3a5260] mb-2">
              Analyze Scope
            </label>
            <select
              value={targetType}
              onChange={(e) => {
                const nextTarget = e.target.value as AnalysisTargetType;
                setTargetType(nextTarget);
                if (nextTarget !== 'wallet') setSelectedWalletId(null);
                if (nextTarget !== 'etf') setSelectedTicker('');
              }}
              className="w-full px-4 py-3 border border-[#cae7ee] rounded-lg focus:ring-2 focus:ring-[rgba(99,102,241,0.3)] focus:border-[#6366f1]"
              disabled={loading}
            >
              <option value="portfolio">Total Portfolio</option>
              <option value="wallet">Each Wallet</option>
              <option value="etf">Single ETF</option>
            </select>

            {targetType === 'wallet' && (
              <select
                value={selectedWalletId ?? ''}
                onChange={(e) => setSelectedWalletId(e.target.value ? Number(e.target.value) : null)}
                className="w-full mt-3 px-4 py-3 border border-[#cae7ee] rounded-lg focus:ring-2 focus:ring-[rgba(99,102,241,0.3)] focus:border-[#6366f1]"
                disabled={loading}
              >
                <option value="">Select Wallet</option>
                {wallets.map((wallet) => (
                  <option key={wallet.id} value={wallet.id}>
                    {wallet.name}
                  </option>
                ))}
              </select>
            )}

            {targetType === 'etf' && (
              <select
                value={selectedTicker}
                onChange={(e) => setSelectedTicker(e.target.value)}
                className="w-full mt-3 px-4 py-3 border border-[#cae7ee] rounded-lg focus:ring-2 focus:ring-[rgba(99,102,241,0.3)] focus:border-[#6366f1]"
                disabled={loading}
              >
                <option value="">Select ETF</option>
                {tickers.map((ticker) => (
                  <option key={ticker} value={ticker}>
                    {ticker}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[#3a5260] mb-2">
              Select Scenario
            </label>
            <select
              value={selectedScenario}
              onChange={(e) => setSelectedScenario(e.target.value)}
              className="w-full px-4 py-3 border border-[#cae7ee] rounded-lg focus:ring-2 focus:ring-[rgba(99,102,241,0.3)] focus:border-[#6366f1]"
              disabled={loading}
            >
              {scenarios.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.name} - {scenario.description}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedScenarioData && (
          <div className="mt-3 p-3 bg-[#f7fbfc] rounded-lg">
            <div className="flex items-start gap-3">
              <div className="text-[#3a5260]">
                {getScenarioIcon(selectedScenarioData.type)}
              </div>
              <div className="flex-1">
                <p className="text-sm text-[#3a5260]">{selectedScenarioData.description}</p>
                {selectedScenarioData.period && (
                  <p className="text-xs text-[#7a9fad] mt-1">Period: {selectedScenarioData.period}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Analyze Button */}
      <div className="flex justify-end">
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm font-medium py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <BarChart3 className="w-4 h-4" />
              Run Analysis
            </>
          )}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-4 bg-[rgba(212,74,74,0.12)] border border-red-200 rounded-lg">
          <p className="text-sm text-[#d44a4a]">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className={`${compact ? 'mt-4 space-y-4' : 'mt-6 space-y-6'}`}>
          {/* Portfolio Summary */}
          <div className={`bg-[rgba(85,178,201,0.08)] rounded-lg border border-[#a8d8e4] ${compact ? 'p-4' : 'p-6'}`}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#3d96ad]" />
              Portfolio Impact
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-[#3a5260]">Current Value (Baseline)</p>
                <p className="text-xl font-bold text-[#0d1117]">
                  ${result.portfolio_summary.initial_value.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-[#3a5260]">Scenario Value</p>
                <p className="text-xl font-bold text-[#0d1117]">
                  ${result.portfolio_summary.scenario_value.toLocaleString()}
                </p>
              </div>
              <div className="col-span-2 pt-4 border-t border-[#a8d8e4]">
                <p className="text-sm text-[#3a5260]">Total Change</p>
                <p className={`font-bold ${compact ? 'text-xl' : 'text-2xl'} ${getChangeColor(result.portfolio_summary.change_percent)}`}>
                  {result.portfolio_summary.change_percent >= 0 ? '+' : ''}
                  {result.portfolio_summary.change_percent.toFixed(2)}%
                  <span className="text-lg ml-2">
                    ({result.portfolio_summary.change_amount >= 0 ? '+' : ''}
                    ${result.portfolio_summary.change_amount.toLocaleString()})
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Insights */}
          {result.insights && (
            <div className="bg-[rgba(212,134,10,0.12)] rounded-lg p-4 border border-[rgba(212,134,10,0.25)]">
              <h4 className="font-semibold mb-2 text-[#d4860a]">Key Insights</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[#d4860a]">Worst Performer:</p>
                  <p className="font-semibold text-[#d4860a]">
                    {result.insights.worst_performer} ({result.insights.worst_decline?.toFixed(2)}%)
                  </p>
                </div>
                <div>
                  <p className="text-[#d4860a]">Best Performer:</p>
                  <p className="font-semibold text-[#d4860a]">
                    {result.insights.best_performer} ({result.insights.best_performance?.toFixed(2)}%)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Holdings Details */}
          <div>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-between p-3 bg-[#f7fbfc] hover:bg-[#f0f8fa] rounded-lg transition"
            >
              <span className="font-semibold">Holdings Breakdown ({result.holdings.length} ETFs)</span>
              {showDetails ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>

            {showDetails && (
              <div className="mt-3 overflow-x-auto border border-[#cae7ee] rounded-lg">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-[#f8fafc] text-[#64748b]">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Ticker</th>
                      <th className="text-right font-medium px-3 py-2">Qty</th>
                      <th className="text-right font-medium px-3 py-2">Current Value</th>
                      <th className="text-right font-medium px-3 py-2">Scenario Value</th>
                      <th className="text-right font-medium px-3 py-2">Change %</th>
                      <th className="text-right font-medium px-3 py-2">Max DD</th>
                      <th className="text-left font-medium px-3 py-2">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.holdings.map((holding) => (
                      <tr key={holding.ticker} className="border-t border-[#cae7ee]">
                        <td className="px-3 py-2 font-semibold text-[#0d1117]">{holding.ticker}</td>
                        <td className="px-3 py-2 text-right">{holding.quantity}</td>
                        <td className="px-3 py-2 text-right">${holding.initial_value.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">${holding.scenario_value.toLocaleString()}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${getChangeColor(holding.change_percent)}`}>
                          {holding.change_percent >= 0 ? '+' : ''}{holding.change_percent.toFixed(2)}%
                        </td>
                        <td className="px-3 py-2 text-right">
                          {holding.max_drawdown !== undefined ? `${holding.max_drawdown.toFixed(2)}%` : '-'}
                        </td>
                        <td className="px-3 py-2 text-xs text-[#d4860a]">{holding.note || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
