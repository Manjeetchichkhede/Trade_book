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
import { Clock, ShieldAlert, ShieldCheck } from 'lucide-react';
import { AnalogDial, CLOCK_STYLES } from './AnalogDial';
import {
  AppSettings,
  ClockStyleId,
  PropAccount,
  RoiEntry,
  TabId,
  Trade,
} from '../types';
import {
  buildPerformanceCurve,
  computeDisciplineAudit,
  computePortfolioKpis,
} from '../utils/calculations';
import { formatMoney, formatPct, formatR, USD_TO_INR } from '../utils/format';
import { getActiveSessionHeadline, getIstAndNyClocks } from '../utils/sessions';

interface OverviewTabProps {
  accounts: PropAccount[];
  trades: Trade[];
  roiEntries: RoiEntry[];
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onNavigateTab: (tab: TabId) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  accounts,
  trades,
  roiEntries,
  settings,
  onUpdateSettings,
  onNavigateTab,
}) => {
  const [now, setNow] = useState<Date>(() => new Date());
  const [chartMode, setChartMode] = useState<'equity' | 'daily'>('equity');

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
                Welcome back, {settings.traderName || 'Trader'}
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

          </div>

          {/* Live Ticking IST & NY Clocks with Inline Design Switcher */}
          {settings.liveClocksOverview && (
            <div className="space-y-2.5 lg:w-auto shrink-0">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                  <Clock className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                  Clock Design
                </span>
                <select
                  aria-label="Overview Clock Design"
                  value={settings.clockStyle}
                  onChange={(e) =>
                    onUpdateSettings({ clockStyle: e.target.value as ClockStyleId })
                  }
                  className="tb-input rounded-lg px-2.5 py-1 text-[11px] font-medium cursor-pointer"
                >
                  {CLOCK_STYLES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'India (IST)', tzTag: 'UTC+5:30', clock: clocks.ist },
                  {
                    label: 'New York',
                    tzTag: clocks.ny.offsetLabel.split(' ')[0],
                    clock: clocks.ny,
                  },
                ].map(({ label, tzTag, clock }) => (
                  <div
                    key={label}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 py-3 flex flex-col items-center text-center min-w-[144px]"
                  >
                    <div className="flex items-center justify-between w-full text-[10px] text-[var(--text-muted)] mb-1.5">
                      <span className="font-semibold text-[var(--text-secondary)]">{label}</span>
                      <span>{tzTag}</span>
                    </div>

                    {settings.clockStyle === 'digital' ? (
                      <div className="flex flex-col items-center justify-center h-24 sm:h-28 w-full">
                        <p className="font-mono-num text-2xl sm:text-[26px] font-bold tracking-tight text-[var(--text-primary)] whitespace-nowrap">
                          {clock.formatted24}
                        </p>
                        <p className="mt-1 font-mono-num text-[11px] font-semibold text-[var(--accent-text)] whitespace-nowrap">
                          {clock.formatted12} {clock.ampm}
                        </p>
                      </div>
                    ) : (
                      <>
                        <AnalogDial
                          clock={clock}
                          styleId={settings.clockStyle}
                          sizeClass="w-24 h-24 sm:w-28 sm:h-28"
                        />
                        <p
                          className="mt-1.5 font-mono-num text-[11px] font-semibold whitespace-nowrap"
                          style={{
                            color:
                              settings.clockStyle === 'neon'
                                ? '#38bdf8'
                                : 'var(--text-primary)',
                          }}
                        >
                          {clock.formatted12} {clock.ampm}
                        </p>
                      </>
                    )}
                    <p className="text-[10px] text-[var(--text-muted)]">{clock.dateLabel}</p>
                  </div>
                ))}
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

        <button
          type="button"
          onClick={() => onNavigateTab('accounts')}
          className="tb-glass rounded-2xl p-5 text-left transition-colors hover:border-[var(--accent)] cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-[var(--text-muted)]">Total Funded Capital</p>
            <span className="text-[11px] font-semibold text-[var(--accent-text)]">Manage →</span>
          </div>
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
        </button>

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
    </div>
  );
};
