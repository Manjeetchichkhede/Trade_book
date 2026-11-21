import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CheckSquare,
  Flame,
  Lock,
  Plus,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Square,
  Trash2,
  Unlock,
} from 'lucide-react';
import {
  AppSettings,
  ChecklistItem,
  ChecklistScope,
  EconomicNewsEvent,
  GuardrailConfig,
  NewsCurrency,
  NewsImpact,
  PLAYBOOK_SETUPS,
  Trade,
} from '../types';
import { createDefaultNewsEvents } from '../data/demoData';
import {
  computeDailyDiscipline,
  evaluateNewsEvents,
  getActiveNewsAlert,
} from '../utils/guardrails';
import { generateId, getTodayISO } from '../utils/format';

interface GuardTabProps {
  trades: Trade[];
  settings: AppSettings;
  checklist: ChecklistItem[];
  newsEvents: EconomicNewsEvent[];
  guardrailConfig: GuardrailConfig;
  onUpdateChecklist: (next: ChecklistItem[]) => void;
  onUpdateNewsEvents: (next: EconomicNewsEvent[]) => void;
  onUpdateGuardrailConfig: (patch: Partial<GuardrailConfig>) => void;
}

const CURRENCY_FILTERS: ('All' | NewsCurrency)[] = ['All', 'USD', 'EUR', 'GBP', 'JPY'];
const BUFFER_OPTIONS: (2 | 5 | 15)[] = [2, 5, 15];

export const GuardTab: React.FC<GuardTabProps> = ({
  trades,
  settings,
  checklist,
  newsEvents,
  guardrailConfig,
  onUpdateChecklist,
  onUpdateNewsEvents,
  onUpdateGuardrailConfig,
}) => {
  const [now, setNow] = useState<Date>(() => new Date());

  // Checklist UI state
  const [setupFilter, setSetupFilter] = useState<ChecklistScope>('All');
  const [newCheckLabel, setNewCheckLabel] = useState('');
  const [newCheckScope, setNewCheckScope] = useState<ChecklistScope>('All');

  // Unlock protocol 3-step check
  const [resetSteps, setResetSteps] = useState<[boolean, boolean, boolean]>([false, false, false]);

  // News UI state
  const [currencyFilter, setCurrencyFilter] = useState<'All' | NewsCurrency>('All');
  const [impactFilter, setImpactFilter] = useState<'All' | NewsImpact>('All');
  const [showAddNews, setShowAddNews] = useState(false);
  const [newsTitle, setNewsTitle] = useState('');
  const [newsDate, setNewsDate] = useState(getTodayISO());
  const [newsNyTime, setNewsNyTime] = useState('08:30');
  const [newsCurrency, setNewsCurrency] = useState<NewsCurrency>('USD');
  const [newsImpact, setNewsImpact] = useState<NewsImpact>('High');
  const [newsForecast, setNewsForecast] = useState('');
  const [newsPrevious, setNewsPrevious] = useState('');

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const discipline = useMemo(
    () => computeDailyDiscipline(trades, guardrailConfig, now),
    [trades, guardrailConfig, now]
  );

  const evaluatedNews = useMemo(
    () =>
      evaluateNewsEvents(newsEvents, now, settings.dstMode, guardrailConfig.newsBufferMinutes),
    [newsEvents, now, settings.dstMode, guardrailConfig.newsBufferMinutes]
  );

  const activeNewsAlert = useMemo(
    () => (guardrailConfig.enableNewsWarnings ? getActiveNewsAlert(evaluatedNews) : null),
    [evaluatedNews, guardrailConfig.enableNewsWarnings]
  );

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

  const filteredNews = useMemo(
    () =>
      evaluatedNews.filter((e) => {
        if (currencyFilter !== 'All' && e.event.currency !== currencyFilter) return false;
        if (impactFilter !== 'All' && e.event.impact !== impactFilter) return false;
        return true;
      }),
    [evaluatedNews, currencyFilter, impactFilter]
  );

  const startManualLockout = (minutes: number, label: string) => {
    const until = new Date(Date.now() + minutes * 60_000).toISOString();
    setResetSteps([false, false, false]);
    onUpdateGuardrailConfig({
      lockoutUntilIso: until,
      lockoutReason: `Session Lockout (${label}) — protect capital & review playbook.`,
    });
  };

  const lockUntilEndOfDay = () => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    setResetSteps([false, false, false]);
    onUpdateGuardrailConfig({
      lockoutUntilIso: end.toISOString(),
      lockoutReason: 'Locked for remainder of trading day — discipline preserved.',
    });
  };

  const clearLockout = () => {
    onUpdateGuardrailConfig({ lockoutUntilIso: null, lockoutReason: null });
    setResetSteps([false, false, false]);
  };

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

  const handleAddNewsEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsTitle.trim()) return;
    const item: EconomicNewsEvent = {
      id: generateId('news'),
      date: newsDate,
      nyTime: newsNyTime,
      currency: newsCurrency,
      impact: newsImpact,
      title: newsTitle.trim(),
      forecast: newsForecast.trim() || undefined,
      previous: newsPrevious.trim() || undefined,
    };
    onUpdateNewsEvents([...newsEvents, item]);
    setNewsTitle('');
    setNewsForecast('');
    setNewsPrevious('');
    setShowAddNews(false);
  };

  const handleLoadWeeklyTemplate = () => {
    const fresh = createDefaultNewsEvents(getTodayISO());
    const existingKeys = new Set(
      newsEvents.map((e) => `${e.date}|${e.nyTime}|${e.title.toLowerCase()}`)
    );
    const toAdd = fresh.filter(
      (e) => !existingKeys.has(`${e.date}|${e.nyTime}|${e.title.toLowerCase()}`)
    );
    if (toAdd.length > 0) {
      onUpdateNewsEvents([...newsEvents, ...toAdd]);
    }
  };

  // Overall Execution Clearance status
  const statusBanner = discipline.isLockedOut
    ? {
        title: 'SESSION LOCKED / COOLDOWN ACTIVE',
        subtitle: `${discipline.lockoutReason ?? 'Active behavioral lockout'} · Remaining: ${
          discipline.lockoutRemainingText
        }`,
        color: 'var(--negative)',
        bg: 'var(--negative-soft)',
        Icon: Lock,
      }
    : activeNewsAlert?.level === 'restricted'
    ? {
        title: `RED-FOLDER NEWS RESTRICTION (±${guardrailConfig.newsBufferMinutes}M)`,
        subtitle: `${activeNewsAlert.event.event.currency} ${activeNewsAlert.event.event.title} · ${activeNewsAlert.event.countdownText}`,
        color: 'var(--negative)',
        bg: 'var(--negative-soft)',
        Icon: ShieldAlert,
      }
    : activeNewsAlert?.level === 'imminent'
    ? {
        title: 'HIGH-IMPACT NEWS APPROACHING',
        subtitle: `${activeNewsAlert.event.event.currency} ${activeNewsAlert.event.event.title} (${activeNewsAlert.event.istTimeLabel}) · ${activeNewsAlert.event.countdownText}`,
        color: 'var(--warning)',
        bg: 'var(--warning-soft)',
        Icon: AlertTriangle,
      }
    : checklistReady
    ? {
        title: 'CLEARED TO EXECUTE',
        subtitle: `All ${requiredItems.length} pre-trade CISD checklist items verified · Zero active lockouts or news conflicts.`,
        color: 'var(--positive)',
        bg: 'var(--positive-soft)',
        Icon: ShieldCheck,
      }
    : {
        title: 'PRE-TRADE CHECKLIST INCOMPLETE',
        subtitle: `${checkedRequired} of ${requiredItems.length} mandatory CISD checks confirmed before entering the market.`,
        color: 'var(--accent-text)',
        bg: 'var(--accent-soft)',
        Icon: CheckSquare,
      };

  const allResetChecked = resetSteps[0] && resetSteps[1] && resetSteps[2];

  return (
    <div className="space-y-6">
      {/* Top Execution Clearance Banner */}
      <section
        className="tb-glass rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        style={{
          borderColor: statusBanner.color,
        }}
      >
        <div className="flex items-start gap-3.5">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl shrink-0"
            style={{ backgroundColor: statusBanner.bg, color: statusBanner.color }}
          >
            <statusBanner.Icon className="w-5 h-5" />
          </div>
          <div>
            <h1
              className="text-base sm:text-lg font-bold tracking-tight"
              style={{ color: statusBanner.color }}
            >
              {statusBanner.title}
            </h1>
            <p className="mt-0.5 text-xs sm:text-sm text-[var(--text-secondary)]">
              {statusBanner.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 font-mono-num text-xs">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3.5 py-2 text-center">
            <span className="block text-[10px] text-[var(--text-muted)]">Today Trades</span>
            <span
              className="font-bold text-sm"
              style={{
                color: discipline.maxTradesReached ? 'var(--warning)' : 'var(--text-primary)',
              }}
            >
              {discipline.todayTradesCount} / {guardrailConfig.maxTradesPerDay}
            </span>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3.5 py-2 text-center">
            <span className="block text-[10px] text-[var(--text-muted)]">Loss Streak</span>
            <span
              className="font-bold text-sm"
              style={{
                color: discipline.tiltStreakReached ? 'var(--negative)' : 'var(--text-primary)',
              }}
            >
              {discipline.consecutiveLossesToday} / {guardrailConfig.maxConsecutiveLosses}
            </span>
          </div>
        </div>
      </section>

      {/* Main 2-Column Split: Pre-Trade Checklist + Session Lockout & Tilt Guard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Section 1: Pre-Trade CISD Checklist */}
        <section className="tb-glass lg:col-span-7 rounded-2xl p-5 sm:p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  Pre-Trade CISD Checklist
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Verify every confluence rule before placing orders on funded capital.
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetChecks}
                className="tb-btn-ghost inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Checks
              </button>
            </div>

            {/* Setup Scope Pills + Readiness Meter */}
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['All', ...PLAYBOOK_SETUPS] as ChecklistScope[]).map((scope) => {
                    const active = setupFilter === scope;
                    return (
                      <button
                        key={scope}
                        type="button"
                        onClick={() => setSetupFilter(scope)}
                        className="rounded-full px-3 py-1 text-xs font-medium transition-all cursor-pointer whitespace-nowrap"
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

                <span
                  className="font-mono-num text-xs font-bold"
                  style={{ color: checklistReady ? 'var(--positive)' : 'var(--accent-text)' }}
                >
                  {checkedRequired}/{requiredItems.length} ({checklistPct}%)
                </span>
              </div>

              <div className="h-2 w-full rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${checklistPct}%`,
                    backgroundColor: checklistReady ? 'var(--positive)' : 'var(--accent)',
                  }}
                />
              </div>
            </div>

            {/* Checklist Items */}
            <div className="space-y-2">
              {visibleChecklist.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3.5 py-2.5 transition-colors hover:border-[var(--border-strong)]"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleCheck(item.id)}
                    className="flex flex-1 items-center gap-3 text-left cursor-pointer min-w-0"
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
                        className={`block text-xs sm:text-sm ${
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
          </div>

          {/* Add Custom Checklist Rule */}
          <form
            onSubmit={handleAddCheckItem}
            className="pt-4 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row gap-2"
          >
            <input
              type="text"
              value={newCheckLabel}
              onChange={(e) => setNewCheckLabel(e.target.value)}
              placeholder="Add custom pre-trade rule..."
              className="tb-input flex-1 rounded-xl px-3.5 py-2 text-xs"
            />
            <select
              value={newCheckScope}
              onChange={(e) => setNewCheckScope(e.target.value as ChecklistScope)}
              className="tb-input rounded-xl px-3 py-2 text-xs"
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
          </form>
        </section>

        {/* Section 2: Session Lockout & Tilt Cooldown Guard */}
        <section className="tb-glass lg:col-span-5 rounded-2xl p-5 sm:p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  Session Lockout &amp; Tilt Guard
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Stop revenge-trading spirals with automated cooldowns &amp; manual session locks.
                </p>
              </div>
              <Flame
                className="w-5 h-5 shrink-0"
                style={{
                  color: discipline.isLockedOut ? 'var(--negative)' : 'var(--accent-text)',
                }}
              />
            </div>

            {/* Active Lockout Box or Quick Lock Buttons */}
            {discipline.isLockedOut ? (
              <div className="rounded-xl border border-rose-500/45 bg-rose-500/12 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-rose-400 inline-flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    LOCKED OUT
                  </span>
                  <span className="font-mono-num text-lg font-bold text-rose-300">
                    {discipline.lockoutRemainingText}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  {discipline.lockoutReason}
                </p>

                {/* 3-Step Behavioral Reset Protocol to Unlock Early */}
                <div className="pt-2 border-t border-rose-500/25 space-y-1.5">
                  <p className="text-[11px] font-semibold text-[var(--text-primary)]">
                    Behavioral Reset Protocol (check all 3 to unlock early):
                  </p>
                  {[
                    'I have stepped away from the charts and taken 5 slow breaths',
                    'I accept my prior outcome and will not try to win it back',
                    'My next trade will strictly follow my CISD playbook and risk cap',
                  ].map((step, idx) => (
                    <label
                      key={step}
                      className="flex items-start gap-2 text-[11px] text-[var(--text-secondary)] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={resetSteps[idx]}
                        onChange={(e) => {
                          const next: [boolean, boolean, boolean] = [...resetSteps];
                          next[idx] = e.target.checked;
                          setResetSteps(next);
                        }}
                        className="mt-0.5 accent-blue-500"
                      />
                      <span>{step}</span>
                    </label>
                  ))}
                  <button
                    type="button"
                    disabled={!allResetChecked}
                    onClick={clearLockout}
                    className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    Complete Reset &amp; Unlock Session
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-4 space-y-3">
                <p className="text-xs font-semibold text-[var(--text-primary)]">
                  Quick Manual Session Lockout
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { mins: 15, label: '15 min' },
                    { mins: 30, label: '30 min' },
                    { mins: 60, label: '1 hour' },
                  ].map((opt) => (
                    <button
                      key={opt.mins}
                      type="button"
                      onClick={() => startManualLockout(opt.mins, opt.label)}
                      className="tb-btn-ghost rounded-xl py-2 text-xs font-semibold cursor-pointer"
                    >
                      {opt.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={lockUntilEndOfDay}
                    className="rounded-xl border border-rose-500/35 bg-rose-500/10 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 cursor-pointer"
                  >
                    End of Day
                  </button>
                </div>
              </div>
            )}

            {/* Tilt Guard Rule Configuration */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-[var(--text-primary)]">
                    Automated Tilt Cooldown Guard
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Auto-locks Journal after consecutive losses, cap hit, or Revenge/Anxious loss.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={guardrailConfig.enableTiltGuard}
                  onClick={() =>
                    onUpdateGuardrailConfig({
                      enableTiltGuard: !guardrailConfig.enableTiltGuard,
                    })
                  }
                  className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer"
                  style={{
                    backgroundColor: guardrailConfig.enableTiltGuard
                      ? 'var(--btn-primary-bg)'
                      : 'var(--border-strong)',
                  }}
                >
                  <span
                    className="inline-block h-4 w-4 rounded-full transition-transform"
                    style={{
                      transform: guardrailConfig.enableTiltGuard
                        ? 'translateX(24px)'
                        : 'translateX(4px)',
                      backgroundColor: guardrailConfig.enableTiltGuard
                        ? 'var(--btn-primary-text)'
                        : '#ffffff',
                    }}
                  />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                    Max Trades/Day
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={guardrailConfig.maxTradesPerDay}
                    onChange={(e) =>
                      onUpdateGuardrailConfig({
                        maxTradesPerDay: Math.max(1, Number(e.target.value) || 3),
                      })
                    }
                    className="tb-input font-mono-num w-full rounded-lg px-2.5 py-2 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                    Max Loss Streak
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={guardrailConfig.maxConsecutiveLosses}
                    onChange={(e) =>
                      onUpdateGuardrailConfig({
                        maxConsecutiveLosses: Math.max(1, Number(e.target.value) || 2),
                      })
                    }
                    className="tb-input font-mono-num w-full rounded-lg px-2.5 py-2 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                    Cooldown (min)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="120"
                    step="5"
                    value={guardrailConfig.cooldownMinutes}
                    onChange={(e) =>
                      onUpdateGuardrailConfig({
                        cooldownMinutes: Math.max(5, Number(e.target.value) || 15),
                      })
                    }
                    className="tb-input font-mono-num w-full rounded-lg px-2.5 py-2 text-xs font-semibold"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Section 3: Economic News Event Tracker & Prop Restriction Warnings */}
      <section className="tb-glass rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-start gap-2.5">
            <CalendarClock className="w-5 h-5 text-[var(--accent-text)] shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Economic News Event Tracker &amp; Prop Warnings
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Auto-converted to India (IST) &amp; New York time with live prop-firm restriction
                windows.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Restriction Buffer Selector */}
            <div className="flex items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-1">
              {BUFFER_OPTIONS.map((mins) => {
                const active = guardrailConfig.newsBufferMinutes === mins;
                return (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => onUpdateGuardrailConfig({ newsBufferMinutes: mins })}
                    className="rounded-lg px-2.5 py-1 text-xs font-mono-num font-semibold cursor-pointer whitespace-nowrap"
                    style={{
                      backgroundColor: active ? 'var(--nav-pill)' : 'transparent',
                      color: active ? 'var(--nav-pill-text)' : 'var(--text-secondary)',
                    }}
                  >
                    ±{mins}m
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleLoadWeeklyTemplate}
              className="tb-btn-ghost rounded-xl px-3 py-2 text-xs font-medium cursor-pointer whitespace-nowrap"
            >
              Load Weekly Templates
            </button>

            <button
              type="button"
              onClick={() => setShowAddNews((prev) => !prev)}
              className="tb-btn-primary inline-flex items-center gap-1 rounded-xl px-3.5 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Add News Event
            </button>
          </div>
        </div>

        {/* Add Custom News Event Form */}
        {showAddNews && (
          <form
            onSubmit={handleAddNewsEvent}
            className="rounded-xl border border-[var(--border-strong)] bg-[var(--bg-input)] p-4 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="lg:col-span-2">
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                  Event Title
                </label>
                <input
                  type="text"
                  required
                  value={newsTitle}
                  onChange={(e) => setNewsTitle(e.target.value)}
                  placeholder="e.g. US Core PCE Price Index"
                  className="tb-input w-full rounded-lg px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                  Date (NY Market)
                </label>
                <input
                  type="date"
                  required
                  value={newsDate}
                  onChange={(e) => setNewsDate(e.target.value)}
                  className="tb-input font-mono-num w-full rounded-lg px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                  NY Time (24h)
                </label>
                <input
                  type="time"
                  required
                  value={newsNyTime}
                  onChange={(e) => setNewsNyTime(e.target.value)}
                  className="tb-input font-mono-num w-full rounded-lg px-3 py-2 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-[var(--text-muted)] mb-1">Curr</label>
                  <select
                    value={newsCurrency}
                    onChange={(e) => setNewsCurrency(e.target.value as NewsCurrency)}
                    className="tb-input w-full rounded-lg px-2 py-2 text-xs"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="JPY">JPY</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--text-muted)] mb-1">Impact</label>
                  <select
                    value={newsImpact}
                    onChange={(e) => setNewsImpact(e.target.value as NewsImpact)}
                    className="tb-input w-full rounded-lg px-2 py-2 text-xs"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex items-center gap-3">
                <div>
                  <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                    Forecast (optional)
                  </label>
                  <input
                    type="text"
                    value={newsForecast}
                    onChange={(e) => setNewsForecast(e.target.value)}
                    placeholder="0.3%"
                    className="tb-input font-mono-num w-28 rounded-lg px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                    Previous (optional)
                  </label>
                  <input
                    type="text"
                    value={newsPrevious}
                    onChange={(e) => setNewsPrevious(e.target.value)}
                    placeholder="0.2%"
                    className="tb-input font-mono-num w-28 rounded-lg px-2.5 py-1.5 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddNews(false)}
                  className="tb-btn-ghost rounded-lg px-3 py-2 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="tb-btn-primary inline-flex items-center gap-1 rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save Event
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {CURRENCY_FILTERS.map((c) => {
              const active = currencyFilter === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrencyFilter(c)}
                  className="rounded-full px-3 py-1 text-xs font-medium cursor-pointer"
                  style={{
                    backgroundColor: active ? 'var(--nav-pill)' : 'var(--bg-input)',
                    color: active ? 'var(--nav-pill-text)' : 'var(--text-secondary)',
                    border: active ? '1px solid transparent' : '1px solid var(--border-subtle)',
                  }}
                >
                  {c}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={impactFilter}
              onChange={(e) => setImpactFilter(e.target.value as 'All' | NewsImpact)}
              className="tb-input rounded-xl px-3 py-1.5 text-xs"
            >
              <option value="All">All Impact Levels</option>
              <option value="High">High Impact (Red Folder)</option>
              <option value="Medium">Medium Impact</option>
            </select>
          </div>
        </div>

        {/* Economic News Table */}
        <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-input)] text-[var(--text-muted)]">
                <th className="py-3 px-4 font-medium">IST / NY Time</th>
                <th className="py-3 px-4 font-medium">Currency</th>
                <th className="py-3 px-4 font-medium">Impact</th>
                <th className="py-3 px-4 font-medium">Event</th>
                <th className="py-3 px-4 font-medium text-right">Forecast / Prev</th>
                <th className="py-3 px-4 font-medium text-right">Status / Countdown</th>
                <th className="py-3 px-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filteredNews.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[var(--text-muted)]">
                    No news events match the current filters.
                  </td>
                </tr>
              ) : (
                filteredNews.map((item) => {
                  const isHigh = item.event.impact === 'High';
                  const isRestricted = item.state === 'restricted';
                  const isImminent = item.state === 'imminent';
                  const isPassed = item.state === 'passed';

                  return (
                    <tr
                      key={item.event.id}
                      className={`hover:bg-[var(--bg-hover)] transition-colors ${
                        isPassed ? 'opacity-60' : ''
                      }`}
                    >
                      <td className="py-3 px-4 whitespace-nowrap font-mono-num">
                        <span className="block font-semibold text-[var(--text-primary)]">
                          {item.istDateLabel} · {item.istTimeLabel}
                        </span>
                        <span className="block text-[11px] text-[var(--text-muted)]">
                          {item.event.date} · {item.nyTimeLabel}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono-num font-bold text-[var(--text-primary)]">
                        {item.event.currency}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-semibold">
                        <span style={{ color: isHigh ? 'var(--negative)' : 'var(--warning)' }}>
                          {isHigh ? 'High (Red)' : 'Medium'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-[var(--text-primary)]">
                        {item.event.title}
                      </td>
                      <td className="py-3 px-4 font-mono-num text-right text-[var(--text-secondary)] whitespace-nowrap">
                        {item.event.forecast || '—'} / {item.event.previous || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono-num text-right whitespace-nowrap">
                        {isRestricted ? (
                          <span
                            className="font-bold"
                            style={{ color: 'var(--negative)' }}
                          >
                            RESTRICTED · {item.countdownText}
                          </span>
                        ) : isImminent ? (
                          <span
                            className="font-bold"
                            style={{ color: 'var(--warning)' }}
                          >
                            IMMINENT · {item.countdownText}
                          </span>
                        ) : (
                          <span className="text-[var(--text-secondary)]">
                            {item.countdownText}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateNewsEvents(
                              newsEvents.filter((n) => n.id !== item.event.id)
                            )
                          }
                          aria-label={`Remove ${item.event.title}`}
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
      </section>
    </div>
  );
};
