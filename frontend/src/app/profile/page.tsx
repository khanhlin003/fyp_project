'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, UserRound, Settings2 } from 'lucide-react';

type RiskProfile = 'conservative' | 'balanced' | 'aggressive';
type ThemePreference = 'system' | 'light' | 'dark';

type LocalSettings = {
  emailAlerts: boolean;
  weeklyDigest: boolean;
  theme: ThemePreference;
};

const SETTINGS_STORAGE_KEY = 'profileSettings';

const RISK_OPTIONS: Array<{ value: RiskProfile; label: string; description: string }> = [
  {
    value: 'conservative',
    label: 'Conservative',
    description: 'Focus on capital preservation and lower volatility.',
  },
  {
    value: 'balanced',
    label: 'Balanced',
    description: 'Blend growth and stability with moderate drawdowns.',
  },
  {
    value: 'aggressive',
    label: 'Aggressive',
    description: 'Prioritize long-term growth and accept larger swings.',
  },
];

const DEFAULT_SETTINGS: LocalSettings = {
  emailAlerts: true,
  weeklyDigest: true,
  theme: 'system',
};

export default function ProfileSettingsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, updateProfile } = useAuth();

  const [name, setName] = useState('');
  const [riskProfile, setRiskProfile] = useState<RiskProfile>('balanced');
  const [settings, setSettings] = useState<LocalSettings>(DEFAULT_SETTINGS);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!user) return;
    setName(user.name || '');
    const normalizedRisk = user.risk_profile?.toLowerCase();
    if (
      normalizedRisk === 'conservative' ||
      normalizedRisk === 'balanced' ||
      normalizedRisk === 'aggressive'
    ) {
      setRiskProfile(normalizedRisk);
    } else {
      setRiskProfile('balanced');
    }
  }, [user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setSettings({
        emailAlerts: Boolean(parsed.emailAlerts),
        weeklyDigest: Boolean(parsed.weeklyDigest),
        theme:
          parsed.theme === 'light' || parsed.theme === 'dark' || parsed.theme === 'system'
            ? parsed.theme
            : 'system',
      });
    } catch {
      setSettings(DEFAULT_SETTINGS);
    }
  }, []);

  const selectedRiskDescription = useMemo(
    () => RISK_OPTIONS.find((option) => option.value === riskProfile)?.description || '',
    [riskProfile]
  );

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setSavingProfile(true);
      setError(null);
      setProfileMessage(null);
      await updateProfile({
        name: name.trim() || undefined,
        risk_profile: riskProfile,
      });
      setProfileMessage('Profile updated successfully.');
    } catch {
      setError('Unable to save profile changes. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveSettings = () => {
    setSavingSettings(true);
    setSettingsMessage(null);
    setError(null);

    if (typeof window !== 'undefined') {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    }

    setSettingsMessage('Settings saved on this device.');
    setSavingSettings(false);
  };

  if (isLoading || !isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-[#f7fbfc] flex items-center justify-center">
        <div className="inline-flex items-center gap-2 text-[#3a5260]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading profile
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7fbfc]">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#0d1117]">Profile & Settings</h1>
          <p className="text-sm text-[#3a5260] mt-1">Manage your account details and app preferences.</p>
        </div>

        <div className="space-y-5">
          <section className="bg-white border border-[#d8ecf1] rounded-2xl p-5 shadow-[0_1px_4px_rgba(85,178,201,0.06)]">
            <div className="flex items-center gap-2 mb-4">
              <UserRound className="h-5 w-5 text-[#3d96ad]" />
              <h2 className="text-lg font-semibold text-[#0d1117]">Profile</h2>
            </div>

            <form className="space-y-4" onSubmit={handleProfileSubmit}>
              <div>
                <label className="block text-sm font-medium text-[#3a5260] mb-1" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full rounded-lg border border-[#d8ecf1] bg-[#f7fbfc] px-3 py-2 text-sm text-[#7a9fad]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#3a5260] mb-1" htmlFor="name">
                  Display Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Enter your name"
                  className="w-full rounded-lg border border-[#d8ecf1] px-3 py-2 text-sm text-[#0d1117] focus:outline-none focus:ring-2 focus:ring-[#55b2c9]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#3a5260] mb-1" htmlFor="risk_profile">
                  Risk Profile
                </label>
                <select
                  id="risk_profile"
                  value={riskProfile}
                  onChange={(event) => setRiskProfile(event.target.value as RiskProfile)}
                  className="w-full rounded-lg border border-[#d8ecf1] px-3 py-2 text-sm text-[#0d1117] bg-white focus:outline-none focus:ring-2 focus:ring-[#55b2c9]"
                >
                  {RISK_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-[#7a9fad]">{selectedRiskDescription}</p>
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="mt-2 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#5b4ff7] to-[#7c3aed] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(91,79,247,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(91,79,247,0.45)] focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </button>
            </form>
          </section>

          <section className="bg-white border border-[#d8ecf1] rounded-2xl p-5 shadow-[0_1px_4px_rgba(85,178,201,0.06)]">
            <div className="flex items-center gap-2 mb-4">
              <Settings2 className="h-5 w-5 text-[#3d96ad]" />
              <h2 className="text-lg font-semibold text-[#0d1117]">Settings</h2>
            </div>

            <div className="space-y-3">
              <label className="flex items-center justify-between rounded-lg border border-[#d8ecf1] px-3 py-2">
                <span>
                  <span className="block text-sm font-medium text-[#0d1117]">Email Alerts</span>
                  <span className="block text-xs text-[#7a9fad]">Receive alerts for major portfolio-related news.</span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.emailAlerts}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      emailAlerts: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 accent-[#4f46e5]"
                />
              </label>

              <label className="flex items-center justify-between rounded-lg border border-[#d8ecf1] px-3 py-2">
                <span>
                  <span className="block text-sm font-medium text-[#0d1117]">Weekly Digest</span>
                  <span className="block text-xs text-[#7a9fad]">Get a summary of insights and ETF performance every week.</span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.weeklyDigest}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      weeklyDigest: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 accent-[#4f46e5]"
                />
              </label>

              <div>
                <label className="block text-sm font-medium text-[#3a5260] mb-1" htmlFor="theme">
                  Theme Preference
                </label>
                <select
                  id="theme"
                  value={settings.theme}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      theme: event.target.value as ThemePreference,
                    }))
                  }
                  className="w-full rounded-lg border border-[#d8ecf1] px-3 py-2 text-sm text-[#0d1117] bg-white focus:outline-none focus:ring-2 focus:ring-[#55b2c9]"
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="mt-2 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#5b4ff7] to-[#7c3aed] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(91,79,247,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(91,79,247,0.45)] focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </button>
            </div>
          </section>

          {(profileMessage || settingsMessage || error) && (
            <div className="rounded-lg border border-[#d8ecf1] bg-white px-4 py-3 text-sm">
              {profileMessage && <p className="text-[#1e7d32]">{profileMessage}</p>}
              {settingsMessage && <p className="text-[#1e7d32]">{settingsMessage}</p>}
              {error && <p className="text-[#b42318]">{error}</p>}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
