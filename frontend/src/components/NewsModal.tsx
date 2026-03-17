import React from 'react';
import { X, ExternalLink, Calendar, Building2, TrendingUp, TrendingDown, Minus } from 'lucide-react';

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

interface NewsModalProps {
  article: NewsArticle;
  onClose: () => void;
}

const NewsModal: React.FC<NewsModalProps> = ({ article, onClose }) => {
  const getSentimentColor = (label: string) => {
    switch (label.toLowerCase()) {
      case 'bullish':
        return 'bg-[rgba(28,176,138,0.12)] text-[#1cb08a] border-[rgba(28,176,138,0.2)]';
      case 'somewhat-bullish':
        return 'bg-[rgba(28,176,138,0.08)] text-[#1cb08a] border-[rgba(28,176,138,0.12)]';
      case 'bearish':
        return 'bg-[rgba(212,74,74,0.12)] text-[#d44a4a] border-[rgba(212,74,74,0.2)]';
      case 'somewhat-bearish':
        return 'bg-[rgba(212,74,74,0.08)] text-[#d44a4a] border-[rgba(212,74,74,0.12)]';
      default:
        return 'bg-[#f0f8fa] text-[#0d1117] border-[#cae7ee]';
    }
  };

  const getSentimentIcon = (score: number) => {
    if (score > 0.15) return <TrendingUp className="w-4 h-4" />;
    if (score < -0.15) return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Sort tickers by relevance
  const sortedTickers = [...article.tickers].sort((a, b) => b.relevance_score - a.relevance_score);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-[#cae7ee] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#3a5260]" />
            <span className="font-semibold text-[#0d1117]">{article.source}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[#f0f8fa] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-[#3a5260]" />
          </button>
        </div>

        {/* Banner Image */}
        {article.banner_image && (
          <div className="w-full h-64 overflow-hidden bg-[#f0f8fa]">
            <img 
              src={article.banner_image} 
              alt={article.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Title */}
          <h1 className="text-2xl font-bold text-[#0d1117] leading-tight">
            {article.title}
          </h1>

          {/* Metadata */}
          <div className="flex items-center gap-4 text-sm text-[#3a5260]">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {formatDate(article.time_published)}
            </div>
          </div>

          {/* Sentiment Badge */}
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${getSentimentColor(article.overall_sentiment_label)}`}>
              {getSentimentIcon(article.overall_sentiment_score)}
              {article.overall_sentiment_label}
            </span>
            <span className="text-sm text-[#3a5260]">
              Sentiment Score: <span className="font-semibold">{(article.overall_sentiment_score * 100).toFixed(1)}%</span>
            </span>
          </div>

          {/* Summary */}
          <div className="prose max-w-none">
            <p className="text-[#3a5260] leading-relaxed">
              {article.summary}
            </p>
          </div>

          {/* Mentioned Tickers */}
          {sortedTickers.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-[#0d1117]">Mentioned ETFs</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sortedTickers.map((ticker, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center justify-between p-3 bg-[#f7fbfc] rounded-lg border border-[#cae7ee]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-[#0d1117]">
                        {ticker.ticker}
                      </span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                        ticker.ticker_sentiment_label.toLowerCase().includes('bullish')
                          ? 'bg-[rgba(28,176,138,0.12)] text-[#1cb08a]'
                          : ticker.ticker_sentiment_label.toLowerCase().includes('bearish')
                          ? 'bg-[rgba(212,74,74,0.12)] text-[#d44a4a]'
                          : 'bg-[#f0f8fa] text-[#3a5260]'
                      }`}>
                        {ticker.ticker_sentiment_label}
                      </span>
                    </div>
                    <div className="text-xs text-[#7a9fad]">
                      <span className="font-medium">
                        {(ticker.relevance_score * 100).toFixed(0)}%
                      </span>
                      {' '}relevance
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Read Full Article Button */}
          <div className="pt-4 border-t border-[#cae7ee]">
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#55b2c9] text-white font-medium rounded-lg hover:bg-[#3d96ad] transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Read Full Article on {article.source}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewsModal;
