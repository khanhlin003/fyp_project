import React, { useEffect, useState } from 'react';
import { Bell, AlertTriangle } from 'lucide-react';
import { getNewsAlerts } from '@/lib/api';

interface NewsAlert {
  article: {
    id: number;
    title: string;
    url: string;
    overall_sentiment_score: number;
  };
  affected_tickers: string[];
  alert_reason: string;
}

interface NewsAlertBadgeProps {
  userId: number;
  className?: string;
}

const NewsAlertBadge: React.FC<NewsAlertBadgeProps> = ({ userId, className = '' }) => {
  const [alerts, setAlerts] = useState<NewsAlert[]>([]);
  const [showPopup, setShowPopup] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAlerts();
    // Refresh every 5 minutes
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [userId]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const data = await getNewsAlerts(userId, 3, -0.3, 0.5);
      setAlerts(data);
    } catch (error) {
      console.error('Failed to fetch news alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const alertCount = alerts.length;
  const hasAlerts = alertCount > 0;

  return (
    <div className={`relative ${className}`}>
      {/* Bell Icon with Badge */}
      <button
        onClick={() => setShowPopup(!showPopup)}
        className="relative p-2 hover:bg-[#f0f8fa] rounded-lg transition-colors"
        title="News Alerts"
      >
        <Bell className={`w-5 h-5 ${hasAlerts ? 'text-[#d44a4a]' : 'text-[#3a5260]'}`} />
        
        {hasAlerts && (
          <span className="absolute top-1 right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-white text-[10px] font-bold items-center justify-center">
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          </span>
        )}
      </button>

      {/* Popup */}
      {showPopup && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowPopup(false)}
          />
          
          {/* Popup Content */}
          <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-lg shadow-xl border border-[#cae7ee] z-50">
            {/* Header */}
            <div className="px-4 py-3 border-b border-[#cae7ee] bg-[rgba(212,74,74,0.08)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-[#d44a4a]" />
                  <h3 className="font-semibold text-[#0d1117]">
                    News Alerts
                  </h3>
                </div>
                {alertCount > 0 && (
                  <span className="px-2 py-0.5 bg-[rgba(212,74,74,0.12)] text-[#d44a4a] text-xs font-bold rounded-full">
                    {alertCount}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#3a5260] mt-1">
                High-impact negative news for your portfolio
              </p>
            </div>

            {/* Alert List */}
            <div className="divide-y divide-[#cae7ee]">
              {loading ? (
                <div className="p-4 text-center text-[#7a9fad] text-sm">
                  Loading alerts...
                </div>
              ) : alertCount === 0 ? (
                <div className="p-6 text-center">
                  <Bell className="w-12 h-12 text-[#cae7ee] mx-auto mb-2" />
                  <p className="text-sm text-[#3a5260]">No alerts at the moment</p>
                  <p className="text-xs text-[#7a9fad] mt-1">
                    We'll notify you of significant negative news
                  </p>
                </div>
              ) : (
                alerts.map((alert, idx) => (
                  <a
                    key={idx}
                    href={alert.article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 hover:bg-red-50 transition-colors"
                  >
                    {/* Tickers */}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {alert.affected_tickers.map((ticker, tidx) => (
                        <span 
                          key={tidx}
                          className="px-2 py-0.5 bg-[rgba(212,74,74,0.12)] text-[#d44a4a] text-xs font-mono rounded"
                        >
                          {ticker}
                        </span>
                      ))}
                    </div>

                    {/* Title */}
                    <p className="text-sm font-medium text-[#0d1117] line-clamp-2 mb-1">
                      {alert.article.title}
                    </p>

                    {/* Reason */}
                    <p className="text-xs text-[#3a5260] line-clamp-1">
                      {alert.alert_reason}
                    </p>

                    {/* Sentiment Score */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 bg-[#f0f8fa] rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-red-500 h-full"
                          style={{ 
                            width: `${Math.abs(alert.article.overall_sentiment_score) * 100}%` 
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium text-[#d44a4a]">
                        {(alert.article.overall_sentiment_score * 100).toFixed(0)}%
                      </span>
                    </div>
                  </a>
                ))
              )}
            </div>

            {/* Footer */}
            {alertCount > 0 && (
              <div className="px-4 py-2 bg-[#f7fbfc] border-t border-[#cae7ee]">
                <button
                  onClick={fetchAlerts}
                  disabled={loading}
                  className="text-xs text-[#3d96ad] hover:text-[#3d96ad] font-medium disabled:opacity-50"
                >
                  Refresh alerts
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default NewsAlertBadge;
