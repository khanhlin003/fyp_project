import React from 'react';
import { TrendingUp, TrendingDown, Minus, ExternalLink, Calendar, Building2 } from 'lucide-react';

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

interface NewsCardProps {
  article: NewsArticle;
  onClick?: () => void;
}

const NewsCard: React.FC<NewsCardProps> = ({ article, onClick }) => {
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
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffHours < 48) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div 
      className="bg-white rounded-lg shadow-[0_1px_4px_rgba(85,178,201,0.06)] hover:shadow-[0_4px_16px_rgba(85,178,201,0.12)] transition-shadow border-[1.5px] border-[#cae7ee] overflow-hidden cursor-pointer"
      onClick={onClick}
    >
      {article.banner_image && (
        <div className="w-full h-48 overflow-hidden bg-[#f0f8fa]">
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
      
      <div className="p-4">
        {/* Sentiment Badge */}
        <div className="flex items-center gap-2 mb-3">
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getSentimentColor(article.overall_sentiment_label)}`}>
            {getSentimentIcon(article.overall_sentiment_score)}
            {article.overall_sentiment_label}
          </span>
          <span className="text-xs text-[#7a9fad]">
            {(article.overall_sentiment_score * 100).toFixed(0)}% sentiment
          </span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-[#0d1117] mb-2 line-clamp-2 hover:text-[#3d96ad] transition-colors">
          {article.title}
        </h3>

        {/* Summary */}
        <p className="text-sm text-[#3a5260] mb-3 line-clamp-3">
          {article.summary}
        </p>

        {/* Mentioned Tickers */}
        {article.tickers && article.tickers.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {article.tickers.slice(0, 5).map((ticker, idx) => (
              <span 
                key={idx}
                className="px-2 py-0.5 bg-[rgba(85,178,201,0.12)] text-[#3d96ad] text-xs font-mono rounded border border-[#a8d8e4]"
                title={`${ticker.ticker}: ${ticker.ticker_sentiment_label} (relevance: ${(ticker.relevance_score * 100).toFixed(0)}%)`}
              >
                {ticker.ticker}
              </span>
            ))}
            {article.tickers.length > 5 && (
              <span className="px-2 py-0.5 bg-[#f7fbfc] text-[#3a5260] text-xs rounded">
                +{article.tickers.length - 5} more
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-[#cae7ee]">
          <div className="flex items-center gap-2 text-xs text-[#7a9fad]">
            <Building2 className="w-3 h-3" />
            <span className="font-medium">{article.source}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-[#7a9fad]">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(article.time_published)}
            </div>
            <a 
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-[#3d96ad] hover:text-[#3d96ad] font-medium"
            >
              <ExternalLink className="w-3 h-3" />
              Source
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewsCard;
