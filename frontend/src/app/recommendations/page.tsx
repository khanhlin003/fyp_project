'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  getRecommendations, 
  RecommendedETF, 
  RecommendationResponse 
} from '@/lib/api';
import { 
  TrendingUp, Shield, Target, Zap,
  Loader2, AlertCircle, ChevronRight, Star, Info, RefreshCw,
  DollarSign, Percent, BarChart3
} from 'lucide-react';

type RiskProfile = 'conservative' | 'balanced' | 'aggressive';

type QuizIntent = {
  timeline: string;
  objective: string;
  riskComfort: string;
  cashNeed: string;
};

const profileConfig: Record<RiskProfile, {
  label: string;
  icon: React.ReactNode;
  color: string;
  bgGradient: string;
  borderColor: string;
  description: string;
}> = {
  conservative: {
    label: 'Conservative',
    icon: <Shield className="w-6 h-6" />,
    color: 'text-[#3d96ad]',
    bgGradient: 'from-[#55b2c9] to-[#3d96ad]',
    borderColor: 'border-[#a8d8e4] hover:border-[#55b2c9]',
    description: 'Low-risk investments focused on capital preservation and stable income'
  },
  balanced: {
    label: 'Balanced',
    icon: <Target className="w-6 h-6" />,
    color: 'text-purple-600',
    bgGradient: 'from-purple-500 to-purple-600',
    borderColor: 'border-purple-200 hover:border-purple-400',
    description: 'Mix of growth and stability with moderate risk tolerance'
  },
  aggressive: {
    label: 'Aggressive',
    icon: <Zap className="w-6 h-6" />,
    color: 'text-orange-600',
    bgGradient: 'from-orange-500 to-orange-600',
    borderColor: 'border-orange-200 hover:border-orange-400',
    description: 'High-growth potential with higher risk tolerance'
  }
};

export default function RecommendationsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f7fbfc] flex items-center justify-center"><div className="text-[#3a5260]">Loading...</div></div>}>
      <RecommendationsContent />
    </Suspense>
  );
}

function RecommendationsContent() {
  const searchParams = useSearchParams();
  const initialProfile = (searchParams.get('profile') as RiskProfile) || null;
  
  const [selectedProfile, setSelectedProfile] = useState<RiskProfile | null>(initialProfile);
  const [recommendations, setRecommendations] = useState<RecommendationResponse | null>(null);
  const [quizIntent, setQuizIntent] = useState<QuizIntent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildQuizIntent = (result: any): QuizIntent | null => {
    if (!result?.breakdown || !Array.isArray(result.breakdown)) return null;

    const pick = (qId: number) => result.breakdown.find((item: any) => item.question_id === qId)?.selected_option;
    const timelineMap: Record<string, string> = {
      A: 'Need in < 3 months',
      B: 'Need in 3-12 months',
      C: 'Need in 1-3 years',
      D: 'Can keep for > 3 years',
    };
    const objectiveMap: Record<string, string> = {
      A: 'Capital preservation',
      B: 'Beat savings with low risk',
      C: 'Balanced growth',
      D: 'Maximum growth',
    };
    const riskMap: Record<string, string> = {
      A: 'Very low drawdown tolerance',
      B: 'Low drawdown tolerance',
      C: 'Medium drawdown tolerance',
      D: 'High drawdown tolerance',
    };
    const cashNeedMap: Record<string, string> = {
      A: 'Critical cash',
      B: 'Important but not urgent',
      C: 'Dedicated investment capital',
      D: 'Long-term growth capital',
    };

    return {
      timeline: timelineMap[pick(1) || ''] || 'Not specified',
      objective: objectiveMap[pick(2) || ''] || 'Not specified',
      riskComfort: riskMap[pick(4) || ''] || 'Not specified',
      cashNeed: cashNeedMap[pick(6) || ''] || 'Not specified',
    };
  };

  const fetchRecommendations = async (profile: RiskProfile) => {
    try {
      setLoading(true);
      setError(null);
      const data = await getRecommendations(profile, 5);
      setRecommendations(data);
    } catch (err) {
      setError('Failed to load recommendations. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    try {
      const savedResult = localStorage.getItem('latestQuizResult');
      if (!savedResult) return;
      const parsed = JSON.parse(savedResult);
      const intent = buildQuizIntent(parsed);
      setQuizIntent(intent);

      if (!initialProfile && parsed?.risk_profile) {
        const lower = String(parsed.risk_profile).toLowerCase();
        if (lower === 'conservative' || lower === 'balanced' || lower === 'aggressive') {
          setSelectedProfile(lower);
        }
      }
    } catch (storageError) {
      console.error('Failed to hydrate quiz intent for recommendations:', storageError);
    }
  }, [initialProfile]);

  useEffect(() => {
    if (selectedProfile) {
      fetchRecommendations(selectedProfile);
    }
  }, [selectedProfile]);

  const handleProfileSelect = (profile: RiskProfile) => {
    setSelectedProfile(profile);
    // Update URL without navigation
    window.history.pushState({}, '', `/recommendations?profile=${profile}`);
  };

  return (
    <div className="min-h-screen bg-[#f7fbfc]">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-[#0d1117]">Personalized Recommendations</h1>
          <p className="text-sm text-[#3a5260] mt-1.5">
            Top 5 ETFs selected by your quiz profile, objective, and risk fit
          </p>
        </div>

        {quizIntent && (
          <div className="mb-5 bg-white rounded-xl shadow-[0_1px_4px_rgba(85,178,201,0.06)] border-[1.5px] border-[#cae7ee] p-4">
            <h2 className="text-sm font-semibold text-[#0d1117] mb-2">Your Intent Snapshot</h2>
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-1 bg-[rgba(85,178,201,0.12)] text-[#3d96ad] rounded text-xs">Timeline: {quizIntent.timeline}</span>
              <span className="px-2 py-1 bg-[#1cb08a12] text-[#1cb08a] rounded text-xs">Goal: {quizIntent.objective}</span>
              <span className="px-2 py-1 bg-[#f0f8fa] text-[#3a5260] rounded text-xs">Risk: {quizIntent.riskComfort}</span>
              <span className="px-2 py-1 bg-[#fff5e8] text-[#b5762d] rounded text-xs">Cash Need: {quizIntent.cashNeed}</span>
            </div>
          </div>
        )}

        {/* Profile Selection */}
        <div className="mb-5">
          <h2 className="text-base font-semibold text-[#0d1117] mb-3">Select Your Risk Profile</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(Object.keys(profileConfig) as RiskProfile[]).map((profile) => {
              const config = profileConfig[profile];
              const isSelected = selectedProfile === profile;
              
              return (
                <button
                  key={profile}
                  onClick={() => handleProfileSelect(profile)}
                  className={`
                    relative p-4 rounded-xl border-2 text-left transition-all duration-200
                    ${isSelected 
                      ? `bg-gradient-to-br ${config.bgGradient} text-white border-transparent shadow-lg scale-[1.02]` 
                      : `bg-white ${config.borderColor} hover:shadow-md`
                    }
                  `}
                >
                  <div className={`mb-2 ${isSelected ? 'text-white' : config.color}`}>
                    {config.icon}
                  </div>
                  <h3 className={`text-base font-semibold mb-1.5 ${isSelected ? 'text-white' : 'text-[#0d1117]'}`}>
                    {config.label}
                  </h3>
                  <p className={`text-xs leading-5 ${isSelected ? 'text-white/80' : 'text-[#7a9fad]'}`}>
                    {config.description}
                  </p>
                  {isSelected && (
                    <div className="absolute top-3 right-3">
                      <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                        <Star className="w-3 h-3 text-white fill-white" />
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          
          {/* Link to quiz */}
          <div className="mt-3 p-3 bg-[rgba(85,178,201,0.12)] rounded-lg flex items-start space-x-2.5">
            <Info className="w-4 h-4 text-[#3d96ad] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs leading-5 text-[#0d1117]">
                Not sure which profile fits you?{' '}
                <Link href="/questionnaire" className="font-medium underline hover:no-underline">
                  Take our risk assessment quiz
                </Link>{' '}
                to find out.
              </p>
            </div>
          </div>
        </div>

        {/* Results Section */}
        {!selectedProfile ? (
          <div className="bg-white rounded-xl shadow-[0_1px_4px_rgba(85,178,201,0.06)] border-[1.5px] border-[#cae7ee] p-8 text-center">
            <div className="w-12 h-12 bg-[#f0f8fa] rounded-full flex items-center justify-center mx-auto mb-3">
              <Target className="w-6 h-6 text-[#7a9fad]" />
            </div>
            <h3 className="text-lg font-semibold text-[#0d1117] mb-1.5">Select a Risk Profile</h3>
            <p className="text-sm text-[#7a9fad] max-w-md mx-auto">
              Choose your risk tolerance above to see personalized ETF recommendations
            </p>
          </div>
        ) : loading ? (
          <div className="bg-white rounded-xl shadow-[0_1px_4px_rgba(85,178,201,0.06)] border-[1.5px] border-[#cae7ee] p-8 text-center">
            <Loader2 className="w-10 h-10 text-[#55b2c9] animate-spin mx-auto mb-3" />
            <p className="text-sm text-[#3a5260]">Finding the best ETFs for you...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl shadow-[0_1px_4px_rgba(85,178,201,0.06)] border-[1.5px] border-[#cae7ee] p-8 text-center">
            <div className="w-12 h-12 bg-[#d44a4a12] rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6 text-[#d44a4a]" />
            </div>
            <h3 className="text-lg font-semibold text-[#0d1117] mb-1.5">Something went wrong</h3>
            <p className="text-sm text-[#7a9fad] mb-3">{error}</p>
            <button 
              onClick={() => fetchRecommendations(selectedProfile)}
              className="inline-flex items-center px-3.5 py-2 text-sm bg-[#55b2c9] text-white rounded-lg hover:bg-[#3d96ad] transition-colors"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </button>
          </div>
        ) : recommendations ? (
          <div className="space-y-4">
            {/* Results Header */}
            <div className="bg-white rounded-xl shadow-[0_1px_4px_rgba(85,178,201,0.06)] border-[1.5px] border-[#cae7ee] p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <span className={profileConfig[selectedProfile].color}>
                      {profileConfig[selectedProfile].icon}
                    </span>
                    <h2 className="text-lg font-bold text-[#0d1117]">
                      {profileConfig[selectedProfile].label} Portfolio
                    </h2>
                  </div>
                  <p className="text-sm text-[#3a5260]">{recommendations.profile_description}</p>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="text-center px-3 py-1.5 bg-[#f0f8fa] rounded-lg">
                    <p className="text-xl font-bold text-[#0d1117]">{recommendations.total_matches}</p>
                    <p className="text-xs text-[#7a9fad]">Matching ETFs</p>
                  </div>
                  <div className="text-center px-3 py-1.5 bg-[#f0f8fa] rounded-lg">
                    <p className="text-xl font-bold text-[#0d1117]">{recommendations.recommendations.length}</p>
                    <p className="text-xs text-[#7a9fad]">Top 5 Picks</p>
                  </div>
                </div>
              </div>
              
              {/* Filter Criteria */}
              <div className="mt-3 pt-3 border-t border-[#cae7ee]">
                <p className="text-xs text-[#7a9fad] mb-2">Selection Criteria</p>
                <div className="flex flex-wrap gap-2">
                  {recommendations.filter_criteria.beta_range && (
                    <span className="px-2 py-1 bg-[rgba(85,178,201,0.12)] text-[#3d96ad] rounded text-xs">
                      Beta: {recommendations.filter_criteria.beta_range}
                    </span>
                  )}
                  {recommendations.filter_criteria.preferred_categories?.slice(0, 3).map((cat, idx) => (
                    <span key={idx} className="px-2 py-1 bg-[#1cb08a12] text-[#1cb08a] rounded text-xs">
                      {cat}
                    </span>
                  ))}
                  {recommendations.filter_criteria.avoid_categories?.slice(0, 2).map((cat, idx) => (
                    <span key={idx} className="px-2 py-1 bg-[#d44a4a12] text-[#d44a4a] rounded text-xs">
                      Avoid: {cat}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Recommendation Cards */}
            <div className="space-y-3">
              {recommendations.recommendations.map((etf, index) => (
                <RecommendationCard key={etf.ticker} etf={etf} rank={index + 1} quizIntent={quizIntent} />
              ))}
            </div>

            {/* CTA */}
            <div className="bg-[#0d1117] rounded-xl p-4 text-white">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold mb-1">Want to explore more?</h3>
                  <p className="text-[#cae7ee] text-xs sm:text-sm">
                    We curated the strongest 5 matches first. You can still browse all {recommendations.total_matches} matching ETFs.
                  </p>
                </div>
                <div className="flex space-x-3">
                  <Link 
                    href="/etfs"
                    className="px-3.5 py-2 text-sm bg-white text-[#0d1117] rounded-lg font-medium hover:bg-[#f0f8fa] transition-colors"
                  >
                    Browse All ETFs
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

// Recommendation Card Component
function RecommendationCard({ etf, rank, quizIntent }: { etf: RecommendedETF; rank: number; quizIntent: QuizIntent | null }) {
  const formatReturn = (value: string | null) => {
    if (!value) return 'N/A';
    const num = parseFloat(value.replace('%', ''));
    if (isNaN(num)) return value;
    return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
  };

  const getReturnColor = (value: string | null) => {
    if (!value) return 'text-[#7a9fad]';
    const num = parseFloat(value.replace('%', ''));
    if (isNaN(num)) return 'text-[#7a9fad]';
    return num >= 0 ? 'text-[#1cb08a]' : 'text-[#d44a4a]';
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    if (rank === 2) return 'bg-[#f0f8fa] text-[#3a5260] border-[#cae7ee]';
    if (rank === 3) return 'bg-orange-100 text-orange-700 border-orange-200';
    return 'bg-[#f0f8fa] text-[#7a9fad] border-[#cae7ee]';
  };

  const reasonPoints = etf.recommendation_reason
    .split(';')
    .map((r) => r.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (quizIntent?.objective === 'Beat savings with low risk') {
    reasonPoints.unshift('Aligned with your low-risk objective to outperform savings');
  }

  if (quizIntent?.timeline === 'Need in < 3 months' || quizIntent?.timeline === 'Need in 3-12 months') {
    reasonPoints.push('Review short-term downside risk before allocating near-term cash');
  }

  return (
    <Link href={`/etfs/${etf.ticker}`}>
      <div className="bg-white rounded-xl shadow-[0_1px_4px_rgba(85,178,201,0.06)] p-4 hover:shadow-[0_4px_16px_rgba(85,178,201,0.12)] transition-all duration-200 border-[1.5px] border-[#cae7ee] hover:border-[#55b2c9] group cursor-pointer">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Rank & Basic Info */}
          <div className="flex items-start space-x-3 flex-1">
            <div className={`w-8 h-8 rounded-md flex items-center justify-center border ${getRankBadge(rank)} flex-shrink-0`}>
              <span className="text-xs font-bold">#{rank}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-[#0d1117] group-hover:text-[#3d96ad] transition-colors">
                  {etf.ticker}
                </h3>
                <span className="text-xs text-[#7a9fad]">•</span>
                <span className="text-xs sm:text-sm text-[#7a9fad] truncate">{etf.etf_name}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                {etf.category && (
                  <span className="px-2 py-0.5 bg-[rgba(85,178,201,0.12)] text-[#3d96ad] rounded text-xs">
                    {etf.category}
                  </span>
                )}
                {etf.asset_class && (
                  <span className="px-2 py-0.5 bg-[#f0f8fa] text-[#3a5260] rounded text-xs">
                    {etf.asset_class}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-4 gap-2 lg:gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center text-[#7a9fad] mb-0.5">
                <TrendingUp className="w-3 h-3 mr-0.5" />
                <span className="text-[11px]">YTD</span>
              </div>
              <p className={`text-sm font-semibold ${getReturnColor(etf.ytd_return)}`}>
                {formatReturn(etf.ytd_return)}
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center text-[#7a9fad] mb-0.5">
                <BarChart3 className="w-3 h-3 mr-0.5" />
                <span className="text-[11px]">Beta</span>
              </div>
              <p className="text-sm font-semibold text-[#0d1117]">
                {etf.beta || 'N/A'}
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center text-[#7a9fad] mb-0.5">
                <Percent className="w-3 h-3 mr-0.5" />
                <span className="text-[11px]">Expense</span>
              </div>
              <p className="text-sm font-semibold text-[#0d1117]">
                {etf.expense_ratio || 'N/A'}
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center text-[#7a9fad] mb-0.5">
                <DollarSign className="w-3 h-3 mr-0.5" />
                <span className="text-[11px]">Yield</span>
              </div>
              <p className="text-sm font-semibold text-[#0d1117]">
                {etf.annual_dividend_yield || 'N/A'}
              </p>
            </div>
          </div>

          {/* Score & Arrow */}
          <div className="flex items-center space-x-3 lg:border-l lg:pl-4 lg:border-[#cae7ee]">
            <div className="text-center">
              <div className="text-[11px] text-[#7a9fad] mb-0.5">Score</div>
              <div className="flex items-center space-x-0.5">
                <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                <span className="text-sm font-bold text-[#0d1117]">{etf.recommendation_score.toFixed(1)}</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#7a9fad] group-hover:text-[#3d96ad] group-hover:translate-x-1 transition-all" />
          </div>
        </div>

        {/* Recommendation Reason */}
        <div className="mt-3 pt-3 border-t border-[#cae7ee]">
          <p className="text-xs sm:text-sm text-[#3a5260] mb-2">
            <span className="font-medium text-[#3a5260]">Why this ETF fits you</span>
          </p>
          <ul className="space-y-1">
            {reasonPoints.slice(0, 3).map((point, idx) => (
              <li key={idx} className="text-xs sm:text-sm text-[#3a5260]">• {point}</li>
            ))}
          </ul>
        </div>
      </div>
    </Link>
  );
}
