'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();

  useEffect(() => {
    if (isLoading || !isAuthenticated) {
      return;
    }

    if (user?.risk_profile) {
      router.replace('/recommendations');
      return;
    }

    router.replace('/questionnaire');
  }, [isAuthenticated, isLoading, router, user?.risk_profile]);

  if (!isLoading && isAuthenticated) {
    return null;
  }

  return (
    <main className="min-h-screen -mt-14">
      {/* Hero Section */}
      <section className="min-h-screen bg-gradient-to-br from-zinc-950 via-indigo-950 to-violet-950 flex items-center justify-center relative overflow-hidden pt-14">
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3Cpattern id='grid' width='10' height='10' patternUnits='userSpaceOnUse'%3E%3Cpath d='M 10 0 L 0 0 0 10' fill='none' stroke='rgba(255,255,255,0.08)' stroke-width='0.5'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100' height='100' fill='url(%23grid)'/%3E%3C/svg%3E")`
        }} />
        {/* Ambient glow */}
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-indigo-500/15 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] bg-violet-500/10 rounded-full blur-[100px]" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            <div className="text-center lg:text-left">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
                AI-Powered ETF Advisor
              </h1>
              <p className="text-base sm:text-lg text-white/90 mb-8 leading-relaxed max-w-xl mx-auto lg:mx-0">
                Smarter, Simpler Investing for Everyone. Discover ETFs tailored to your goals. 
                Our AI combines quantitative finance and real-time insights to help you invest 
                confidently in Singapore and US markets.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link 
                  href="/questionnaire" 
                  className="bg-indigo-500 text-white px-8 py-3.5 rounded-xl font-medium text-sm hover:bg-indigo-400 transition-all hover:-translate-y-0.5 shadow-lg shadow-indigo-500/30 text-center"
                >
                  Get Started
                </Link>
                <Link 
                  href="#features" 
                  className="border border-white/20 text-white/90 px-8 py-3.5 rounded-xl font-medium text-sm hover:bg-white/10 hover:border-white/30 transition-all text-center backdrop-blur-sm"
                >
                  Learn More
                </Link>
              </div>
            </div>
            
            {/* Dashboard Preview Card */}
            <div className="hidden lg:flex justify-center">
              <div className="w-full max-w-lg bg-white/10 backdrop-blur-2xl rounded-2xl p-6 border border-white/15 shadow-2xl shadow-black/20">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-white font-semibold">Portfolio Dashboard</span>
                  <span className="text-white/70 text-sm">AI Insights</span>
                </div>
                <div className="bg-white/10 rounded-xl h-44 flex flex-col items-center justify-center mb-4">
                  <span className="text-4xl mb-2">📈</span>
                  <span className="text-white/70 text-center">Interactive Portfolio Charts<br/>
                    <small className="text-white/50">ETF Performance & Risk Analysis</small>
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white/10 rounded-lg p-3 text-center">
                    <div className="text-white font-semibold font-mono text-sm">12.4%</div>
                    <div className="text-white/70 text-xs">Annual Return</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3 text-center">
                    <div className="text-white font-semibold font-mono text-sm">0.89</div>
                    <div className="text-white/70 text-xs">Sharpe Ratio</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3 text-center">
                    <div className="text-white font-semibold font-mono text-sm">15.2%</div>
                    <div className="text-white/70 text-xs">Volatility</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 sm:py-28 bg-zinc-50/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl sm:text-2xl font-semibold text-zinc-900 mb-10 sm:mb-16 text-center">
            Key Features
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            <FeatureCard 
              emoji="🎯"
              title="Personalized ETF Recommendations"
              description="Get ETFs aligned with your risk tolerance and goals using quantitative and AI-based insights."
            />
            <FeatureCard 
              emoji="📈"
              title="Scenario Simulation & Risk Analysis"
              description="Visualize how your portfolio performs across market conditions with Monte Carlo simulations."
            />
            <FeatureCard 
              emoji="🔔"
              title="Real-Time Market & News Alerts"
              description="Stay informed as our AI scans news and macro events to flag key ETF movements and opportunities."
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 sm:py-28 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl sm:text-2xl font-semibold text-zinc-900 mb-10 sm:mb-16 text-center">
            How It Works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12">
            <Step number={1} title="Answer a few questions" description="Build your investor profile with our quick risk assessment questionnaire." />
            <Step number={2} title="Get personalized ETF picks" description="See recommendations with clear justifications based on your profile and market conditions." />
            <Step number={3} title="Stay updated" description="Receive insights, news alerts, and performance updates tailored to your portfolio." />
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-16 sm:py-20 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <h2 className="text-xl sm:text-2xl font-semibold text-white mb-3">
          Start your investing journey today
        </h2>
        <p className="text-sm sm:text-base text-white/90 mb-8">
          Get personalized ETF insights in minutes.
        </p>
        <Link 
          href="/questionnaire" 
          className="inline-block bg-white text-indigo-600 text-sm px-10 py-3.5 rounded-xl font-semibold hover:bg-indigo-50 transition-all hover:-translate-y-0.5 shadow-lg shadow-black/10"
        >
          Try It Free
        </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-zinc-900 text-zinc-400 py-12">
        <div className="max-w-7xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-4 sm:gap-8 mb-8">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="#" className="hover:text-white transition-colors">About</Link>
            <Link href="#" className="hover:text-white transition-colors">Contact</Link>
            <Link href="#" className="hover:text-white transition-colors">Terms</Link>
            <Link href="#" className="hover:text-white transition-colors">Privacy</Link>
          </div>
          <div className="border-t border-zinc-800 pt-8">
            <p className="text-sm">&copy; 2025 ETF Advisor. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({ emoji, title, description }: { emoji: string; title: string; description: string }) {
  return (
    <div className="bg-white p-8 rounded-2xl border border-zinc-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all flex flex-col items-center text-center">
      <span className="text-4xl mb-5">{emoji}</span>
      <h3 className="text-base font-semibold text-zinc-900 mb-3">{title}</h3>
      <p className="text-zinc-500 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function Step({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-2xl flex items-center justify-center text-xl font-bold mb-5">
        {number}
      </div>
      <h3 className="text-base font-semibold text-zinc-900 mb-2">{title}</h3>
      <p className="text-zinc-500 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
