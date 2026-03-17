'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import {
  createWallet,
  deactivateWallet,
  getWalletHoldings,
  getWallets,
  InvestmentWallet,
  updateWallet,
  updateWalletProfile,
  WalletHoldingItem,
  WalletProfile,
} from '@/lib/api';
import { Loader2, AlertCircle, Wallet, Plus, Pencil, Trash2, X } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type WalletEditorState = {
  name: string;
  purpose: string;
  risk_profile: string;
  horizon_months: string;
  objective: string;
  liquidity_need: string;
  max_drawdown_pct: string;
};

type PortfolioHolding = {
  id: number;
  ticker: string;
  wallet_id?: number | null;
  wallet_name?: string | null;
  quantity: number;
  purchase_price: number;
  purchase_date: string;
  current_price: number | null;
};

type AddHoldingForm = {
  ticker: string;
  quantity: string;
  purchase_price: string;
  purchase_date: string;
};

export default function WalletDetailsPage() {
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();
  const [wallets, setWallets] = useState<InvestmentWallet[]>([]);
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingWalletId, setSavingWalletId] = useState<number | null>(null);
  const [editors, setEditors] = useState<Record<number, WalletEditorState>>({});
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [showCreateWalletModal, setShowCreateWalletModal] = useState(false);
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletPurpose, setNewWalletPurpose] = useState('custom');
  const [creatingWallet, setCreatingWallet] = useState(false);

  const [activeAddHoldingWalletId, setActiveAddHoldingWalletId] = useState<number | null>(null);
  const [activeEditHolding, setActiveEditHolding] = useState<PortfolioHolding | null>(null);
  const [activeEditWalletId, setActiveEditWalletId] = useState<number | null>(null);
  const [holdingBusy, setHoldingBusy] = useState(false);
  const [localWalletMap, setLocalWalletMap] = useState<Record<string, { wallet_id: number; wallet_name: string }>>({});
  const [addHoldingForm, setAddHoldingForm] = useState<AddHoldingForm>({
    ticker: '',
    quantity: '',
    purchase_price: '',
    purchase_date: '',
  });
  const [editHoldingForm, setEditHoldingForm] = useState<AddHoldingForm>({
    ticker: '',
    quantity: '',
    purchase_price: '',
    purchase_date: '',
  });

  const toEditorState = (wallet: InvestmentWallet): WalletEditorState => ({
    name: wallet.name,
    purpose: wallet.purpose,
    risk_profile: wallet.profile?.risk_profile || 'balanced',
    horizon_months: wallet.profile?.horizon_months ? String(wallet.profile.horizon_months) : '',
    objective: wallet.profile?.objective || 'balanced_growth',
    liquidity_need: wallet.profile?.liquidity_need || 'medium',
    max_drawdown_pct:
      wallet.profile?.max_drawdown_pct !== null && wallet.profile?.max_drawdown_pct !== undefined
        ? String(wallet.profile.max_drawdown_pct)
        : '',
  });

  const formatChoice = (value: string | null | undefined) => {
    if (!value) return '-';
    return value
      .replaceAll('_', ' ')
      .split(' ')
      .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
      .join(' ');
  };

  const persistLocalWalletMap = (next: Record<string, { wallet_id: number; wallet_name: string }>) => {
    setLocalWalletMap(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('walletAssignments', JSON.stringify(next));
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('walletAssignments');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          setLocalWalletMap(parsed);
        }
      }
    } catch {
      // Ignore corrupted local cache.
    }
  }, []);

  const loadWalletData = async (assignmentOverride?: Record<string, { wallet_id: number; wallet_name: string }>) => {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);

      const [walletData, portfolioRes] = await Promise.all([
        getWallets({ include_profile: true }),
        axios.get(`${API_BASE_URL}/portfolio`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setWallets(walletData);
      const portfolioRows = Array.isArray(portfolioRes.data?.holdings) ? portfolioRes.data.holdings : [];
      const assignmentMap = assignmentOverride ?? localWalletMap;

      const holdingsPerWallet = await Promise.all(
        walletData.map(async (wallet) => {
          const walletRows: WalletHoldingItem[] = await getWalletHoldings(wallet.id);

          if (walletRows.length > 0) {
            return walletRows.map((row) => {
              const portfolioMatch = portfolioRows.find((p: any) => p.ticker === row.ticker);
              return {
                id: row.id,
                ticker: row.ticker,
                wallet_id: row.wallet_id,
                wallet_name: wallet.name,
                quantity: row.quantity,
                purchase_price: row.avg_cost ?? portfolioMatch?.purchase_price ?? 0,
                purchase_date: portfolioMatch?.purchase_date ?? '',
                current_price: row.latest_price,
              } as PortfolioHolding;
            });
          }

          return portfolioRows
            .filter((p: any) => {
              const byId = p.wallet_id !== null && p.wallet_id !== undefined && String(p.wallet_id) === String(wallet.id);
              const byName = !!p.wallet_name && String(p.wallet_name).trim().toLowerCase() === wallet.name.trim().toLowerCase();
              const local = assignmentMap[p.ticker];
              const byLocal = !!local && String(local.wallet_id) === String(wallet.id);
              return byId || byName || byLocal;
            })
            .map((p: any, idx: number) => ({
              id: Number(p.id ?? idx + 1),
              ticker: p.ticker,
              wallet_id: p.wallet_id ?? assignmentMap[p.ticker]?.wallet_id ?? wallet.id,
              wallet_name: p.wallet_name ?? assignmentMap[p.ticker]?.wallet_name ?? wallet.name,
              quantity: p.quantity,
              purchase_price: p.purchase_price ?? 0,
              purchase_date: p.purchase_date ?? '',
              current_price: p.current_price ?? null,
            } as PortfolioHolding));
        })
      );

      setHoldings(holdingsPerWallet.flat());

      const initialEditors: Record<number, WalletEditorState> = {};
      walletData.forEach((wallet) => {
        initialEditors[wallet.id] = toEditorState(wallet);
      });
      setEditors(initialEditors);
    } catch (err) {
      console.error('Failed to load wallet details:', err);
      setError('Unable to load wallet details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    loadWalletData();
  }, [authLoading, isAuthenticated, token]);

  const onEditorFieldChange = (walletId: number, field: keyof WalletEditorState, value: string) => {
    setEditors((prev) => ({
      ...prev,
      [walletId]: {
        ...(prev[walletId] || ({} as WalletEditorState)),
        [field]: value,
      },
    }));
  };

  const handleSaveWallet = async (wallet: InvestmentWallet) => {
    const editor = editors[wallet.id];
    if (!editor) return;

    const parsedHorizon = editor.horizon_months.trim() ? Number(editor.horizon_months) : null;
    const parsedMaxDrawdown = editor.max_drawdown_pct.trim() ? Number(editor.max_drawdown_pct) : null;

    if (editor.name.trim().length < 2) {
      setActionMessage('Wallet name must be at least 2 characters.');
      return;
    }

    if (parsedHorizon !== null && (!Number.isFinite(parsedHorizon) || parsedHorizon < 1 || parsedHorizon > 600)) {
      setActionMessage('Horizon must be a number between 1 and 600 months.');
      return;
    }

    if (parsedMaxDrawdown !== null && (!Number.isFinite(parsedMaxDrawdown) || parsedMaxDrawdown < 0 || parsedMaxDrawdown > 100)) {
      setActionMessage('Max drawdown must be between 0 and 100.');
      return;
    }

    try {
      setSavingWalletId(wallet.id);
      setActionMessage(null);

      const updatedWallet = await updateWallet(wallet.id, {
        name: editor.name.trim(),
        purpose: editor.purpose.trim(),
      });

      const updatedProfile: WalletProfile = await updateWalletProfile(wallet.id, {
        risk_profile: editor.risk_profile,
        horizon_months: parsedHorizon,
        objective: editor.objective,
        max_drawdown_pct: parsedMaxDrawdown,
        liquidity_need: editor.liquidity_need,
        source: 'manual',
      });

      setWallets((prev) =>
        prev.map((w) =>
          w.id === wallet.id
            ? {
                ...w,
                ...updatedWallet,
                profile: updatedProfile,
              }
            : w
        )
      );
      setActionMessage(`Saved updates for ${editor.name.trim()}.`);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setActionMessage(typeof detail === 'string' ? detail : 'Failed to save wallet updates.');
    } finally {
      setSavingWalletId(null);
    }
  };

  const handleDeactivateWallet = async (wallet: InvestmentWallet) => {
    if (!window.confirm(`Deactivate wallet "${wallet.name}"? You can still restore it later from backend/admin tools.`)) {
      return;
    }

    try {
      setSavingWalletId(wallet.id);
      setActionMessage(null);
      await deactivateWallet(wallet.id);
      setWallets((prev) => prev.filter((w) => w.id !== wallet.id));
      setEditors((prev) => {
        const next = { ...prev };
        delete next[wallet.id];
        return next;
      });
      if (activeEditWalletId === wallet.id) {
        setActiveEditWalletId(null);
      }
      setActionMessage(`Deactivated ${wallet.name}.`);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setActionMessage(typeof detail === 'string' ? detail : 'Failed to deactivate wallet.');
    } finally {
      setSavingWalletId(null);
    }
  };

  const handleCreateWallet = async () => {
    if (newWalletName.trim().length < 2) {
      setActionMessage('Wallet name must be at least 2 characters.');
      return;
    }

    try {
      setCreatingWallet(true);
      setActionMessage(null);
      const created = await createWallet({
        name: newWalletName.trim(),
        purpose: newWalletPurpose,
      });
      setWallets((prev) => [...prev, created]);
      setEditors((prev) => ({
        ...prev,
        [created.id]: toEditorState(created),
      }));
      setNewWalletName('');
      setNewWalletPurpose('custom');
      setShowCreateWalletModal(false);
      setActionMessage(`Created wallet ${created.name}.`);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setActionMessage(typeof detail === 'string' ? detail : 'Failed to create wallet.');
    } finally {
      setCreatingWallet(false);
    }
  };

  const openAddHoldingModal = (walletId: number) => {
    setActiveAddHoldingWalletId(walletId);
    setAddHoldingForm({ ticker: '', quantity: '', purchase_price: '', purchase_date: '' });
  };

  const handleAddHoldingToWallet = async () => {
    if (!token || !activeAddHoldingWalletId) return;

    const ticker = addHoldingForm.ticker.trim().toUpperCase();
    const quantity = Number(addHoldingForm.quantity);
    const purchasePrice = addHoldingForm.purchase_price.trim() ? Number(addHoldingForm.purchase_price) : undefined;

    if (!ticker) {
      setActionMessage('Ticker is required.');
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setActionMessage('Quantity must be greater than 0.');
      return;
    }

    try {
      setHoldingBusy(true);
      await axios.post(
        `${API_BASE_URL}/portfolio`,
        {
          ticker,
          quantity,
          purchase_price: purchasePrice,
          purchase_date: addHoldingForm.purchase_date || undefined,
          wallet_id: activeAddHoldingWalletId,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Enforce wallet linkage explicitly after add to avoid stale wallet mapping.
      await axios.put(
        `${API_BASE_URL}/portfolio/${ticker}`,
        {
          quantity,
          purchase_price: purchasePrice,
          purchase_date: addHoldingForm.purchase_date || undefined,
          wallet_id: activeAddHoldingWalletId,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const currentWallet = wallets.find((w) => w.id === activeAddHoldingWalletId);
      if (currentWallet) {
        const nextMap = {
          ...localWalletMap,
          [ticker]: { wallet_id: currentWallet.id, wallet_name: currentWallet.name },
        };
        persistLocalWalletMap(nextMap);
        await loadWalletData(nextMap);
      } else {
        await loadWalletData();
      }
      setActionMessage(`Added ${ticker} to wallet.`);
      setActiveAddHoldingWalletId(null);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const isAlreadyExists = typeof detail === 'string' && detail.toLowerCase().includes('already in portfolio');

      if (isAlreadyExists) {
        try {
          const existing = holdings.find((h) => h.ticker === ticker);
          const mergedQuantity = (existing?.quantity || 0) + quantity;
          await axios.put(
            `${API_BASE_URL}/portfolio/${ticker}`,
            {
              quantity: mergedQuantity,
              purchase_price: purchasePrice ?? existing?.purchase_price,
              purchase_date: addHoldingForm.purchase_date || existing?.purchase_date || undefined,
              wallet_id: activeAddHoldingWalletId,
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const currentWallet = wallets.find((w) => w.id === activeAddHoldingWalletId);
          if (currentWallet) {
            const nextMap = {
              ...localWalletMap,
              [ticker]: { wallet_id: currentWallet.id, wallet_name: currentWallet.name },
            };
            persistLocalWalletMap(nextMap);
            await loadWalletData(nextMap);
          } else {
            await loadWalletData();
          }
          setActionMessage(`Updated existing ${ticker} and assigned it to this wallet.`);
          setActiveAddHoldingWalletId(null);
          return;
        } catch (mergeErr: any) {
          const mergeDetail = mergeErr?.response?.data?.detail;
          setActionMessage(typeof mergeDetail === 'string' ? mergeDetail : 'Failed to update existing holding for this wallet.');
          return;
        }
      }

      setActionMessage(typeof detail === 'string' ? detail : 'Failed to add ETF to wallet.');
    } finally {
      setHoldingBusy(false);
    }
  };

  const openWalletEditModal = (wallet: InvestmentWallet) => {
    setEditors((prev) => ({ ...prev, [wallet.id]: toEditorState(wallet) }));
    setActiveEditWalletId(wallet.id);
  };

  const openEditHoldingModal = (holding: PortfolioHolding) => {
    setActiveEditHolding(holding);
    setEditHoldingForm({
      ticker: holding.ticker,
      quantity: String(holding.quantity),
      purchase_price: String(holding.purchase_price ?? ''),
      purchase_date: holding.purchase_date ? String(holding.purchase_date).slice(0, 10) : '',
    });
  };

  const handleEditHolding = async () => {
    if (!token || !activeEditHolding) return;

    const quantity = Number(editHoldingForm.quantity);
    const purchasePrice = editHoldingForm.purchase_price.trim() ? Number(editHoldingForm.purchase_price) : undefined;
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setActionMessage('Quantity must be greater than 0.');
      return;
    }

    try {
      setHoldingBusy(true);
      await axios.put(
        `${API_BASE_URL}/portfolio/${activeEditHolding.ticker}`,
        {
          quantity,
          purchase_price: purchasePrice,
          purchase_date: editHoldingForm.purchase_date || undefined,
          wallet_id: activeEditHolding.wallet_id ?? undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (activeEditHolding.wallet_id && activeEditHolding.wallet_name) {
        const nextMap = {
          ...localWalletMap,
          [activeEditHolding.ticker]: {
            wallet_id: activeEditHolding.wallet_id,
            wallet_name: activeEditHolding.wallet_name,
          },
        };
        persistLocalWalletMap(nextMap);
        await loadWalletData(nextMap);
      } else {
        await loadWalletData();
      }
      setActionMessage(`Updated ${activeEditHolding.ticker}.`);
      setActiveEditHolding(null);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setActionMessage(typeof detail === 'string' ? detail : 'Failed to update holding.');
    } finally {
      setHoldingBusy(false);
    }
  };

  const handleRemoveHolding = async (holding: PortfolioHolding) => {
    if (!token) return;
    if (!window.confirm(`Remove ${holding.ticker} from this wallet and portfolio?`)) return;

    try {
      setHoldingBusy(true);
      await axios.delete(`${API_BASE_URL}/portfolio/${holding.ticker}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const next = { ...localWalletMap };
      delete next[holding.ticker];
      persistLocalWalletMap(next);
      setActionMessage(`Removed ${holding.ticker}.`);
      await loadWalletData(next);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setActionMessage(typeof detail === 'string' ? detail : 'Failed to remove holding.');
    } finally {
      setHoldingBusy(false);
    }
  };

  if (!authLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white border border-[#cae7ee] rounded-xl p-6 text-center">
          <h1 className="text-xl font-semibold text-[#0d1117] mb-2">Sign in required</h1>
          <p className="text-sm text-[#3a5260] mb-4">Please sign in to view wallet details.</p>
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
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0d1117]">Wallet Details</h1>
            <p className="text-[#3a5260] mt-1">Different wallets, different goals and holdings.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateWalletModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#6366f1] text-white hover:bg-[#4f46e5]"
          >
            <Plus className="w-4 h-4" />
            Add Wallet
          </button>
        </div>

        <div className="bg-[#eef7fb] border border-[#cae7ee] rounded-xl p-4 mb-5 text-sm text-[#3a5260]">
          This page is wallet-first: add a wallet, add ETFs inside that wallet, then edit or remove holdings directly here.
        </div>

        {actionMessage && (
          <div className="bg-white border border-[#cae7ee] rounded-xl p-3 mb-4 text-sm text-[#3a5260]">
            {actionMessage}
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-[#3a5260]">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading wallets...
          </div>
        )}

        {error && (
          <div className="bg-[#d44a4a12] border border-red-200 rounded-xl p-4 mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#d44a4a]" />
            <p className="text-sm text-[#d44a4a]">{error}</p>
          </div>
        )}

        {!loading && !error && wallets.length === 0 && (
          <div className="bg-white border border-dashed border-[#cae7ee] rounded-xl p-6 text-[#3a5260] text-sm">
            No wallets found yet. Create one from My Portfolio.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {wallets.map((wallet) => {
            const walletHoldings = holdings.filter((h) => {
              const byId = h.wallet_id !== null && h.wallet_id !== undefined && String(h.wallet_id) === String(wallet.id);
              const byName = !!h.wallet_name && h.wallet_name.trim().toLowerCase() === wallet.name.trim().toLowerCase();
              return byId || byName;
            });
            const walletInvested = walletHoldings.reduce(
              (sum, h) => sum + ((h.purchase_price ?? 0) * h.quantity),
              0
            );
            const walletMarketValue = walletHoldings.reduce(
              (sum, h) => sum + ((h.current_price ?? h.purchase_price ?? 0) * h.quantity),
              0
            );
            const walletPnL = walletMarketValue - walletInvested;
            const walletPnLPct = walletInvested > 0 ? (walletPnL / walletInvested) * 100 : 0;
            const walletStage = walletHoldings.length > 0 ? 'Funded' : 'Empty';

            return (
              <article key={wallet.id} className="bg-white border border-[#cae7ee] rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h2 className="text-lg font-semibold text-[#0d1117]">{wallet.name}</h2>
                    <p className="text-xs text-[#3a5260] mt-1">Purpose: {formatChoice(wallet.purpose)}</p>
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-[rgba(85,178,201,0.12)] flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-[#3d96ad]" />
                  </div>
                </div>

                <div className="mb-3 space-y-1.5 text-xs">
                  <div className="rounded-md border-l-4 border-sky-500 bg-sky-50 px-2.5 py-1.5 text-sky-900">
                    Stage: {walletStage} · Purpose: {formatChoice(wallet.purpose)} · Holdings: {walletHoldings.length}
                  </div>
                  <div className="rounded-md border-l-4 border-indigo-500 bg-indigo-50 px-2.5 py-1.5 text-indigo-900">
                    Invested: ${walletInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · Value: ${walletMarketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div
                    className={`rounded-md border-l-4 px-2.5 py-1.5 ${walletPnL >= 0 ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-rose-500 bg-rose-50 text-rose-900'}`}
                  >
                    Unrealized P/L: {walletPnL >= 0 ? '+' : ''}${walletPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({walletPnL >= 0 ? '+' : ''}{walletPnLPct.toFixed(2)}%)
                  </div>
                  <div className="rounded-md border-l-4 border-amber-500 bg-amber-50 px-2.5 py-1.5 text-amber-900">
                    Risk: {formatChoice(wallet.profile?.risk_profile || 'balanced')} · Objective: {formatChoice(wallet.profile?.objective || 'balanced_growth')} · Liquidity: {formatChoice(wallet.profile?.liquidity_need || 'medium')} · Horizon: {wallet.profile?.horizon_months ?? '-'}m
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openAddHoldingModal(wallet.id)}
                    className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-[#6366f1] text-white hover:bg-[#4f46e5]"
                  >
                    <Plus className="w-4 h-4" />
                    Add ETF
                  </button>
                  <button
                    type="button"
                    onClick={() => openWalletEditModal(wallet)}
                    className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-[#f0f8fa] text-[#2f7990] hover:bg-[#e4f3f8]"
                  >
                    Edit Wallet
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeactivateWallet(wallet)}
                    disabled={savingWalletId === wallet.id}
                    className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    {savingWalletId === wallet.id ? 'Working...' : 'Deactivate'}
                  </button>
                </div>

                <div className="mt-4 border border-[#cae7ee] rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-[#f8fafc] text-xs font-medium text-[#3a5260]">Wallet Holdings</div>
                  {walletHoldings.length === 0 ? (
                    <div className="px-3 py-3 text-sm text-[#7a9fad]">No holdings in this wallet yet.</div>
                  ) : (
                    <div className="divide-y divide-[#cae7ee]">
                      {walletHoldings.map((holding) => (
                        <div key={holding.id} className="px-3 py-2.5 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[#0d1117]">{holding.ticker}</p>
                            <p className="text-xs text-[#3a5260]">
                              Qty {holding.quantity} · Avg ${Number(holding.purchase_price || 0).toFixed(2)} · Last ${Number(holding.current_price || 0).toFixed(2)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditHoldingModal(holding)}
                              className="p-1.5 rounded-md text-[#3a5260] hover:bg-[#f0f8fa]"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveHolding(holding)}
                              className="p-1.5 rounded-md text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </main>

      {showCreateWalletModal && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-[#cae7ee] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[#0d1117]">Create New Wallet</h2>
              <button type="button" onClick={() => setShowCreateWalletModal(false)} className="p-1.5 rounded-md hover:bg-[#f0f8fa]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-sm text-[#3a5260]">
                Wallet Name
                <input
                  type="text"
                  value={newWalletName}
                  onChange={(e) => setNewWalletName(e.target.value)}
                  placeholder="e.g., Retirement"
                  className="mt-1 w-full rounded-lg border border-[#cae7ee] px-3 py-2 text-sm text-[#0d1117]"
                />
              </label>
              <label className="block text-sm text-[#3a5260]">
                Purpose
                <select
                  value={newWalletPurpose}
                  onChange={(e) => setNewWalletPurpose(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#cae7ee] px-3 py-2 text-sm text-[#0d1117]"
                >
                  <option value="retirement">Retirement</option>
                  <option value="education">Education</option>
                  <option value="home">Home</option>
                  <option value="income">Income</option>
                  <option value="growth">Growth</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
            </div>
            <div className="flex items-center gap-2 mt-5">
              <button type="button" onClick={() => setShowCreateWalletModal(false)} className="px-4 py-2 rounded-lg border border-[#cae7ee] text-[#3a5260] hover:bg-[#f0f8fa]">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateWallet}
                disabled={creatingWallet}
                className="px-4 py-2 rounded-lg bg-[#6366f1] text-white hover:bg-[#4f46e5] disabled:opacity-60"
              >
                {creatingWallet ? 'Creating...' : 'Create Wallet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeAddHoldingWalletId !== null && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-[#cae7ee] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[#0d1117]">Add ETF to Wallet</h2>
              <button type="button" onClick={() => setActiveAddHoldingWalletId(null)} className="p-1.5 rounded-md hover:bg-[#f0f8fa]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm text-[#3a5260] sm:col-span-2">
                Ticker
                <input
                  type="text"
                  value={addHoldingForm.ticker}
                  onChange={(e) => setAddHoldingForm((prev) => ({ ...prev, ticker: e.target.value.toUpperCase() }))}
                  placeholder="SPY"
                  className="mt-1 w-full rounded-lg border border-[#cae7ee] px-3 py-2 text-sm text-[#0d1117]"
                />
              </label>
              <label className="text-sm text-[#3a5260]">
                Quantity
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={addHoldingForm.quantity}
                  onChange={(e) => setAddHoldingForm((prev) => ({ ...prev, quantity: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#cae7ee] px-3 py-2 text-sm text-[#0d1117]"
                />
              </label>
              <label className="text-sm text-[#3a5260]">
                Avg Cost
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={addHoldingForm.purchase_price}
                  onChange={(e) => setAddHoldingForm((prev) => ({ ...prev, purchase_price: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#cae7ee] px-3 py-2 text-sm text-[#0d1117]"
                />
              </label>
              <label className="text-sm text-[#3a5260] sm:col-span-2">
                Purchase Date
                <input
                  type="date"
                  value={addHoldingForm.purchase_date}
                  onChange={(e) => setAddHoldingForm((prev) => ({ ...prev, purchase_date: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#cae7ee] px-3 py-2 text-sm text-[#0d1117]"
                />
              </label>
            </div>
            <div className="flex items-center gap-2 mt-5">
              <button type="button" onClick={() => setActiveAddHoldingWalletId(null)} className="px-4 py-2 rounded-lg border border-[#cae7ee] text-[#3a5260] hover:bg-[#f0f8fa]">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddHoldingToWallet}
                disabled={holdingBusy}
                className="px-4 py-2 rounded-lg bg-[#6366f1] text-white hover:bg-[#4f46e5] disabled:opacity-60"
              >
                {holdingBusy ? 'Adding...' : 'Add ETF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeEditHolding && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-[#cae7ee] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[#0d1117]">Edit Holding {activeEditHolding.ticker}</h2>
              <button type="button" onClick={() => setActiveEditHolding(null)} className="p-1.5 rounded-md hover:bg-[#f0f8fa]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm text-[#3a5260]">
                Quantity
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={editHoldingForm.quantity}
                  onChange={(e) => setEditHoldingForm((prev) => ({ ...prev, quantity: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#cae7ee] px-3 py-2 text-sm text-[#0d1117]"
                />
              </label>
              <label className="text-sm text-[#3a5260]">
                Avg Cost
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={editHoldingForm.purchase_price}
                  onChange={(e) => setEditHoldingForm((prev) => ({ ...prev, purchase_price: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#cae7ee] px-3 py-2 text-sm text-[#0d1117]"
                />
              </label>
              <label className="text-sm text-[#3a5260] sm:col-span-2">
                Purchase Date
                <input
                  type="date"
                  value={editHoldingForm.purchase_date}
                  onChange={(e) => setEditHoldingForm((prev) => ({ ...prev, purchase_date: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#cae7ee] px-3 py-2 text-sm text-[#0d1117]"
                />
              </label>
            </div>
            <div className="flex items-center gap-2 mt-5">
              <button type="button" onClick={() => setActiveEditHolding(null)} className="px-4 py-2 rounded-lg border border-[#cae7ee] text-[#3a5260] hover:bg-[#f0f8fa]">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEditHolding}
                disabled={holdingBusy}
                className="px-4 py-2 rounded-lg bg-[#6366f1] text-white hover:bg-[#4f46e5] disabled:opacity-60"
              >
                {holdingBusy ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeEditWalletId !== null && editors[activeEditWalletId] && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-[#cae7ee] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[#0d1117]">Edit Wallet Info</h2>
              <button type="button" onClick={() => setActiveEditWalletId(null)} className="p-1.5 rounded-md hover:bg-[#f0f8fa]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm text-[#3a5260]">
                Wallet Name
                <input
                  type="text"
                  value={editors[activeEditWalletId].name}
                  onChange={(e) => onEditorFieldChange(activeEditWalletId, 'name', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#cae7ee] px-3 py-2 text-sm text-[#0d1117]"
                />
              </label>

              <label className="text-sm text-[#3a5260]">
                Purpose
                <input
                  type="text"
                  value={editors[activeEditWalletId].purpose}
                  onChange={(e) => onEditorFieldChange(activeEditWalletId, 'purpose', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#cae7ee] px-3 py-2 text-sm text-[#0d1117]"
                />
              </label>

              <label className="text-sm text-[#3a5260]">
                Risk Profile
                <select
                  value={editors[activeEditWalletId].risk_profile}
                  onChange={(e) => onEditorFieldChange(activeEditWalletId, 'risk_profile', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#cae7ee] px-3 py-2 text-sm text-[#0d1117]"
                >
                  <option value="conservative">Conservative</option>
                  <option value="balanced">Balanced</option>
                  <option value="aggressive">Aggressive</option>
                </select>
              </label>

              <label className="text-sm text-[#3a5260]">
                Horizon (months)
                <input
                  type="number"
                  min={1}
                  max={600}
                  value={editors[activeEditWalletId].horizon_months}
                  onChange={(e) => onEditorFieldChange(activeEditWalletId, 'horizon_months', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#cae7ee] px-3 py-2 text-sm text-[#0d1117]"
                />
              </label>

              <label className="text-sm text-[#3a5260]">
                Objective
                <select
                  value={editors[activeEditWalletId].objective}
                  onChange={(e) => onEditorFieldChange(activeEditWalletId, 'objective', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#cae7ee] px-3 py-2 text-sm text-[#0d1117]"
                >
                  <option value="capital_preservation">Capital Preservation</option>
                  <option value="income">Income</option>
                  <option value="balanced_growth">Balanced Growth</option>
                  <option value="high_growth">High Growth</option>
                </select>
              </label>

              <label className="text-sm text-[#3a5260]">
                Liquidity Need
                <select
                  value={editors[activeEditWalletId].liquidity_need}
                  onChange={(e) => onEditorFieldChange(activeEditWalletId, 'liquidity_need', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#cae7ee] px-3 py-2 text-sm text-[#0d1117]"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>

              <label className="text-sm text-[#3a5260] sm:col-span-2">
                Max Drawdown (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={editors[activeEditWalletId].max_drawdown_pct}
                  onChange={(e) => onEditorFieldChange(activeEditWalletId, 'max_drawdown_pct', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#cae7ee] px-3 py-2 text-sm text-[#0d1117]"
                />
              </label>
            </div>

            <div className="flex items-center gap-2 mt-5">
              <button
                type="button"
                onClick={() => setActiveEditWalletId(null)}
                className="px-4 py-2 rounded-lg border border-[#cae7ee] text-[#3a5260] hover:bg-[#f0f8fa]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const wallet = wallets.find((w) => w.id === activeEditWalletId);
                  if (wallet) {
                    handleSaveWallet(wallet).then(() => {
                      setActiveEditWalletId(null);
                    });
                  }
                }}
                disabled={savingWalletId === activeEditWalletId}
                className="px-4 py-2 rounded-lg bg-[#6366f1] text-white hover:bg-[#4f46e5] disabled:opacity-60"
              >
                {savingWalletId === activeEditWalletId ? 'Saving...' : 'Save Wallet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
