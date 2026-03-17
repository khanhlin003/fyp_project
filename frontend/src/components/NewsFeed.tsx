import React, { useState } from 'react';
import { Newspaper, RefreshCw, Filter, TrendingUp, TrendingDown } from 'lucide-react';
import NewsCard from '@/components/NewsCard';
import NewsModal from '@/components/NewsModal';

interface NewsTicker {
  ticker: string;
  ticker_sentiment_score: number;
  ticker_sentiment_label: string;
  relevance_score: number;
}

interface NewsArticle {
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

interface NewsFeedProps {
  articles: NewsArticle[];
  loading?: boolean;
  onRefresh?: () => void;
  title?: string;
  emptyMessage?: string;
  compact?: boolean;
}

const NewsFeed: React.FC<NewsFeedProps> = ({ 
  articles, 
  loading = false, 
  onRefresh,
  title = "Latest News",
  emptyMessage = "No news articles found",
  compact = false,
}) => {
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [sentimentFilter, setSentimentFilter] = useState<'all' | 'bullish' | 'bearish' | 'neutral'>('all');

  const filteredArticles = articles.filter(article => {
    if (sentimentFilter === 'all') return true;
    
    const label = article.overall_sentiment_label.toLowerCase();
    
    if (sentimentFilter === 'bullish') {
      return label.includes('bullish');
    }
    if (sentimentFilter === 'bearish') {
      return label.includes('bearish');
    }
    if (sentimentFilter === 'neutral') {
      return label === 'neutral';
    }
    
    return true;
  });

  const sentimentStats = {
    bullish: articles.filter(a => a.overall_sentiment_label.toLowerCase().includes('bullish')).length,
    bearish: articles.filter(a => a.overall_sentiment_label.toLowerCase().includes('bearish')).length,
    neutral: articles.filter(a => a.overall_sentiment_label.toLowerCase() === 'neutral').length,
  };

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-[#3d96ad]" />
          <h2 className={`${compact ? 'text-lg' : 'text-xl'} font-semibold text-[#0d1117]`}>{title}</h2>
          <span className="px-2 py-0.5 bg-[rgba(85,178,201,0.12)] text-[#3d96ad] text-xs font-medium rounded">
            {filteredArticles.length}
          </span>
        </div>
        
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-[#3a5260] bg-white border border-[#cae7ee] rounded-lg hover:bg-[#f7fbfc] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        )}
      </div>

      {/* Sentiment Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-[#7a9fad]" />
        <span className="text-sm text-[#3a5260] font-medium">Filter:</span>
        
        <button
          onClick={() => setSentimentFilter('all')}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
            sentimentFilter === 'all'
              ? 'bg-[#55b2c9] text-white'
              : 'bg-[#f0f8fa] text-[#3a5260] hover:bg-[#f0f8fa]'
          }`}
        >
          All ({articles.length})
        </button>
        
        <button
          onClick={() => setSentimentFilter('bullish')}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors flex items-center gap-1 ${
            sentimentFilter === 'bullish'
              ? 'bg-[#1cb08a] text-white'
              : 'bg-[rgba(28,176,138,0.12)] text-[#1cb08a] hover:bg-[rgba(28,176,138,0.18)]'
          }`}
        >
          <TrendingUp className="w-3 h-3" />
          Bullish ({sentimentStats.bullish})
        </button>
        
        <button
          onClick={() => setSentimentFilter('bearish')}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors flex items-center gap-1 ${
            sentimentFilter === 'bearish'
              ? 'bg-[#d44a4a] text-white'
              : 'bg-[rgba(212,74,74,0.12)] text-[#d44a4a] hover:bg-[rgba(212,74,74,0.18)]'
          }`}
        >
          <TrendingDown className="w-3 h-3" />
          Bearish ({sentimentStats.bearish})
        </button>
        
        <button
          onClick={() => setSentimentFilter('neutral')}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
            sentimentFilter === 'neutral'
              ? 'bg-[#7a9fad] text-white'
              : 'bg-[#f0f8fa] text-[#3a5260] hover:bg-[#f0f8fa]'
          }`}
        >
          Neutral ({sentimentStats.neutral})
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#55b2c9]"></div>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredArticles.length === 0 && (
        <div className="text-center py-12 bg-[#f7fbfc] rounded-lg border-2 border-dashed border-[#cae7ee]">
          <Newspaper className="w-12 h-12 text-[#7a9fad] mx-auto mb-3" />
          <p className="text-[#3a5260]">{emptyMessage}</p>
        </div>
      )}

      {/* News Grid */}
      {!loading && filteredArticles.length > 0 && (
        compact ? (
          <div className="border border-[#cae7ee] rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#f8fafc] text-[#64748b]">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Headline</th>
                  <th className="text-left font-medium px-3 py-2">Source</th>
                  <th className="text-left font-medium px-3 py-2">Sentiment</th>
                  <th className="text-left font-medium px-3 py-2">Published</th>
                </tr>
              </thead>
              <tbody>
                {filteredArticles.map((article) => (
                  <tr
                    key={article.id}
                    className="border-t border-[#cae7ee] hover:bg-[#f8fafc] cursor-pointer"
                    onClick={() => setSelectedArticle(article)}
                  >
                    <td className="px-3 py-2 text-[#0d1117] font-medium max-w-[360px] truncate">{article.title}</td>
                    <td className="px-3 py-2 text-[#3a5260]">{article.source}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        article.overall_sentiment_label.toLowerCase().includes('bullish')
                          ? 'bg-[rgba(28,176,138,0.12)] text-[#1cb08a]'
                          : article.overall_sentiment_label.toLowerCase().includes('bearish')
                          ? 'bg-[rgba(212,74,74,0.12)] text-[#d44a4a]'
                          : 'bg-[#f0f8fa] text-[#3a5260]'
                      }`}>
                        {article.overall_sentiment_label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[#64748b]">
                      {new Date(article.time_published).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredArticles.map((article) => (
              <NewsCard
                key={article.id}
                article={article}
                onClick={() => setSelectedArticle(article)}
              />
            ))}
          </div>
        )
      )}

      {/* News Modal */}
      {selectedArticle && (
        <NewsModal
          article={selectedArticle}
          onClose={() => setSelectedArticle(null)}
        />
      )}
    </div>
  );
};

export default NewsFeed;
