'use client';

import { useState } from 'react';
import { TrendingDown, AlertTriangle, BarChart3, RefreshCw, Info } from 'lucide-react';

interface VarMethod {
  var_amount: number;
  var_percent: number;
  description: string;
}

interface CVarMethod {
  var_amount: number;
  var_percent: number;
  description: string;
}

interface PortfolioStatistics {
  mean_daily_return: number;
  daily_volatility: number;
  annualized_volatility: number;
  worst_day_return: number;
  best_day_return: number;
}

interface HoldingAnalysis {
  ticker: string;
  weight: number;
  data_points: number;
}

interface VarResult {
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

interface VarAnalysisProps {
  onCalculate: (confidenceLevel: number, timeHorizon: number) => Promise<VarResult>;
  compact?: boolean;
}

export default function VarAnalysis({ onCalculate, compact = false }: VarAnalysisProps) {
  const [confidenceLevel, setConfidenceLevel] = useState<number>(0.95);
  const [timeHorizon, setTimeHorizon] = useState<number>(252);
  const [result, setResult] = useState<VarResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCalculate = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await onCalculate(confidenceLevel, timeHorizon);
      setResult(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to calculate VaR');
    } finally {
      setLoading(false);
    }
  };

  const confidenceLevels = [
    { value: 0.90, label: '90%' },
    { value: 0.95, label: '95%' },
    { value: 0.99, label: '99%' },
  ];

  const timeHorizons = [
    { value: 30, label: '1 Month' },
    { value: 90, label: '3 Months' },
    { value: 252, label: '1 Year' },
    { value: 504, label: '2 Years' },
  ];

  return (
    <div className={`bg-white rounded-lg shadow-[0_4px_16px_rgba(85,178,201,0.12)] border-[1.5px] border-[#cae7ee] ${compact ? 'p-4' : 'p-6'}`}>
      <div className={`flex items-center gap-2 ${compact ? 'mb-4' : 'mb-6'}`}>
        <TrendingDown className="w-6 h-6 text-[#d44a4a]" />
        <h2 className={`${compact ? 'text-xl' : 'text-2xl'} font-bold`}>Tail Risk Playground (VaR + CVaR)</h2>
        <div className="group relative">
          <Info className="w-4 h-4 text-[#7a9fad] cursor-help" />
          <div className="invisible group-hover:visible absolute left-0 top-6 w-64 p-2 bg-[#0d1117] text-white text-xs rounded shadow-lg z-10">
            VaR shows loss threshold, while CVaR shows average loss in worst-tail scenarios.
          </div>
        </div>
      </div>

      <p className={`text-sm text-[#3a5260] ${compact ? 'mb-4' : 'mb-6'}`}>
        Use this section to estimate normal downside risk (VaR) and tail-event severity (CVaR).
      </p>

      {/* Configuration */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${compact ? 'gap-4 mb-4' : 'gap-6 mb-6'}`}>
        {/* Confidence Level */}
        <div>
          <label className="block text-sm font-medium text-[#3a5260] mb-2">
            Confidence Level
          </label>
          <div className="grid grid-cols-3 gap-2">
            {confidenceLevels.map((level) => (
              <button
                key={level.value}
                onClick={() => setConfidenceLevel(level.value)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  confidenceLevel === level.value
                    ? 'bg-[#6366f1] text-white'
                    : 'bg-[#f8fafc] text-[#3a5260] hover:bg-[#eef2ff]'
                }`}
              >
                {level.label}
              </button>
            ))}
          </div>
        </div>

        {/* Time Horizon */}
        <div>
          <label className="block text-sm font-medium text-[#3a5260] mb-2">
            Historical Data Period
          </label>
          <div className="grid grid-cols-2 gap-2">
            {timeHorizons.map((horizon) => (
              <button
                key={horizon.value}
                onClick={() => setTimeHorizon(horizon.value)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  timeHorizon === horizon.value
                    ? 'bg-[#6366f1] text-white'
                    : 'bg-[#f8fafc] text-[#3a5260] hover:bg-[#eef2ff]'
                }`}
              >
                {horizon.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calculate Button */}
      <div className={`flex justify-end ${compact ? 'mb-4' : 'mb-6'}`}>
        <button
          onClick={handleCalculate}
          disabled={loading}
          className="bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm font-medium py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Calculating...
            </>
          ) : (
            <>
              <BarChart3 className="w-4 h-4" />
              Calculate Tail Risk
            </>
          )}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-[rgba(212,74,74,0.12)] border border-red-200 rounded-lg">
          <p className="text-sm text-[#d44a4a]">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className={compact ? 'space-y-4' : 'space-y-6'}>
          {/* VaR Methods Comparison */}
          <div>
            <h3 className="font-semibold text-[#0d1117] mb-2">Loss Threshold (VaR)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Historical VaR */}
            <div className="bg-[rgba(212,74,74,0.12)] rounded-lg p-5 border border-red-200">
              <h3 className="text-sm font-semibold text-[#d44a4a] mb-2">Historical VaR</h3>
              <p className="text-3xl font-bold text-[#d44a4a] mb-2">
                ${result.var_methods.historical.var_amount.toLocaleString()}
              </p>
              <p className="text-sm text-[#d44a4a] mb-3">
                {result.var_methods.historical.var_percent.toFixed(2)}% of portfolio value
              </p>
              <p className="text-xs text-[#d44a4a]">
                {result.var_methods.historical.description}
              </p>
            </div>

            {/* Parametric VaR */}
            <div className="bg-[rgba(85,178,201,0.08)] rounded-lg p-5 border border-[#a8d8e4]">
              <h3 className="text-sm font-semibold text-[#3d96ad] mb-2">Parametric VaR</h3>
              <p className="text-3xl font-bold text-[#3d96ad] mb-2">
                ${result.var_methods.parametric.var_amount.toLocaleString()}
              </p>
              <p className="text-sm text-[#3d96ad] mb-3">
                {result.var_methods.parametric.var_percent.toFixed(2)}% of portfolio value
              </p>
              <p className="text-xs text-[#3d96ad]">
                {result.var_methods.parametric.description}
              </p>
            </div>
            </div>
          </div>

          {/* CVaR Methods Comparison */}
          <div>
            <h3 className="font-semibold text-[#0d1117] mb-3">Average Tail Loss (CVaR / Expected Shortfall)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-[rgba(212,74,74,0.08)] rounded-lg p-5 border border-red-200">
                <h4 className="text-sm font-semibold text-[#d44a4a] mb-2">Historical CVaR</h4>
                <p className="text-2xl font-bold text-[#d44a4a] mb-2">
                  ${result.cvar_methods.historical.var_amount.toLocaleString()}
                </p>
                <p className="text-sm text-[#d44a4a] mb-3">
                  {result.cvar_methods.historical.var_percent.toFixed(2)}% of portfolio value
                </p>
                <p className="text-xs text-[#d44a4a]">
                  {result.cvar_methods.historical.description}
                </p>
              </div>

              <div className="bg-[rgba(85,178,201,0.08)] rounded-lg p-5 border border-[#a8d8e4]">
                <h4 className="text-sm font-semibold text-[#3d96ad] mb-2">Parametric CVaR</h4>
                <p className="text-2xl font-bold text-[#3d96ad] mb-2">
                  ${result.cvar_methods.parametric.var_amount.toLocaleString()}
                </p>
                <p className="text-sm text-[#3d96ad] mb-3">
                  {result.cvar_methods.parametric.var_percent.toFixed(2)}% of portfolio value
                </p>
                <p className="text-xs text-[#3d96ad]">
                  {result.cvar_methods.parametric.description}
                </p>
              </div>
            </div>
          </div>

          {/* Portfolio Statistics */}
          <div className="bg-[#f7fbfc] rounded-lg p-5 border border-[#cae7ee]">
            <h3 className="font-semibold text-[#0d1117] mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#3d96ad]" />
              Portfolio Statistics
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-xs text-[#3a5260] mb-1">Portfolio Value</p>
                <p className="text-lg font-bold text-[#0d1117]">
                  ${result.portfolio_value.toLocaleString()}
                </p>
              </div>
              
              <div>
                <p className="text-xs text-[#3a5260] mb-1">Mean Daily Return</p>
                <p className={`text-lg font-bold ${
                  result.portfolio_statistics.mean_daily_return >= 0 ? 'text-[#1cb08a]' : 'text-[#d44a4a]'
                }`}>
                  {result.portfolio_statistics.mean_daily_return >= 0 ? '+' : ''}
                  {result.portfolio_statistics.mean_daily_return.toFixed(4)}%
                </p>
              </div>
              
              <div>
                <p className="text-xs text-[#3a5260] mb-1">Daily Volatility</p>
                <p className="text-lg font-bold text-[#d4860a]">
                  {result.portfolio_statistics.daily_volatility.toFixed(4)}%
                </p>
              </div>
              
              <div>
                <p className="text-xs text-[#3a5260] mb-1">Annual Volatility</p>
                <p className="text-lg font-bold text-[#d4860a]">
                  {result.portfolio_statistics.annualized_volatility.toFixed(2)}%
                </p>
              </div>
              
              <div>
                <p className="text-xs text-[#3a5260] mb-1">Data Points</p>
                <p className="text-lg font-bold text-[#0d1117]">
                  {result.data_points}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-[#cae7ee]">
              <div>
                <p className="text-xs text-[#3a5260] mb-1">Worst Day Return</p>
                <p className="text-lg font-bold text-[#d44a4a]">
                  {result.portfolio_statistics.worst_day_return.toFixed(2)}%
                </p>
              </div>
              
              <div>
                <p className="text-xs text-[#3a5260] mb-1">Best Day Return</p>
                <p className="text-lg font-bold text-[#1cb08a]">
                  +{result.portfolio_statistics.best_day_return.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>

          {/* Holdings Analysis */}
          <div className="bg-[rgba(85,178,201,0.12)] rounded-lg p-5 border border-[#a8d8e4]">
            <h3 className="font-semibold text-[#0d1117] mb-3">Holdings Analyzed</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {result.holdings_analyzed.map((holding) => (
                <div key={holding.ticker} className="bg-white rounded p-3 border border-[#a8d8e4]">
                  <p className="font-semibold text-[#0d1117]">{holding.ticker}</p>
                  <p className="text-xs text-[#3d96ad]">Weight: {holding.weight.toFixed(2)}%</p>
                  <p className="text-xs text-[#3a5260]">{holding.data_points} data points</p>
                </div>
              ))}
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-[rgba(212,134,10,0.12)] rounded-lg p-4 border border-[rgba(212,134,10,0.25)]">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-[#d4860a] flex-shrink-0 mt-0.5" />
              <div className="text-sm text-[#d4860a]">
                <p className="font-semibold mb-1">Understanding VaR</p>
                <p className="mb-2">
                  With {(result.confidence_level * 100).toFixed(0)}% confidence, your portfolio is unlikely to lose more than the VaR amount in a single day.
                </p>
                <p className="text-xs">
                  <strong>Historical VaR</strong> uses actual past returns (more conservative). 
                  <strong className="ml-2">Parametric VaR</strong> assumes normal distribution (may underestimate tail risk).
                  <strong className="ml-2">CVaR</strong> shows average loss beyond VaR in tail events.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
