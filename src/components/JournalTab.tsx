import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  Camera,
  ChevronLeft,
  ChevronRight,
  Download,
  ImagePlus,
  List,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  AppSettings,
  EconomicNewsEvent,
  GuardrailConfig,
  MENTAL_STATES,
  MentalState,
  PLAYBOOK_SETUPS,
  PlaybookSetup,
  PropAccount,
  TabId,
  Trade,
  TradeSide,
} from '../types';
import { compressImageFile, saveImage } from '../db/storage';
import { computeDrawdownImpact } from '../utils/calculations';
import { evaluateNewsEvents, getActiveNewsAlert } from '../utils/guardrails';
import { formatMoney, formatR, formatShortDate, generateId, getTodayISO } from '../utils/format';
import { ChartLightboxModal } from './ChartLightboxModal';
import { ChartAnnotatorModal } from './ChartAnnotatorModal';
import { CsvImportModal } from './CsvImportModal';

interface JournalTabProps {
  accounts: PropAccount[];
  trades: Trade[];
  settings: AppSettings;
  newsEvents: EconomicNewsEvent[];
  guardrailConfig: GuardrailConfig;
  preselectedAccountId?: string | null;
  onClearPreselectedAccount: () => void;
  onAddTrade: (trade: Trade) => void;
  onBulkImportTrades: (imported: Trade[]) => void;
  onDeleteTrade: (tradeId: string) => void;
  onNavigateTab: (tab: TabId) => void;
}

const SYMBOL_CHIPS = ['XAUUSD', 'NAS100', 'EURUSD', 'GBPUSD', 'US30', 'NQ', 'USDJPY', 'GBPJPY'];
const PNL_PRESETS = [-500, -250, 400, 850];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const JournalTab: React.FC<JournalTabProps> = ({
  accounts,
  trades,
  settings,
  newsEvents,
  guardrailConfig,
  preselectedAccountId,
  onClearPreselectedAccount,
  onAddTrade,
  onBulkImportTrades,
  onDeleteTrade,
  onNavigateTab,
}) => {
  const loggerRef = useRef<HTMLDivElement | null>(null);

  // Live clock tick for economic news restriction countdowns
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const activeNewsAlert = useMemo(() => {
    if (!guardrailConfig.enableNewsWarnings) return null;
    const evaluated = evaluateNewsEvents(
      newsEvents,
      now,
      settings.dstMode,
      guardrailConfig.newsBufferMinutes
    );
    return getActiveNewsAlert(evaluated);
  }, [
    newsEvents,
    now,
    settings.dstMode,
    guardrailConfig.enableNewsWarnings,
    guardrailConfig.newsBufferMinutes,
  ]);

  // Quick Trade Logger form state
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? '');
  const [date, setDate] = useState<string>(getTodayISO());
  const [symbol, setSymbol] = useState<string>('XAUUSD');
  const [side, setSide] = useState<TradeSide>('Long');
  const [setup, setSetup] = useState<PlaybookSetup>('Liquidity Sweep + CISD + BB');
  const [rMultiple, setRMultiple] = useState<string>('2.0');
  const [netPnl, setNetPnl] = useState<string>('400');
  const [mentalState, setMentalState] = useState<MentalState>('Focused');
  const [ruleFollowed, setRuleFollowed] = useState<boolean>(true);
  const [note, setNote] = useState<string>('');
  const [beforePreview, setBeforePreview] = useState<string | null>(null);
  const [afterPreview, setAfterPreview] = useState<string | null>(null);
  const [annotatingPreview, setAnnotatingPreview] = useState<'before' | 'after' | null>(null);
  const [guardrailOverride, setGuardrailOverride] = useState<boolean>(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [csvImportOpen, setCsvImportOpen] = useState<boolean>(false);

  // Calendar / List View state
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const todayParts = getTodayISO().split('-').map(Number);
  const [calYear, setCalYear] = useState<number>(todayParts[0]);
  const [calMonth, setCalMonth] = useState<number>(todayParts[1] - 1); // 0-indexed
  const [selectedCalDate, setSelectedCalDate] = useState<string | null>(getTodayISO());

  // List Filters
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [filterSetup, setFilterSetup] = useState<string>('all');
  const [filterRule, setFilterRule] = useState<'all' | 'followed' | 'broken'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Lightbox state
  const [lightboxTrade, setLightboxTrade] = useState<Trade | null>(null);

  useEffect(() => {
    if (preselectedAccountId && accounts.some((a) => a.id === preselectedAccountId)) {
      setAccountId(preselectedAccountId);
      onClearPreselectedAccount();
      loggerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (!accountId && accounts[0]) {
      setAccountId(accounts[0].id);
    }
  }, [preselectedAccountId, accounts, accountId, onClearPreselectedAccount]);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === accountId),
    [accounts, accountId]
  );

  const parsedPnl = Number(netPnl) || 0;
  const drawdownPreview = useMemo(
    () => computeDrawdownImpact(selectedAccount, trades, date, parsedPnl),
    [selectedAccount, trades, date, parsedPnl]
  );

  useEffect(() => {
    setGuardrailOverride(false);
  }, [accountId, date, netPnl]);

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    slot: 'before' | 'after'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file);
      if (slot === 'before') setBeforePreview(dataUrl);
      else setAfterPreview(dataUrl);
    } catch {
      // Ignore invalid image
    }
    e.target.value = '';
  };

  const handleLogTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) return;

    if (settings.breachGuardrail && drawdownPreview?.anyBreach && !guardrailOverride) {
      setGuardrailOverride(true);
      return;
    }

    let beforeChartId: string | undefined;
    let afterChartId: string | undefined;

    if (beforePreview) {
      beforeChartId = generateId('img_b');
      await saveImage(beforeChartId, beforePreview);
    }
    if (afterPreview) {
      afterChartId = generateId('img_a');
      await saveImage(afterChartId, afterPreview);
    }

    const newTrade: Trade = {
      id: generateId('tr'),
      accountId,
      date,
      symbol: symbol.trim().toUpperCase() || 'XAUUSD',
      side,
      setup,
      rMultiple: Number(rMultiple) || 0,
      netPnl: parsedPnl,
      mentalState,
      ruleFollowed,
      note: note.trim(),
      beforeChartId,
      afterChartId,
      createdAt: new Date().toISOString(),
    };

    onAddTrade(newTrade);
    setNote('');
    setBeforePreview(null);
    setAfterPreview(null);
    setGuardrailOverride(false);
    setSelectedCalDate(date);
    setSaveFeedback(`Logged ${newTrade.symbol} ${newTrade.side} (${formatR(newTrade.rMultiple)})`);
    window.setTimeout(() => setSaveFeedback(null), 3000);
  };

  // Monthly Calendar computation
  const monthPrefix = `${calYear}-${String(calMonth + 1).padStart(2, '0')}`;
  const monthTrades = useMemo(
    () => trades.filter((t) => t.date.startsWith(monthPrefix)),
    [trades, monthPrefix]
  );
  const monthNetPnl = useMemo(
    () => monthTrades.reduce((s, t) => s + t.netPnl, 0),
    [monthTrades]
  );

  const dayMap = useMemo(() => {
    const m = new Map<string, Trade[]>();
    for (const t of trades) {
      const list = m.get(t.date) ?? [];
      list.push(t);
      m.set(t.date, list);
    }
    return m;
  }, [trades]);

  const calendarCells = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(`${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return cells;
  }, [calYear, calMonth]);

  const monthLabel = new Date(calYear, calMonth, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const shiftMonth = (delta: number) => {
    const dt = new Date(calYear, calMonth + delta, 1);
    setCalYear(dt.getFullYear());
    setCalMonth(dt.getMonth());
  };

  const selectedDateTrades = selectedCalDate ? dayMap.get(selectedCalDate) ?? [] : [];

  // Filtered List Trades
  const filteredTrades = useMemo(() => {
    return trades
      .filter((t) => {
        if (filterAccount !== 'all' && t.accountId !== filterAccount) return false;
        if (filterSetup !== 'all' && t.setup !== filterSetup) return false;
        if (filterRule === 'followed' && !t.ruleFollowed) return false;
        if (filterRule === 'broken' && t.ruleFollowed) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const match =
            t.symbol.toLowerCase().includes(q) ||
            t.note.toLowerCase().includes(q) ||
            t.mentalState.toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [trades, filterAccount, filterSetup, filterRule, searchQuery]);

  const handleExportCsv = () => {
    const header = [
      'Date',
      'Account',
      'Symbol',
      'Side',
      'Setup',
      'R-Multiple',
      'Net P&L (USD)',
      'Mental State',
      'Rule Followed',
      'Note',
    ];
    const accLookup = new Map(accounts.map((a) => [a.id, a.name]));
    const rows = filteredTrades.map((t) => [
      t.date,
      `"${(accLookup.get(t.accountId) ?? t.accountId).replace(/"/g, '""')}"`,
      t.symbol,
      t.side,
      `"${t.setup}"`,
      t.rMultiple.toFixed(2),
      t.netPnl.toFixed(2),
      t.mentalState,
      t.ruleFollowed ? 'Yes' : 'No',
      `"${t.note.replace(/"/g, '""')}"`,
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tradebook-journal-${getTodayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const accountLookup = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  return (
    <div className="space-y-6">
      {/* Quick Trade Logger */}
      <section ref={loggerRef} className="tb-glass rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--border-subtle)]">
          <div>
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">Quick Trade Logger</h1>
            <p className="text-xs text-[var(--text-muted)]">
              Log CISD executions with live prop-firm drawdown impact and Before/After chart proof.
            </p>
          </div>
          {saveFeedback && (
            <span className="text-xs font-semibold" style={{ color: 'var(--positive)' }}>
              {saveFeedback}
            </span>
          )}
        </div>

        {/* Active High-Impact News Warning Banner */}
        {activeNewsAlert && (
          <div
            className={`mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 ${
              activeNewsAlert.level === 'restricted'
                ? 'border-rose-500/45 bg-rose-500/12'
                : 'border-amber-500/40 bg-amber-500/12'
            }`}
          >
            <div className="flex items-center gap-2 text-xs">
              <AlertTriangle
                className={`w-4 h-4 shrink-0 ${
                  activeNewsAlert.level === 'restricted' ? 'text-rose-400' : 'text-amber-400'
                }`}
              />
              <span className="text-[var(--text-primary)]">
                <strong>
                  {activeNewsAlert.level === 'restricted'
                    ? 'Prop News Restriction Active:'
                    : 'High-Impact News Approaching:'}
                </strong>{' '}
                {activeNewsAlert.event.event.currency} {activeNewsAlert.event.event.title} (
                {activeNewsAlert.event.istTimeLabel} · {activeNewsAlert.event.countdownText})
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('guard')}
              className="text-xs font-semibold text-[var(--accent-text)] hover:underline cursor-pointer whitespace-nowrap"
            >
              View Calendar →
            </button>
          </div>
        )}

        <form onSubmit={handleLogTrade} className="mt-5 space-y-5">
          {/* Row 1: Account, Date, Symbol, Side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Account
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                required
                className="tb-input w-full rounded-xl px-3.5 py-2.5 text-sm"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Trade Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="tb-input font-mono-num w-full rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Symbol
              </label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                required
                placeholder="XAUUSD"
                className="tb-input font-mono-num w-full rounded-xl px-3.5 py-2.5 text-sm uppercase"
              />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {SYMBOL_CHIPS.slice(0, 5).map((sym) => (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => setSymbol(sym)}
                    className="rounded-md px-1.5 py-0.5 text-[10px] font-mono-num transition-colors cursor-pointer"
                    style={{
                      backgroundColor:
                        symbol === sym ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                      color: symbol === sym ? 'var(--accent-text)' : 'var(--text-muted)',
                    }}
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Side
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['Long', 'Short'] as TradeSide[]).map((s) => {
                  const active = side === s;
                  const isLong = s === 'Long';
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSide(s)}
                      className="rounded-xl py-2.5 text-sm font-semibold transition-all cursor-pointer"
                      style={{
                        backgroundColor: active
                          ? isLong
                            ? 'var(--positive-soft)'
                            : 'var(--negative-soft)'
                          : 'var(--bg-input)',
                        border: active
                          ? `1px solid ${isLong ? 'var(--positive)' : 'var(--negative)'}`
                          : '1px solid var(--border-subtle)',
                        color: active
                          ? isLong
                            ? 'var(--positive)'
                            : 'var(--negative)'
                          : 'var(--text-secondary)',
                      }}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Row 2: Playbook Setup (EXACT 2 options), R-Multiple, Net P&L + Presets */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5">
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Playbook Setup
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PLAYBOOK_SETUPS.map((opt) => {
                  const active = setup === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setSetup(opt)}
                      className="rounded-xl px-3 py-2.5 text-xs font-semibold text-left transition-all cursor-pointer"
                      style={{
                        backgroundColor: active ? 'var(--accent-soft)' : 'var(--bg-input)',
                        border: active
                          ? '1px solid var(--accent)'
                          : '1px solid var(--border-subtle)',
                        color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                R-Multiple
              </label>
              <input
                type="number"
                step="0.1"
                value={rMultiple}
                onChange={(e) => setRMultiple(e.target.value)}
                required
                className="tb-input font-mono-num w-full rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>

            <div className="lg:col-span-5">
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Net P&amp;L (USD)
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  step="1"
                  value={netPnl}
                  onChange={(e) => setNetPnl(e.target.value)}
                  required
                  className="tb-input font-mono-num flex-1 min-w-[110px] rounded-xl px-3.5 py-2.5 text-sm"
                />
                <div className="flex items-center gap-1.5 flex-wrap">
                  {PNL_PRESETS.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        setNetPnl(String(val));
                        setRMultiple(val < 0 ? (val === -500 ? '-1.0' : '-0.5') : val === 400 ? '1.6' : '2.5');
                      }}
                      className="rounded-lg px-2.5 py-2 text-xs font-mono-num font-semibold transition-colors cursor-pointer whitespace-nowrap"
                      style={{
                        backgroundColor:
                          val >= 0 ? 'var(--positive-soft)' : 'var(--negative-soft)',
                        color: val >= 0 ? 'var(--positive)' : 'var(--negative)',
                      }}
                    >
                      {val > 0 ? `+$${val}` : `-$${Math.abs(val)}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Mental State, Rule Followed, Execution Note */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5">
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Mental State
              </label>
              <div className="flex flex-wrap gap-1.5">
                {MENTAL_STATES.map((ms) => {
                  const active = mentalState === ms;
                  return (
                    <button
                      key={ms}
                      type="button"
                      onClick={() => setMentalState(ms)}
                      className="rounded-lg px-3 py-2 text-xs font-medium transition-all cursor-pointer whitespace-nowrap"
                      style={{
                        backgroundColor: active ? 'var(--accent-soft)' : 'var(--bg-input)',
                        border: active
                          ? '1px solid var(--accent)'
                          : '1px solid var(--border-subtle)',
                        color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
                      }}
                    >
                      {ms}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-3">
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Rule Followed
              </label>
              <button
                type="button"
                onClick={() => setRuleFollowed((prev) => !prev)}
                className="w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all cursor-pointer"
                style={{
                  backgroundColor: ruleFollowed
                    ? 'var(--positive-soft)'
                    : 'var(--negative-soft)',
                  border: `1px solid ${ruleFollowed ? 'var(--positive)' : 'var(--negative)'}`,
                  color: ruleFollowed ? 'var(--positive)' : 'var(--negative)',
                }}
              >
                <span>{ruleFollowed ? 'Yes — Strictly Followed' : 'No — Rule Broken'}</span>
                <span className="font-mono-num">{ruleFollowed ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            <div className="lg:col-span-4">
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Execution Note
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="CISD confirmation, sweep level, management notes..."
                className="tb-input w-full rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>

          {/* Row 4: Before & After Chart Screenshots + Live Drawdown Impact Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            {/* Before & After Chart Slots */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(
                [
                  { slot: 'before' as const, label: 'Before Chart', preview: beforePreview },
                  { slot: 'after' as const, label: 'After Chart', preview: afterPreview },
                ] as const
              ).map(({ slot, label, preview }) => (
                <div
                  key={slot}
                  className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-input)] p-3 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">
                      {label}
                    </span>
                    {preview && (
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => setAnnotatingPreview(slot)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent-text)] hover:underline cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" /> Annotate
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            slot === 'before' ? setBeforePreview(null) : setAfterPreview(null)
                          }
                          className="inline-flex items-center gap-1 text-[11px] text-rose-400 hover:underline cursor-pointer"
                        >
                          <X className="w-3 h-3" /> Clear
                        </button>
                      </div>
                    )}
                  </div>
                  {preview ? (
                    <img
                      src={preview}
                      alt={`${label} preview`}
                      className="h-24 w-full rounded-lg object-cover border border-[var(--border-subtle)]"
                    />
                  ) : (
                    <label className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors">
                      <ImagePlus className="w-5 h-5 text-[var(--text-muted)]" />
                      <span className="text-xs text-[var(--text-muted)]">
                        Upload {label} (PNG/JPG)
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageUpload(e, slot)}
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>

            {/* Live Drawdown Impact Preview */}
            <div className="lg:col-span-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  Live Drawdown Impact Preview
                </span>
                <span className="text-[11px] text-[var(--text-muted)] truncate max-w-[160px]">
                  {selectedAccount?.name ?? 'Select account'}
                </span>
              </div>

              {drawdownPreview ? (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="block text-[11px] text-[var(--text-muted)]">Projected Bal</span>
                      <span className="font-mono-num font-semibold text-[var(--text-primary)]">
                        {formatMoney(
                          drawdownPreview.projectedEquity,
                          settings.currency,
                          settings.privacyMode,
                          { decimals: 0 }
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-[var(--text-muted)]">Daily Buffer</span>
                      <span
                        className="font-mono-num font-semibold"
                        style={{
                          color: drawdownPreview.dailyBreached
                            ? 'var(--negative)'
                            : 'var(--positive)',
                        }}
                      >
                        {formatMoney(
                          drawdownPreview.projectedDailyBuffer,
                          settings.currency,
                          settings.privacyMode,
                          { decimals: 0 }
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-[var(--text-muted)]">Max DD Buffer</span>
                      <span
                        className="font-mono-num font-semibold"
                        style={{
                          color: drawdownPreview.maxDdBreached
                            ? 'var(--negative)'
                            : 'var(--positive)',
                        }}
                      >
                        {formatMoney(
                          drawdownPreview.projectedMaxDdBuffer,
                          settings.currency,
                          settings.privacyMode,
                          { decimals: 0 }
                        )}
                      </span>
                    </div>
                  </div>

                  {drawdownPreview.anyBreach && (
                    <div className="flex items-start gap-2 rounded-lg border border-rose-500/45 bg-rose-500/12 p-2.5 text-xs text-rose-400">
                      <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <strong>Rule Breach Warning:</strong> This trade breaches{' '}
                        {drawdownPreview.dailyBreached && drawdownPreview.maxDdBreached
                          ? 'both Daily Loss Limit and Max Drawdown'
                          : drawdownPreview.dailyBreached
                          ? 'the Daily Loss Limit'
                          : 'the Max Drawdown floor'}
                        .
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-[var(--text-muted)]">Select an account to preview impact.</p>
              )}

              <button
                type="submit"
                className="tb-btn-primary mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold cursor-pointer"
              >
                {guardrailOverride ? (
                  <>
                    <AlertTriangle className="w-4 h-4" />
                    Confirm &amp; Log Breaching Trade
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Save Trade to Journal
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* Calendar & List Switcher Section */}
      <section className="tb-glass rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-1">
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer"
              style={{
                backgroundColor: viewMode === 'calendar' ? 'var(--nav-pill)' : 'transparent',
                color: viewMode === 'calendar' ? 'var(--nav-pill-text)' : 'var(--text-secondary)',
              }}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              Monthly Calendar
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer"
              style={{
                backgroundColor: viewMode === 'list' ? 'var(--nav-pill)' : 'transparent',
                color: viewMode === 'list' ? 'var(--nav-pill-text)' : 'var(--text-secondary)',
              }}
            >
              <List className="w-3.5 h-3.5" />
              Trade List ({filteredTrades.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCsvImportOpen(true)}
              className="tb-btn-primary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              Import MT5 / CSV
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="tb-btn-ghost inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {viewMode === 'calendar' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Calendar Grid */}
            <div className="lg:col-span-8 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => shiftMonth(-1)}
                    aria-label="Previous month"
                    className="tb-btn-ghost p-2 rounded-xl cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <h2 className="text-base font-bold text-[var(--text-primary)] min-w-[140px] text-center">
                    {monthLabel}
                  </h2>
                  <button
                    type="button"
                    onClick={() => shiftMonth(1)}
                    aria-label="Next month"
                    className="tb-btn-ghost p-2 rounded-xl cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-xs text-[var(--text-secondary)]">
                  Month P&amp;L:{' '}
                  <span
                    className="font-mono-num text-sm font-bold ml-1"
                    style={{ color: monthNetPnl >= 0 ? 'var(--positive)' : 'var(--negative)' }}
                  >
                    {formatMoney(monthNetPnl, settings.currency, settings.privacyMode, {
                      signed: true,
                    })}
                  </span>
                  <span className="text-[var(--text-muted)] ml-2">
                    ({monthTrades.length} trades)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium text-[var(--text-muted)]">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="py-1">
                    {w}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {calendarCells.map((iso, idx) => {
                  if (!iso) {
                    return <div key={`empty-${idx}`} className="h-16 sm:h-20 rounded-xl" />;
                  }
                  const dayNum = Number(iso.slice(-2));
                  const dayList = dayMap.get(iso) ?? [];
                  const dayPnl = dayList.reduce((s, t) => s + t.netPnl, 0);
                  const hasCharts = dayList.some((t) => t.beforeChartId || t.afterChartId);
                  const isSelected = selectedCalDate === iso;
                  const isToday = iso === getTodayISO();

                  let bg = 'var(--bg-input)';
                  let border = 'var(--border-subtle)';
                  if (dayList.length > 0) {
                    bg = dayPnl >= 0 ? 'var(--positive-soft)' : 'var(--negative-soft)';
                    border =
                      dayPnl >= 0
                        ? 'rgba(16, 185, 129, 0.35)'
                        : 'rgba(244, 63, 94, 0.35)';
                  }
                  if (isSelected) {
                    border = 'var(--accent)';
                  }

                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => setSelectedCalDate(iso)}
                      className="h-16 sm:h-20 rounded-xl p-1.5 sm:p-2 flex flex-col justify-between text-left transition-all cursor-pointer"
                      style={{
                        backgroundColor: bg,
                        border: `1px solid ${border}`,
                      }}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span
                          className={`font-mono-num text-[11px] font-semibold ${
                            isToday ? 'text-[var(--accent-text)]' : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          {dayNum}
                        </span>
                        {hasCharts && <Camera className="w-3 h-3 text-[var(--accent-text)]" />}
                      </div>
                      {dayList.length > 0 && (
                        <div>
                          <span
                            className="block font-mono-num text-[11px] sm:text-xs font-bold leading-tight truncate"
                            style={{ color: dayPnl >= 0 ? 'var(--positive)' : 'var(--negative)' }}
                          >
                            {formatMoney(dayPnl, settings.currency, settings.privacyMode, {
                              signed: true,
                              compact: true,
                            })}
                          </span>
                          <span className="hidden sm:block text-[10px] text-[var(--text-muted)]">
                            {dayList.length} {dayList.length === 1 ? 'trade' : 'trades'}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tap-a-Date Drawer */}
            <div className="lg:col-span-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--border-subtle)]">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">
                      {selectedCalDate ? formatShortDate(selectedCalDate) : 'Select a Date'}
                    </h3>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {selectedDateTrades.length} executions logged
                    </p>
                  </div>
                  {selectedCalDate && (
                    <button
                      type="button"
                      onClick={() => {
                        setDate(selectedCalDate);
                        loggerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className="tb-btn-primary inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add on Date
                    </button>
                  )}
                </div>

                {selectedDateTrades.length === 0 ? (
                  <p className="py-10 text-center text-xs text-[var(--text-muted)]">
                    No trades logged on this date. Click &ldquo;+ Add on Date&rdquo; to record one.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                    {selectedDateTrades.map((t) => (
                      <div
                        key={t.id}
                        className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card-solid)] p-3 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono-num text-sm font-bold text-[var(--text-primary)]">
                              {t.symbol}
                            </span>
                            <span
                              className="text-xs font-semibold"
                              style={{
                                color: t.side === 'Long' ? 'var(--positive)' : 'var(--negative)',
                              }}
                            >
                              {t.side}
                            </span>
                          </div>
                          <span
                            className="font-mono-num text-sm font-bold"
                            style={{ color: t.netPnl >= 0 ? 'var(--positive)' : 'var(--negative)' }}
                          >
                            {formatMoney(t.netPnl, settings.currency, settings.privacyMode, {
                              signed: true,
                            })}
                          </span>
                        </div>

                        <div className="text-[11px] text-[var(--text-muted)]">
                          {t.setup} · {formatR(t.rMultiple)} · {t.mentalState} ·{' '}
                          {t.ruleFollowed ? 'Rule OK' : 'Rule Broken'}
                        </div>

                        {t.note && (
                          <p className="text-xs text-[var(--text-secondary)] leading-snug">
                            {t.note}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-1">
                          {(t.beforeChartId || t.afterChartId) ? (
                            <button
                              type="button"
                              onClick={() => setLightboxTrade(t)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-text)] hover:underline cursor-pointer"
                            >
                              <Camera className="w-3.5 h-3.5" />
                              View Before/After Charts
                            </button>
                          ) : (
                            <span className="text-[11px] text-[var(--text-muted)]">No charts</span>
                          )}
                          <button
                            type="button"
                            onClick={() => onDeleteTrade(t.id)}
                            aria-label="Delete trade"
                            className="p-1 rounded-md text-[var(--text-muted)] hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Filterable List View */
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search symbol, note, mood..."
                  className="tb-input w-full rounded-xl pl-9 pr-3 py-2 text-xs"
                />
              </div>

              <select
                value={filterAccount}
                onChange={(e) => setFilterAccount(e.target.value)}
                className="tb-input rounded-xl px-3 py-2 text-xs"
              >
                <option value="all">All Accounts</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>

              <select
                value={filterSetup}
                onChange={(e) => setFilterSetup(e.target.value)}
                className="tb-input rounded-xl px-3 py-2 text-xs"
              >
                <option value="all">All Playbook Setups</option>
                {PLAYBOOK_SETUPS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                value={filterRule}
                onChange={(e) => setFilterRule(e.target.value as 'all' | 'followed' | 'broken')}
                className="tb-input rounded-xl px-3 py-2 text-xs"
              >
                <option value="all">All Discipline States</option>
                <option value="followed">Rules Followed Only</option>
                <option value="broken">Rule Broken Only</option>
              </select>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-input)] text-[var(--text-muted)]">
                    <th className="py-3 px-3.5 font-medium">Date</th>
                    <th className="py-3 px-3.5 font-medium">Account</th>
                    <th className="py-3 px-3.5 font-medium">Symbol</th>
                    <th className="py-3 px-3.5 font-medium">Setup</th>
                    <th className="py-3 px-3.5 font-medium">Mindset / Rule</th>
                    <th className="py-3 px-3.5 font-medium text-right">R</th>
                    <th className="py-3 px-3.5 font-medium text-right">Net P&amp;L</th>
                    <th className="py-3 px-3.5 font-medium text-center">Charts</th>
                    <th className="py-3 px-3.5 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {filteredTrades.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-[var(--text-muted)]">
                        No trades match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredTrades.map((t) => {
                      const acc = accountLookup.get(t.accountId);
                      const hasCharts = Boolean(t.beforeChartId || t.afterChartId);
                      return (
                        <tr
                          key={t.id}
                          className="hover:bg-[var(--bg-hover)] transition-colors"
                        >
                          <td className="py-3 px-3.5 font-mono-num whitespace-nowrap text-[var(--text-secondary)]">
                            {t.date}
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap text-[var(--text-primary)]">
                            {acc?.name ?? 'Account'}
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <span className="font-mono-num font-bold text-[var(--text-primary)]">
                              {t.symbol}
                            </span>{' '}
                            <span
                              className="font-semibold"
                              style={{
                                color: t.side === 'Long' ? 'var(--positive)' : 'var(--negative)',
                              }}
                            >
                              {t.side}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-[var(--text-secondary)]">
                            <span className="block">{t.setup}</span>
                            {t.note && (
                              <span className="block text-[11px] text-[var(--text-muted)] max-w-[240px] truncate">
                                {t.note}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <span className="text-[var(--text-secondary)]">{t.mentalState}</span>
                            <span className="text-[var(--text-muted)]"> · </span>
                            <span
                              style={{
                                color: t.ruleFollowed ? 'var(--positive)' : 'var(--negative)',
                              }}
                            >
                              {t.ruleFollowed ? 'Followed' : 'Broken'}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 font-mono-num text-right text-[var(--text-secondary)]">
                            {formatR(t.rMultiple)}
                          </td>
                          <td
                            className="py-3 px-3.5 font-mono-num font-bold text-right whitespace-nowrap"
                            style={{ color: t.netPnl >= 0 ? 'var(--positive)' : 'var(--negative)' }}
                          >
                            {formatMoney(t.netPnl, settings.currency, settings.privacyMode, {
                              signed: true,
                            })}
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            {hasCharts ? (
                              <button
                                type="button"
                                onClick={() => setLightboxTrade(t)}
                                className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-text)] hover:opacity-85 cursor-pointer whitespace-nowrap"
                              >
                                <Camera className="w-3 h-3" />
                                Charts
                              </button>
                            ) : (
                              <span className="text-[var(--text-muted)]">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => onDeleteTrade(t.id)}
                              aria-label="Delete trade"
                              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <ChartLightboxModal
        trade={lightboxTrade}
        account={lightboxTrade ? accountLookup.get(lightboxTrade.accountId) : undefined}
        settings={settings}
        onClose={() => setLightboxTrade(null)}
      />

      <ChartAnnotatorModal
        open={Boolean(annotatingPreview)}
        title={
          annotatingPreview === 'before'
            ? 'Annotate Before Chart Preview'
            : 'Annotate After Chart Preview'
        }
        imageUrl={annotatingPreview === 'before' ? beforePreview : afterPreview}
        onSave={(annotatedUrl) => {
          if (annotatingPreview === 'before') setBeforePreview(annotatedUrl);
          else if (annotatingPreview === 'after') setAfterPreview(annotatedUrl);
          setAnnotatingPreview(null);
        }}
        onClose={() => setAnnotatingPreview(null)}
      />

      <CsvImportModal
        open={csvImportOpen}
        accounts={accounts}
        existingTrades={trades}
        settings={settings}
        onImportTrades={(imported) => {
          onBulkImportTrades(imported);
          setSaveFeedback(`Imported ${imported.length} broker trades into your journal.`);
          window.setTimeout(() => setSaveFeedback(null), 4000);
        }}
        onClose={() => setCsvImportOpen(false)}
      />
    </div>
  );
};
