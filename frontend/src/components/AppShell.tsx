'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import axios from 'axios';
import {
  Search,
  ClipboardList,
  Sparkles,
  Wallet,
  Briefcase,
  BarChart3,
  User,
  LogOut,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import Header from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';

type NavItem = {
  label: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  comingSoon?: boolean;
};

interface PortfolioSummary {
  total_value: number;
  total_gain_loss_percent: number;
}

const AUTH_FREE_ROUTES = ['/login', '/signup'];
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const NAV_ITEMS: NavItem[] = [
  { label: 'ETF Screener', href: '/etfs', icon: Search },
  { label: 'Risk Quiz', href: '/questionnaire', icon: ClipboardList },
  { label: 'Recommendation', href: '/recommendations', icon: Sparkles },
  { label: 'Wallet Details', href: '/wallets', icon: Wallet },
  { label: 'My Portfolio', href: '/portfolio', icon: Briefcase },
  { label: 'Scenario Analysis', href: '/scenarios', icon: BarChart3 },
  { label: 'Profile & Settings', href: '/profile', icon: User },
];

function isActivePath(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { token, isAuthenticated, isLoading, logout } = useAuth();
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const isAuthFreePage = AUTH_FREE_ROUTES.includes(pathname);
  const showSidebar = !isAuthFreePage && isAuthenticated && !isLoading;

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  useEffect(() => {
    const fetchPortfolioSnapshot = async () => {
      if (!isAuthenticated || !token) {
        setPortfolioSummary(null);
        return;
      }

      try {
        setSummaryLoading(true);
        const { data } = await axios.get<PortfolioSummary>(`${API_BASE_URL}/portfolio`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setPortfolioSummary(data);
      } catch {
        setPortfolioSummary(null);
      } finally {
        setSummaryLoading(false);
      }
    };

    fetchPortfolioSnapshot();
  }, [isAuthenticated, token, pathname]);

  return (
    <>
      <Header />
      <div className={showSidebar ? 'pt-14 md:pl-64' : 'pt-14'}>
        {showSidebar && (
          <aside className="hidden md:flex fixed top-14 left-0 bottom-0 w-64 border-r border-zinc-200 bg-white z-40 flex-col">
            <div className="px-4 py-4 border-b border-zinc-100">
              <p className="text-xs uppercase tracking-wide text-zinc-500 font-semibold mb-2">Portfolio Value</p>
              {summaryLoading ? (
                <div className="inline-flex items-center gap-2 text-xs text-zinc-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Loading
                </div>
              ) : portfolioSummary ? (
                <>
                  <p className="text-lg font-semibold text-zinc-900">
                    ${portfolioSummary.total_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <div className={`mt-1 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                    portfolioSummary.total_gain_loss_percent >= 0
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-red-50 text-red-700'
                  }`}>
                    {portfolioSummary.total_gain_loss_percent >= 0 ? (
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5" />
                    )}
                    {portfolioSummary.total_gain_loss_percent >= 0 ? '+' : ''}
                    {portfolioSummary.total_gain_loss_percent.toFixed(2)}%
                  </div>
                </>
              ) : (
                <p className="text-xs text-zinc-500">No portfolio data</p>
              )}
            </div>

            <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = item.href ? isActivePath(pathname, item.href) : false;

                if (!item.href) {
                  return (
                    <div
                      key={item.label}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-zinc-400 bg-zinc-50"
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="w-4 h-4" />
                        {item.label}
                      </span>
                      {item.comingSoon && (
                        <span className="text-[10px] uppercase tracking-wide">Soon</span>
                      )}
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </span>
                    {item.label === 'Risk Quiz' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 uppercase tracking-wide">
                        Quiz
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="p-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </aside>
        )}

        <main>{children}</main>
      </div>
    </>
  );
}
