import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowUpRight,
  Calculator,
  Clock,
  Edit3,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Wallet,
} from 'lucide-react';
import { AppSettings, PropAccount, RoiEntry, TabId, Trade } from '../types';
import {
  buildPerformanceCurve,
  computeAccountMetrics,
  computeDisciplineAudit,
  computePortfolioKpis,
  getDrawdownColorClass,
} from '../utils/calculations';
import { formatMoney, formatPct, formatR, USD_TO_INR } from '../utils/format';
import { getActiveSessionHeadline, getIstAndNyClocks } from '../utils/sessions';
import { AccountModal } from './AccountModal';

interface OverviewTabProps {
  accounts: PropAccount[];
  trades: Trade[];
  roiEntries: RoiEntry[];
  settings: AppSettings;
  onSaveAccount: (account: PropAccount) => void;
  onDeleteAccount: (accountId: string) => void;
  onNavigateTab: (tab: TabId) => void;
  onQuickLogForAccount: (accountId: string) => void;
  onQuickPayoutForAccount: (accountId: string) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  accounts,
  trades,
  roiEntries,
  settings,
  onSaveAccount,
  onDeleteAccount,
  onNavigateTab,
  onQuickLogForAccount,
  onQuickPayoutForAccount,
}) => {
  const [now, setNow] = useState<Date>(() => new Date());
  const [chartMode, setChartMode] = useState<'equity' | 'daily'>('equity');
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<PropAccount | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const clocks = useMemo(() => getIstAndNyClocks(now, settings.dstMode), [now, settings.dstMode]);
  const activeSession = useMemo(
    () => getActiveSessionHeadline(now, settings.dstMode),
    [now, settings.dstMode]
  );

  const kpis = useMemo(
    () => computePortfolioKpis(accounts, trades, roiEntries),
    [accounts, trades, roiEntries]
  );
  const accountMetricsList = useMemo(
    () => accounts.map((acc) => computeAccountMetrics(acc, trades)),
    [accounts, trades]
  );
  const curveData = useMemo(() => buildPerformanceCurve(trades), [trades]);
  const audit = useMemo(() => computeDisciplineAudit(trades), [trades]);

  const chartSeries = useMemo(() => {
    const mult = settings.currency === 'INR' ? USD_TO_INR : 1;
    return curveData.map((pt) => ({
      ...pt,
      displayDaily: Math.round(pt.dailyPnl * mult),
      displayCumulative: Math.round(pt.cumulativePnl * mult),
    }));
  }, [curveData, settings.currency]);

  const currencyPrefix = settings.currency === 'INR' ? '₹' : '$';

  return (
    <div className="space-y-6">
      {/* Hero Card */}
      <section className="tb-glass rounded-2xl p-5 sm:p-7">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: activeSession.isLive
                    ? 'var(--positive-soft)'
                    : 'var(--accent-soft)',
                  color: activeSession.isLive ? 'var(--positive)' : 'var(--accent-text)',
                }}
              >
                {activeSession.isLive && (
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                )}
                {activeSession.name}
              </span>
              <span className="text-xs text-[var(--text-muted)] tabular-nums">
                {activeSession.nextCountdown}
              </span>
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] [text-wrap:balance]">
                Welcome back, Mr. Manjeet Chichkhede
              </h1>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Today&apos;s Net P&amp;L:{' '}
                <span
                  className="font-mono-num font-bold text-base sm:text-lg ml-1"
                  style={{
                    color: kpis.todayNetPnl >= 0 ? 'var(--positive)' : 'var(--negative)',
                  }}
                >
                  {formatMoney(kpis.todayNetPnl, settings.currency, settings.privacyMode, {
                    signed: true,
                  })}
                </span>
                <span className="text-[var(--text-muted)] mx-2">·</span>
                <span className="text-xs text-[var(--text-muted)]">
                  {kpis.fundedCount} Funded / {kpis.evalCount} Eval Accounts Active
                </span>
              </p>
            </div>

            {/* Quick Shortcuts */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => onNavigateTab('journal')}
                className="tb-btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Log Trade
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('lotsize')}
                className="tb-btn-ghost inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium cursor-pointer whitespace-nowrap"
              >
                <Calculator className="w-3.5 h-3.5" />
                Lot Size
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('sessions')}
                className="tb-btn-ghost inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium cursor-pointer whitespace-nowrap"
              >
                <Clock className="w-3.5 h-3.5" />
                Sessions
              </button>
            </div>
          </div>

          {/* Live Ticking IST & NY Clocks */}
          {settings.liveClocksOverview && (
            <div className="grid grid-cols-2 gap-3 lg:w-auto shrink-0">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 py-3 min-w-[148px]">
                <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                  <span>India (IST)</span>
                  <span>UTC+5:30</span>
                </div>
                <p className="mt-1 font-mono-num text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                  {clocks.ist.formatted24}
                </p>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{clocks.ist.dateLabel}</p>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 py-3 min-w-[148px]">
                <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                  <span>New York</span>
                  <span>{clocks.ny.offsetLabel.split(' ')[0]}</span>
                </div>
                <p className="mt-1 font-mono-num text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                  {clocks.ny.formatted24}
                </p>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{clocks.ny.dateLabel}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 4 KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="tb-glass rounded-2xl p-5">
          <p className="text-xs font-medium text-[var(--text-muted)]">Win Rate</p>
          <p className="mt-2 font-mono-num text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">
            {formatPct(kpis.winRate, false, 1)}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span className="tabular-nums">
              {kpis.wins}W / {kpis.losses}L / {kpis.breakeven}BE
            </span>
            <span className="font-mono-num font-semibold text-[var(--accent-text)]">
              PF {kpis.profitFactor.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="tb-glass rounded-2xl p-5">
          <p className="text-xs font-medium text-[var(--text-muted)]">Avg R-Multiple</p>
          <p
            className="mt-2 font-mono-num text-2xl sm:text-3xl font-bold"
            style={{ color: kpis.avgR >= 0 ? 'var(--positive)' : 'var(--negative)' }}
          >
            {formatR(kpis.avgR)}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>Best Trade ({kpis.bestTradeSymbol})</span>
            <span className="font-mono-num font-semibold" style={{ color: 'var(--positive)' }}>
              {formatMoney(kpis.bestTradePnl, settings.currency, settings.privacyMode, {
                signed: true,
              })}
            </span>
          </div>
        </div>

        <div className="tb-glass rounded-2xl p-5">
          <p className="text-xs font-medium text-[var(--text-muted)]">Total Funded Capital</p>
          <p className="mt-2 font-mono-num text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">
            {formatMoney(kpis.totalFundedCapital, settings.currency, settings.privacyMode, {
              decimals: 0,
            })}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>{accounts.length} Active Accounts</span>
            <span>
              {kpis.fundedCount} Funded · {kpis.evalCount} Eval
            </span>
          </div>
        </div>

        <div className="tb-glass rounded-2xl p-5">
          <p className="text-xs font-medium text-[var(--text-muted)]">Net Challenge ROI</p>
          <p
            className="mt-2 font-mono-num text-2xl sm:text-3xl font-bold"
            style={{ color: kpis.netRoiProfit >= 0 ? 'var(--positive)' : 'var(--negative)' }}
          >
            {formatMoney(kpis.netRoiProfit, settings.currency, settings.privacyMode, {
              signed: true,
              decimals: 0,
            })}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span className="tabular-nums">
              {formatMoney(kpis.totalPayouts, settings.currency, settings.privacyMode, {
                compact: true,
              })}{' '}
              vs{' '}
              {formatMoney(kpis.totalFees, settings.currency, settings.privacyMode, {
                compact: true,
              })}
            </span>
            <span
              className="font-mono-num font-semibold"
              style={{ color: kpis.roiPct >= 0 ? 'var(--positive)' : 'var(--negative)' }}
            >
              {formatPct(kpis.roiPct, true, 0)} ROI
            </span>
          </div>
        </div>
      </section>

      {/* Active Funded & Eval Accounts Grid */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Active Funded &amp; Eval Accounts
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Real-time drawdown floors, consistency cap tracking, and prop-firm rule buffers.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingAccount(null);
              setAccountModalOpen(true);
            }}
            className="tb-btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Account
          </button>
        </div>

        {accountMetricsList.length === 0 ? (
          <div className="tb-glass rounded-2xl p-8 text-center">
            <p className="text-sm font-medium text-[var(--text-primary)]">No prop accounts added yet</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Add your first Funded or Evaluation account to monitor drawdown floors automatically.
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingAccount(null);
                setAccountModalOpen(true);
              }}
              className="tb-btn-primary mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add First Account
            </button>
          </div>
        ) : (
          <div
            className={`grid gap-4 ${
              settings.compactAccounts
                ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
                : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'
            }`}
          >
            {accountMetricsList.map((m) => {
              const dailyColor = getDrawdownColorClass(m.dailyUsedPct);
              const maxColor = getDrawdownColorClass(m.maxDdUsedPct);
              const isDeleting = pendingDeleteId === m.account.id;
              const isEval = m.account.stage !== 'Funded';

              return (
                <article
                  key={m.account.id}
                  className={`tb-glass rounded-2xl flex flex-col justify-between ${
                    settings.compactAccounts ? 'p-4 space-y-3' : 'p-5 space-y-4'
                  }`}
                >
                  {/* Card Top Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                        <span className="font-semibold text-[var(--accent-text)]">
                          {m.account.firm}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{m.account.stage}</span>
                        <span aria-hidden="true">·</span>
                        <span>{m.account.drawdownType}</span>
                      </div>
                      <h3 className="mt-1 text-base font-bold text-[var(--text-primary)] truncate">
                        {m.account.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAccount(m.account);
                          setAccountModalOpen(true);
                        }}
                        aria-label={`Edit ${m.account.name}`}
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(isDeleting ? null : m.account.id)}
                        aria-label={`Delete ${m.account.name}`}
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* In-card delete confirm */}
                  {isDeleting && (
                    <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 flex items-center justify-between gap-2">
                      <span className="text-xs text-rose-300">Delete this account?</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteAccount(m.account.id);
                            setPendingDeleteId(null);
                          }}
                          className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white cursor-pointer"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(null)}
                          className="tb-btn-ghost rounded-lg px-2.5 py-1 text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Live Equity & Net P&L */}
                  <div className="flex items-baseline justify-between gap-2 pt-1 border-t border-[var(--border-subtle)]">
                    <div>
                      <span className="block text-[11px] text-[var(--text-muted)]">Live Equity</span>
                      <span className="font-mono-num text-xl font-bold text-[var(--text-primary)]">
                        {formatMoney(m.equity, settings.currency, settings.privacyMode)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="block text-[11px] text-[var(--text-muted)]">Net P&amp;L</span>
                      <span
                        className="font-mono-num text-sm font-semibold"
                        style={{ color: m.netPnl >= 0 ? 'var(--positive)' : 'var(--negative)' }}
                      >
                        {formatMoney(m.netPnl, settings.currency, settings.privacyMode, {
                          signed: true,
                        })}{' '}
                        ({formatPct(m.netPnlPct, true, 2)})
                      </span>
                    </div>
                  </div>

                  {/* Drawdown Progress Bars */}
                  <div className="space-y-3">
                    {/* Daily Drawdown */}
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-[var(--text-secondary)]">
                          Daily Drawdown{' '}
                          <span className={`font-medium ${dailyColor.text}`}>
                            ({m.dailyUsedPct.toFixed(0)}% · {dailyColor.label})
                          </span>
                        </span>
                        <span className="font-mono-num text-[11px] text-[var(--text-muted)]">
                          Floor:{' '}
                          {formatMoney(
                            m.dailyBreachFloor,
                            settings.currency,
                            settings.privacyMode,
                            { decimals: 0 }
                          )}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${dailyColor.bar}`}
                          style={{ width: `${Math.max(2, Math.min(100, m.dailyUsedPct))}%` }}
                        />
                      </div>
                    </div>

                    {/* Max Drawdown */}
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-[var(--text-secondary)]">
                          Max Drawdown{' '}
                          <span className={`font-medium ${maxColor.text}`}>
                            ({m.maxDdUsedPct.toFixed(0)}% · {maxColor.label})
                          </span>
                        </span>
                        <span className="font-mono-num text-[11px] text-[var(--text-muted)]">
                          Floor:{' '}
                          {formatMoney(
                            m.maxDdBreachFloor,
                            settings.currency,
                            settings.privacyMode,
                            { decimals: 0 }
                          )}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${maxColor.bar}`}
                          style={{ width: `${Math.max(2, Math.min(100, m.maxDdUsedPct))}%` }}
                        />
                      </div>
                    </div>

                    {/* Eval Profit Target Bar */}
                    {isEval && m.account.profitTarget && (
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-[var(--text-secondary)]">
                            Profit Target ({m.profitTargetPct.toFixed(0)}%)
                          </span>
                          <span className="font-mono-num text-[11px] text-[var(--text-muted)]">
                            Goal:{' '}
                            {formatMoney(
                              m.account.profitTarget,
                              settings.currency,
                              settings.privacyMode,
                              { decimals: 0 }
                            )}
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${Math.min(100, m.profitTargetPct)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Rule Compliance Strip */}
                  {!settings.compactAccounts && (
                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-xs">
                      <div>
                        <span className="text-[var(--text-muted)] block text-[11px]">
                          Min Trading Days
                        </span>
                        <span className="font-mono-num font-semibold text-[var(--text-primary)]">
                          {m.tradingDaysCount} / {m.account.minTradingDays} min
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[var(--text-muted)] block text-[11px]">
                          Consistency Cap
                        </span>
                        <span
                          className="font-mono-num font-semibold"
                          style={{
                            color:
                              m.consistencyPct > m.account.consistencyCapPct
                                ? 'var(--warning)'
                                : 'var(--text-primary)',
                          }}
                        >
                          {m.consistencyPct.toFixed(0)}% / {m.account.consistencyCapPct}%
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onQuickLogForAccount(m.account.id)}
                      className="tb-btn-primary flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold cursor-pointer"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      Log
                    </button>
                    <button
                      type="button"
                      onClick={() => onQuickPayoutForAccount(m.account.id)}
                      className="tb-btn-ghost flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium cursor-pointer"
                    >
                      <Wallet className="w-3.5 h-3.5" />
                      Payout
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Analytics Row: Performance Curve + Edge & Discipline Audit */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Performance Curve */}
        <div className="tb-glass lg:col-span-7 rounded-2xl p-5 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Performance Curve
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {chartMode === 'equity'
                  ? 'Cumulative realized P&L across all accounts'
                  : 'Daily net realized P&L distribution'}
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-1">
              <button
                type="button"
                onClick={() => setChartMode('equity')}
                className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                style={{
                  backgroundColor: chartMode === 'equity' ? 'var(--nav-pill)' : 'transparent',
                  color: chartMode === 'equity' ? 'var(--nav-pill-text)' : 'var(--text-secondary)',
                }}
              >
                Cumulative Equity
              </button>
              <button
                type="button"
                onClick={() => setChartMode('daily')}
                className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                style={{
                  backgroundColor: chartMode === 'daily' ? 'var(--nav-pill)' : 'transparent',
                  color: chartMode === 'daily' ? 'var(--nav-pill-text)' : 'var(--text-secondary)',
                }}
              >
                Daily P&amp;L
              </button>
            </div>
          </div>

          <div className="h-[290px] w-full">
            {chartSeries.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
                Log trades in the Journal to render your performance curve.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {chartMode === 'equity' ? (
                  <AreaChart data={chartSeries} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="tbEquityGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.36} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                    <XAxis
                      dataKey="label"
                      stroke="var(--chart-axis)"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="var(--chart-axis)"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) =>
                        settings.privacyMode ? '•••' : `${currencyPrefix}${v}`
                      }
                      width={64}
                    />
                    <ReferenceLine y={0} stroke="var(--border-strong)" strokeDasharray="4 4" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--bg-card-solid)',
                        border: '1px solid var(--border-strong)',
                        borderRadius: '12px',
                        color: 'var(--text-primary)',
                        fontSize: '12px',
                      }}
                      formatter={(val: unknown) => [
                        settings.privacyMode
                          ? `${currencyPrefix}•••••`
                          : `${currencyPrefix}${Number(val).toLocaleString()}`,
                        'Cumulative P&L',
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="displayCumulative"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      fill="url(#tbEquityGrad)"
                    />
                  </AreaChart>
                ) : (
                  <BarChart data={chartSeries} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                    <XAxis
                      dataKey="label"
                      stroke="var(--chart-axis)"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="var(--chart-axis)"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) =>
                        settings.privacyMode ? '•••' : `${currencyPrefix}${v}`
                      }
                      width={64}
                    />
                    <ReferenceLine y={0} stroke="var(--border-strong)" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--bg-card-solid)',
                        border: '1px solid var(--border-strong)',
                        borderRadius: '12px',
                        color: 'var(--text-primary)',
                        fontSize: '12px',
                      }}
                      formatter={(val: unknown) => [
                        settings.privacyMode
                          ? `${currencyPrefix}•••••`
                          : `${currencyPrefix}${Number(val).toLocaleString()}`,
                        'Daily P&L',
                      ]}
                    />
                    <Bar dataKey="displayDaily" radius={[6, 6, 0, 0]}>
                      {chartSeries.map((entry, idx) => (
                        <Cell
                          key={`cell-${idx}`}
                          fill={entry.displayDaily >= 0 ? '#10b981' : '#f43f5e'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Edge & Discipline Audit */}
        <div className="tb-glass lg:col-span-5 rounded-2xl p-5 flex flex-col justify-between space-y-5">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Edge &amp; Discipline Audit
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Playbook setup profitability &amp; exact cost of breaking rules.
            </p>

            {/* Setup P&L Breakdown */}
            <div className="mt-4 space-y-3">
              {audit.setups.map((s) => (
                <div
                  key={s.setup}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      {s.setup}
                    </span>
                    <span
                      className="font-mono-num text-sm font-bold"
                      style={{ color: s.netPnl >= 0 ? 'var(--positive)' : 'var(--negative)' }}
                    >
                      {formatMoney(s.netPnl, settings.currency, settings.privacyMode, {
                        signed: true,
                      })}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span className="tabular-nums">
                      {s.trades} trades · {s.winRate.toFixed(0)}% WR · Avg {formatR(s.avgR)}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${Math.min(100, s.winRate)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cost of Rule-Breaking */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                Cost of Rule-Breaking
              </span>
              <span className="font-mono-num text-xs font-semibold text-[var(--accent-text)]">
                {audit.compliancePct.toFixed(0)}% Rule Compliance
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-[var(--positive-soft)] p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--positive)' }}>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Rules Followed ({audit.followedCount})
                </div>
                <p
                  className="mt-1 font-mono-num text-base font-bold"
                  style={{ color: 'var(--positive)' }}
                >
                  {formatMoney(audit.followedPnl, settings.currency, settings.privacyMode, {
                    signed: true,
                  })}
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {audit.followedWinRate.toFixed(0)}% Win Rate
                </p>
              </div>

              <div className="rounded-lg bg-[var(--negative-soft)] p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--negative)' }}>
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Rule Broken ({audit.brokenCount})
                </div>
                <p
                  className="mt-1 font-mono-num text-base font-bold"
                  style={{ color: 'var(--negative)' }}
                >
                  {formatMoney(audit.brokenPnl, settings.currency, settings.privacyMode, {
                    signed: true,
                  })}
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {audit.brokenWinRate.toFixed(0)}% Win Rate
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <AccountModal
        open={accountModalOpen}
        editingAccount={editingAccount}
        onClose={() => setAccountModalOpen(false)}
        onSave={onSaveAccount}
      />
    </div>
  );
};
