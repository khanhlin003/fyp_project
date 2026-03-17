'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getAvailableScenarios, getPortfolio, getPortfolioVar, getWallets, ScenarioOption } from '@/lib/api';
import ScenarioAnalysis from '@/components/ScenarioAnalysis';
import VarAnalysis from '@/components/VarAnalysis';
import { AlertCircle, Loader2, ShieldAlert } from 'lucide-react';

type AnalysisTargetType = 'portfolio' | 'wallet' | 'etf';

export default function ScenarioAndRiskPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [scenarios, setScenarios] = useState<ScenarioOption[]>([]);
  const [wallets, setWallets] = useState<Array<{ id: number; name: string }>>([]);
  const [tickers, setTickers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scenario' | 'var'>('scenario');

  useEffect(() => {
    const run = async () => {
      if (!isAuthenticated) return;

      try {
        setLoading(true);
        setError(null);
        const [scenarioData, walletData, portfolioData] = await Promise.all([
          getAvailableScenarios(),
          getWallets({ include_profile: false }),
          getPortfolio(),
        ]);
        setScenarios(scenarioData);
        setWallets(walletData.map((wallet) => ({ id: wallet.id, name: wallet.name })));
        setTickers(
          Array.from(new Set((portfolioData.holdings || []).map((holding) => holding.ticker))).sort((a, b) => a.localeCompare(b))
        );
      } catch (err) {
        console.error('Failed to load scenarios:', err);
        setError('Unable to load scenario options.');
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      run();
    }
  }, [authLoading, isAuthenticated]);

  if (!authLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white border border-[#cae7ee] rounded-xl p-6 text-center">
          <ShieldAlert className="w-9 h-9 text-[#d4860a] mx-auto mb-3" />
          <h1 className="text-xl font-semibold text-[#0d1117] mb-2">Sign in required</h1>
          <p className="text-sm text-[#3a5260] mb-4">Please sign in to run Scenario Analysis and VaR/CVaR.</p>
          <Link href="/login" className="inline-flex items-center px-4 py-2 rounded-lg bg-[#6366f1] text-white hover:bg-[#4f46e5]">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="mb-5">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0d1117]">Scenario Analysis and VaR/CVaR</h1>
          <p className="text-[#3a5260] mt-1">Stress test your portfolio and evaluate tail risk on a dedicated page.</p>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-[#3a5260] mb-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading scenario data...
          </div>
        )}

        {error && (
          <div className="bg-[#d44a4a12] border border-red-200 rounded-xl p-4 mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#d44a4a]" />
            <p className="text-sm text-[#d44a4a]">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-xl border border-[#cae7ee] p-2 sm:p-3 mb-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab('scenario')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'scenario' ? 'bg-[#6366f1] text-white' : 'text-[#3a5260] hover:bg-[#f0f8fa]'
              }`}
            >
              Scenario Analysis
            </button>
            <button
              onClick={() => setActiveTab('var')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'var' ? 'bg-[#6366f1] text-white' : 'text-[#3a5260] hover:bg-[#f0f8fa]'
              }`}
            >
              Tail Risk (VaR/CVaR)
            </button>
          </div>
        </div>

        {activeTab === 'scenario' && (
          <ScenarioAnalysis
            scenarios={scenarios}
            wallets={wallets}
            tickers={tickers}
            compact={false}
          />
        )}

        {activeTab === 'var' && (
          <VarAnalysis
            wallets={wallets}
            tickers={tickers}
            onCalculate={(confidenceLevel, timeHorizon, targetType: AnalysisTargetType, walletId?: number, ticker?: string) =>
              getPortfolioVar(confidenceLevel, timeHorizon, {
                target_type: targetType,
                wallet_id: walletId,
                ticker,
              })
            }
            compact={false}
          />
        )}
      </main>
    </div>
  );
}
