import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Camera,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Download,
  List,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Square,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  AppSettings,
  ChecklistItem,
  ChecklistScope,
  MENTAL_STATES,
  MentalState,
  PLAYBOOK_SETUPS,
  PlaybookSetup,
  PropAccount,
  TabId,
  Trade,
  TradeSide,
} from '../types';
import { formatMoney, formatR, formatShortDate, generateId, getTodayISO } from '../utils/format';
import { ChartLightboxModal } from './ChartLightboxModal';
import { CsvImportModal } from './CsvImportModal';
import { TradeUpdateModal } from './TradeUpdateModal';

interface JournalTabProps {
  accounts: PropAccount[];
  trades: Trade[];
  settings: AppSettings;
  checklist: ChecklistItem[];
  preselectedAccountId?: string | null;
  onClearPreselectedAccount: () => void;
  onAddTrade: (trade: Trade) => void;
  onUpdateTrade: (trade: Trade) => void;
  onBulkImportTrades: (imported: Trade[]) => void;
  onDeleteTrade: (tradeId: string) => void;
  onUpdateChecklist: (next: ChecklistItem[]) => void;
  onNavigateTab: (tab: TabId) => void;
}

const SYMBOL_CHIPS = ['XAUUSD', 'NAS100', 'EURUSD', 'GBPUSD', 'US30', 'NQ', 'USDJPY', 'GBPJPY'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const JournalTab: React.FC<JournalTabProps> = ({
  accounts,
  trades,
  settings,
  checklist,
  preselectedAccountId,
  onClearPreselectedAccount,
  onAddTrade,
  onUpdateTrade,
  onBulkImportTrades,
  onDeleteTrade,
  onUpdateChecklist,
  onNavigateTab,
}) => {
  const loggerRef = useRef<HTMLDivElement | null>(null);

  // Pre-Trade CISD Checklist state
  const [checklistExpanded, setChecklistExpanded] = useState<boolean>(true);
  const [setupFilter, setSetupFilter] = useState<ChecklistScope>('All');
  const [newCheckLabel, setNewCheckLabel] = useState<string>('');
  const [newCheckScope, setNewCheckScope] = useState<ChecklistScope>('All');

  // Quick Trade Logger form state (fast entry: P&L and Screenshots added post-trade via TradeUpdateModal)
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? 'general');
  const [date, setDate] = useState<string>(getTodayISO());
  const [symbol, setSymbol] = useState<string>('XAUUSD');
  const [side, setSide] = useState<TradeSide>('Long');
  const [setup, setSetup] = useState<PlaybookSetup>('Liquidity Sweep + CISD + BB');
  const [mentalState, setMentalState] = useState<MentalState>('Focused');
  const [ruleFollowed, setRuleFollowed] = useState<boolean>(true);
  const [note, setNote] = useState<string>('');
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [csvImportOpen, setCsvImportOpen] = useState<boolean>(false);

  // Post-trade outcome & chart update modal state
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);

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
    } else if (
      accounts.length > 0 &&
      (!accountId || accountId === 'general' || !accounts.some((a) => a.id === accountId))
    ) {
      setAccountId(accounts[0].id);
    } else if (accounts.length === 0 && accountId !== 'general') {
      setAccountId('general');
    }
  }, [preselectedAccountId, accounts, accountId, onClearPreselectedAccount]);

  // Checklist calculations
  const visibleChecklist = useMemo(
    () =>
      checklist.filter(
        (item) =>
          setupFilter === 'All' || item.setupScope === 'All' || item.setupScope === setupFilter
      ),
    [checklist, setupFilter]
  );

  const requiredItems = visibleChecklist.filter((i) => i.required);
  const checkedRequired = requiredItems.filter((i) => i.checked).length;
  const checklistPct =
    requiredItems.length > 0 ? Math.round((checkedRequired / requiredItems.length) * 100) : 100;
  const checklistReady = requiredItems.length > 0 && checkedRequired === requiredItems.length;

  const handleToggleCheck = (id: string) => {
    onUpdateChecklist(
      checklist.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  const handleAddCheckItem = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newCheckLabel.trim();
    if (!cleaned) return;
    onUpdateChecklist([
      ...checklist,
      {
        id: generateId('chk'),
        label: cleaned,
        setupScope: newCheckScope,
        required: true,
        checked: false,
      },
    ]);
    setNewCheckLabel('');
  };

  const handleDeleteCheckItem = (id: string) => {
    onUpdateChecklist(checklist.filter((item) => item.id !== id));
  };

  const handleResetChecks = () => {
    onUpdateChecklist(checklist.map((item) => ({ ...item, checked: false })));
  };

  // Fast open-trade logging (P&L + Screenshots added once TP/SL hits)
  const handleLogTrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) return;

    const newTrade: Trade = {
      id: generateId('tr'),
      accountId,
      date,
      symbol: symbol.trim().toUpperCase() || 'XAUUSD',
      side,
      setup,
      status: 'open',
      rMultiple: 0,
      netPnl: 0,
      mentalState,
      ruleFollowed,
      note: note.trim(),
      createdAt: new Date().toISOString(),
    };

    onAddTrade(newTrade);
    setNote('');
    setSelectedCalDate(date);
    setSaveFeedback(
      `Logged ${newTrade.symbol} ${newTrade.side} as Open — update P&L & charts once TP/SL hits.`
    );
    window.setTimeout(() => setSaveFeedback(null), 4000);
  };

  // Active Open Trades awaiting TP/SL outcome
  const openTrades = useMemo(
    () =>
      trades
        .filter((t) => t.status === 'open')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [trades]
  );

  // Monthly Calendar computation
  const monthPrefix = `${calYear}-${String(calMonth + 1).padStart(2, '0')}`;
  const monthTrades = useMemo(
    () => trades.filter((t) => t.date.startsWith(monthPrefix)),
    [trades, monthPrefix]
  );
  const monthNetPnl = useMemo(
    () =>
      monthTrades
        .filter((t) => t.status !== 'open')
        .reduce((s, t) => s + t.netPnl, 0),
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
      'Status',
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
      t.status === 'open' ? 'Open' : 'Closed',
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
      {/* Top Row: Pre-Trade CISD Checklist (Left) + Quick Trade Logger (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Pre-Trade CISD Checklist */}
        <section className="tb-glass lg:col-span-5 rounded-2xl p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={() => setChecklistExpanded((prev) => !prev)}
              className="flex items-center gap-3 text-left cursor-pointer group min-w-0 flex-1"
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0"
                style={{
                  backgroundColor: checklistReady ? 'var(--positive-soft)' : 'var(--accent-soft)',
                  color: checklistReady ? 'var(--positive)' : 'var(--accent-text)',
                }}
              >
                <CheckSquare className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">
                    Pre-Trade Checklist
                  </h2>
                  <span
                    className="font-mono-num text-xs font-bold"
                    style={{ color: checklistReady ? 'var(--positive)' : 'var(--accent-text)' }}
                  >
                    {checkedRequired}/{requiredItems.length} ({checklistPct}%)
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  Verify CISD confluence before entering. Auto-resets daily.
                </p>
              </div>
            </button>

            <div className="flex items-center gap-1.5 shrink-0">
              {checklistExpanded && (
                <button
                  type="button"
                  onClick={handleResetChecks}
                  className="tb-btn-ghost inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={() => setChecklistExpanded((prev) => !prev)}
                aria-label={checklistExpanded ? 'Collapse checklist' : 'Expand checklist'}
                className="tb-btn-ghost p-2 rounded-xl cursor-pointer"
              >
                {checklistExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Readiness Progress Bar */}
          <div className="mt-3.5 h-1.5 w-full rounded-full bg-[var(--bg-elevated)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${checklistPct}%`,
                backgroundColor: checklistReady ? 'var(--positive)' : 'var(--accent)',
              }}
            />
          </div>

          {checklistExpanded && (
            <div className="mt-4 space-y-3.5">
              {/* Setup Scope Filter */}
              <div className="flex flex-wrap items-center gap-1.5">
                {(['All', ...PLAYBOOK_SETUPS] as ChecklistScope[]).map((scope) => {
                  const active = setupFilter === scope;
                  return (
                    <button
                      key={scope}
                      type="button"
                      onClick={() => setSetupFilter(scope)}
                      className="rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap"
                      style={{
                        backgroundColor: active ? 'var(--nav-pill)' : 'var(--bg-input)',
                        color: active ? 'var(--nav-pill-text)' : 'var(--text-secondary)',
                        border: active
                          ? '1px solid transparent'
                          : '1px solid var(--border-subtle)',
                      }}
                    >
                      {scope}
                    </button>
                  );
                })}
              </div>

              {/* Checklist Rules */}
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-0.5">
                {visibleChecklist.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2.5 transition-colors hover:border-[var(--border-strong)]"
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleCheck(item.id)}
                      className="flex flex-1 items-center gap-2.5 text-left cursor-pointer min-w-0"
                    >
                      {item.checked ? (
                        <CheckSquare
                          className="w-4 h-4 shrink-0"
                          style={{ color: 'var(--positive)' }}
                        />
                      ) : (
                        <Square className="w-4 h-4 shrink-0 text-[var(--text-muted)]" />
                      )}
                      <div className="min-w-0">
                        <span
                          className={`block text-xs leading-snug ${
                            item.checked
                              ? 'line-through text-[var(--text-muted)]'
                              : 'text-[var(--text-primary)]'
                          }`}
                        >
                          {item.label}
                        </span>
                        {item.setupScope !== 'All' && (
                          <span className="text-[10px] text-[var(--accent-text)]">
                            {item.setupScope}
                          </span>
                        )}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteCheckItem(item.id)}
                      aria-label="Remove checklist rule"
                      className="p-1 rounded-md text-[var(--text-muted)] hover:text-rose-400 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Custom Checklist Rule */}
              <form
                onSubmit={handleAddCheckItem}
                className="pt-3 border-t border-[var(--border-subtle)] space-y-2"
              >
                <input
                  type="text"
                  value={newCheckLabel}
                  onChange={(e) => setNewCheckLabel(e.target.value)}
                  placeholder="Add custom pre-trade rule..."
                  className="tb-input w-full rounded-xl px-3 py-2 text-xs"
                />
                <div className="flex items-center gap-2">
                  <select
                    value={newCheckScope}
                    onChange={(e) => setNewCheckScope(e.target.value as ChecklistScope)}
                    className="tb-input flex-1 rounded-xl px-3 py-2 text-xs"
                  >
                    <option value="All">All Setups</option>
                    {PLAYBOOK_SETUPS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="tb-btn-primary inline-flex items-center justify-center gap-1 rounded-xl px-3.5 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Rule
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>

        {/* Right: Quick Trade Logger (Fast Entry — P&L & Charts updated after TP/SL) */}
        <section ref={loggerRef} className="tb-glass lg:col-span-7 rounded-2xl p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[var(--border-subtle)]">
            <div>
              <h1 className="text-lg font-semibold text-[var(--text-primary)]">
                Quick Trade Logger
              </h1>
              <p className="text-xs text-[var(--text-muted)]">
                Log entry quickly. Add Net P&amp;L, R-Multiple, and screenshots inside the logged
                trade once TP or SL hits.
              </p>
            </div>
            {saveFeedback && (
              <span className="text-xs font-semibold" style={{ color: 'var(--positive)' }}>
                {saveFeedback}
              </span>
            )}
          </div>

          <form onSubmit={handleLogTrade} className="mt-4 space-y-4">
            {/* Row 1: Account & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-[var(--text-secondary)]">
                    Account
                  </label>
                  {accounts.length === 0 && (
                    <button
                      type="button"
                      onClick={() => onNavigateTab('accounts')}
                      className="text-[11px] font-semibold text-[var(--accent-text)] hover:underline cursor-pointer"
                    >
                      + Add Account
                    </button>
                  )}
                </div>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  required
                  className="tb-input w-full rounded-xl px-3.5 py-2.5 text-sm"
                >
                  {accounts.length === 0 ? (
                    <option value="general">General / Unlinked Account</option>
                  ) : (
                    accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))
                  )}
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
            </div>

            {/* Row 2: Symbol & Side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
                  {SYMBOL_CHIPS.slice(0, 6).map((sym) => (
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

            {/* Row 3: Playbook Setup (EXACT 2 options) */}
            <div>
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

            {/* Row 4: Mental State & Rule Followed */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-start">
              <div className="sm:col-span-7">
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
                        className="rounded-lg px-2.5 py-2 text-xs font-medium transition-all cursor-pointer whitespace-nowrap"
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

              <div className="sm:col-span-5">
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Rule Followed
                </label>
                <button
                  type="button"
                  onClick={() => setRuleFollowed((prev) => !prev)}
                  className="w-full flex items-center justify-between rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer"
                  style={{
                    backgroundColor: ruleFollowed
                      ? 'var(--positive-soft)'
                      : 'var(--negative-soft)',
                    border: `1px solid ${ruleFollowed ? 'var(--positive)' : 'var(--negative)'}`,
                    color: ruleFollowed ? 'var(--positive)' : 'var(--negative)',
                  }}
                >
                  <span>{ruleFollowed ? 'Yes — Followed' : 'No — Broken'}</span>
                  <span className="font-mono-num">{ruleFollowed ? 'ON' : 'OFF'}</span>
                </button>
              </div>
            </div>

            {/* Row 5: Execution Note + Fast Log Action */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-end">
              <div className="sm:col-span-7">
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Entry Note (Optional)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="CISD confirmation, sweep level, TP/SL plan..."
                  className="tb-input w-full rounded-xl px-3.5 py-2.5 text-sm"
                />
              </div>

              <div className="sm:col-span-5">
                <button
                  type="submit"
                  className="tb-btn-primary w-full inline-flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-sm font-semibold cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Log Open Trade
                </button>
              </div>
            </div>
          </form>
        </section>
      </div>

      {/* Active Open Trades awaiting TP / SL update */}
      {openTrades.length > 0 && (
        <section className="tb-glass rounded-2xl p-5 sm:p-6 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--warning)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Open Trades Awaiting Outcome ({openTrades.length})
              </h2>
            </div>
            <span className="text-[11px] text-[var(--text-muted)]">
              Click &ldquo;Update P&amp;L &amp; Charts&rdquo; once TP or SL hits
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {openTrades.map((t) => {
              const acc = accountLookup.get(t.accountId);
              return (
                <div
                  key={t.id}
                  className="rounded-xl border border-[var(--border-strong)] bg-[var(--bg-input)] p-3.5 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
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
                        className="font-mono-num text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                        style={{
                          backgroundColor: 'var(--warning-soft)',
                          color: 'var(--warning)',
                        }}
                      >
                        OPEN
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {formatShortDate(t.date)} · {t.setup} · {acc?.name ?? 'General Account'}
                    </p>
                    {t.note && (
                      <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{t.note}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)]">
                    <button
                      type="button"
                      onClick={() => setEditingTrade(t)}
                      className="tb-btn-primary flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Update P&amp;L &amp; Charts
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteTrade(t.id)}
                      aria-label="Delete open trade"
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

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
                  const closedDayList = dayList.filter((t) => t.status !== 'open');
                  const openDayCount = dayList.length - closedDayList.length;
                  const dayPnl = closedDayList.reduce((s, t) => s + t.netPnl, 0);
                  const hasCharts = dayList.some((t) => t.beforeChartId || t.afterChartId);
                  const isSelected = selectedCalDate === iso;
                  const isToday = iso === getTodayISO();

                  let bg = 'var(--bg-input)';
                  let border = 'var(--border-subtle)';
                  if (closedDayList.length > 0) {
                    bg = dayPnl >= 0 ? 'var(--positive-soft)' : 'var(--negative-soft)';
                    border =
                      dayPnl >= 0
                        ? 'rgba(16, 185, 129, 0.35)'
                        : 'rgba(244, 63, 94, 0.35)';
                  } else if (openDayCount > 0) {
                    bg = 'var(--warning-soft)';
                    border = 'rgba(245, 158, 11, 0.38)';
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
                          {closedDayList.length > 0 ? (
                            <span
                              className="block font-mono-num text-[11px] sm:text-xs font-bold leading-tight truncate"
                              style={{ color: dayPnl >= 0 ? 'var(--positive)' : 'var(--negative)' }}
                            >
                              {formatMoney(dayPnl, settings.currency, settings.privacyMode, {
                                signed: true,
                                compact: true,
                              })}
                            </span>
                          ) : (
                            <span
                              className="block font-mono-num text-[10px] font-bold uppercase leading-tight"
                              style={{ color: 'var(--warning)' }}
                            >
                              {openDayCount} Open
                            </span>
                          )}
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
                    {selectedDateTrades.map((t) => {
                      const isOpen = t.status === 'open';
                      const hasCharts = Boolean(t.beforeChartId || t.afterChartId);
                      return (
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
                            {isOpen ? (
                              <span
                                className="font-mono-num text-[10px] font-bold uppercase px-2 py-0.5 rounded-md"
                                style={{
                                  backgroundColor: 'var(--warning-soft)',
                                  color: 'var(--warning)',
                                }}
                              >
                                OPEN
                              </span>
                            ) : (
                              <span
                                className="font-mono-num text-sm font-bold"
                                style={{
                                  color: t.netPnl >= 0 ? 'var(--positive)' : 'var(--negative)',
                                }}
                              >
                                {formatMoney(t.netPnl, settings.currency, settings.privacyMode, {
                                  signed: true,
                                })}
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-[var(--text-muted)]">
                            {t.setup}
                            {!isOpen && ` · ${formatR(t.rMultiple)}`} · {t.mentalState} ·{' '}
                            {t.ruleFollowed ? 'Rule OK' : 'Rule Broken'}
                          </div>

                          {t.note && (
                            <p className="text-xs text-[var(--text-secondary)] leading-snug">
                              {t.note}
                            </p>
                          )}

                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)]">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingTrade(t)}
                                className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-text)] hover:opacity-85 cursor-pointer"
                              >
                                <Pencil className="w-3 h-3" />
                                {isOpen ? 'Update P&L / Charts' : 'Edit'}
                              </button>
                              {hasCharts && (
                                <button
                                  type="button"
                                  onClick={() => setLightboxTrade(t)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                                >
                                  <Camera className="w-3 h-3" />
                                  Charts
                                </button>
                              )}
                            </div>
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
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Trade List View */
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search symbol, note, mindset..."
                  className="tb-input w-full rounded-xl pl-8 pr-3 py-2 text-xs"
                />
              </div>

              <select
                value={filterAccount}
                onChange={(e) => setFilterAccount(e.target.value)}
                className="tb-input rounded-xl px-3 py-2 text-xs"
              >
                <option value="all">All Prop Accounts</option>
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
                      const isOpen = t.status === 'open';
                      return (
                        <tr
                          key={t.id}
                          className="hover:bg-[var(--bg-hover)] transition-colors"
                        >
                          <td className="py-3 px-3.5 font-mono-num whitespace-nowrap text-[var(--text-secondary)]">
                            {t.date}
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap text-[var(--text-primary)]">
                            {acc?.name ?? (t.accountId === 'general' ? 'General Account' : 'Account')}
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
                            {isOpen ? '—' : formatR(t.rMultiple)}
                          </td>
                          <td className="py-3 px-3.5 font-mono-num font-bold text-right whitespace-nowrap">
                            {isOpen ? (
                              <span
                                className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md"
                                style={{
                                  backgroundColor: 'var(--warning-soft)',
                                  color: 'var(--warning)',
                                }}
                              >
                                OPEN
                              </span>
                            ) : (
                              <span
                                style={{
                                  color: t.netPnl >= 0 ? 'var(--positive)' : 'var(--negative)',
                                }}
                              >
                                {formatMoney(t.netPnl, settings.currency, settings.privacyMode, {
                                  signed: true,
                                })}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            {hasCharts ? (
                              <button
                                type="button"
                                onClick={() => setLightboxTrade(t)}
                                className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-text)] hover:opacity-85 cursor-pointer whitespace-nowrap"
                              >
                                <Camera className="w-3 h-3" />
                                View
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setEditingTrade(t)}
                                className="text-[11px] text-[var(--text-muted)] hover:text-[var(--accent-text)] hover:underline cursor-pointer whitespace-nowrap"
                              >
                                + Add
                              </button>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setEditingTrade(t)}
                                title={isOpen ? 'Update P&L & Charts' : 'Edit Trade'}
                                aria-label="Update trade outcome and charts"
                                className="inline-flex items-center gap-1 rounded-lg bg-[var(--bg-elevated)] px-2 py-1.5 text-[11px] font-medium text-[var(--text-primary)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-text)] cursor-pointer"
                              >
                                <Pencil className="w-3 h-3" />
                                <span>{isOpen ? 'Update' : 'Edit'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteTrade(t.id)}
                                aria-label="Delete trade"
                                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
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

      <TradeUpdateModal
        trade={editingTrade}
        accounts={accounts}
        allTrades={trades}
        settings={settings}
        onSave={(updated) => {
          onUpdateTrade(updated);
          setSaveFeedback(
            updated.status === 'closed'
              ? `Updated ${updated.symbol} (${formatMoney(updated.netPnl, settings.currency, settings.privacyMode, { signed: true })})`
              : `Saved updates to open trade ${updated.symbol}`
          );
          window.setTimeout(() => setSaveFeedback(null), 3500);
        }}
        onClose={() => setEditingTrade(null)}
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
