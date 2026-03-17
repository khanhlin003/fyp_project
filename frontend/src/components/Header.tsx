'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { User, LogOut, ChevronDown, Briefcase, ClipboardList, Sparkles, Settings } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import NewsAlertBadge from '@/components/NewsAlertBadge';

export default function Header() {
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = (path: string) => pathname === path;

  return (
    <header className="fixed top-0 inset-x-0 bg-white/80 backdrop-blur-xl z-50 border-b border-zinc-200/60">
      <div className="max-w-7xl mx-auto flex justify-between items-center px-4 sm:px-6 lg:px-8 py-3">
        {/* Logo */}
        <Link href="/" className="text-xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
          <span className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white w-8 h-8 rounded-lg flex items-center justify-center text-sm">E</span>
          ETF Advisor
        </Link>

        {/* Navigation */}
        <nav className="hidden sm:flex items-center gap-1">
          <Link
            href="/"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive('/') 
                ? 'bg-indigo-50 text-indigo-600' 
                : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
            }`}
          >
            Home
          </Link>
          <Link
            href="/etfs"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname.startsWith('/etfs') 
                ? 'bg-indigo-50 text-indigo-600' 
                : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
            }`}
          >
            ETF Screener
          </Link>
        </nav>

        {/* User Menu */}
        <div className="flex items-center gap-3">
          {isLoading ? (
            <div className="w-8 h-8 rounded-full bg-zinc-200 animate-pulse" />
          ) : isAuthenticated && user ? (
            <>
              <NewsAlertBadge userId={user.id} />
              <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-100 transition-colors"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                  {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:block text-sm font-medium text-zinc-700 max-w-[100px] truncate">
                  {user.name || user.email.split('@')[0]}
                </span>
                <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg shadow-zinc-200/50 border border-zinc-200/80 py-2 z-50">
                  <div className="px-4 py-3 border-b border-zinc-100">
                    <p className="text-sm font-medium text-zinc-900">{user.name || 'User'}</p>
                    <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                    {user.risk_profile && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded-full capitalize">
                        {user.risk_profile}
                      </span>
                    )}
                  </div>
                  
                  <div className="py-1">
                    <Link
                      href="/portfolio"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <Briefcase className="w-4 h-4 text-zinc-400" />
                      Portfolio
                    </Link>
                    <Link
                      href="/questionnaire"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <ClipboardList className="w-4 h-4 text-zinc-400" />
                      Risk Quiz
                    </Link>
                    <Link
                      href="/recommendations"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <Sparkles className="w-4 h-4 text-zinc-400" />
                      Recommendations
                    </Link>
                  </div>

                  <hr className="my-1 border-zinc-100" />
                  
                  <button
                    onClick={() => {
                      logout();
                      setShowUserMenu(false);
                    }}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors w-full"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link 
                href="/login" 
                className="text-zinc-500 hover:text-zinc-900 text-sm font-medium px-4 py-2 rounded-lg hover:bg-zinc-50 transition-colors"
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg font-medium hover:bg-indigo-600 transition-colors shadow-sm shadow-indigo-500/25"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="sm:hidden border-t border-zinc-100">
        <div className="flex justify-center gap-1 px-4 py-2">
          <Link
            href="/"
            className={`flex-1 text-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive('/') 
                ? 'bg-indigo-50 text-indigo-600' 
                : 'text-zinc-500 hover:bg-zinc-50'
            }`}
          >
            Home
          </Link>
          <Link
            href="/etfs"
            className={`flex-1 text-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname.startsWith('/etfs') 
                ? 'bg-indigo-50 text-indigo-600' 
                : 'text-zinc-500 hover:bg-zinc-50'
            }`}
          >
            ETF Screener
          </Link>
        </div>
      </div>
    </header>
  );
}
