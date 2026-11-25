import React, { useEffect, useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import { AppSettings, ClockStyleId, DstMode } from '../types';
import { evaluateSessions, getIstAndNyClocks } from '../utils/sessions';
import { AnalogDial, CLOCK_STYLES } from './AnalogDial';

interface SessionsTabProps {
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
}

const DST_OPTIONS: { id: DstMode; label: string }[] = [
  { id: 'auto', label: 'Auto DST' },
  { id: 'winter', label: 'Winter (UTC-5)' },
  { id: 'summer', label: 'Summer (UTC-4)' },
];

type WindowFilter = 'all' | 'live' | 'sessions' | 'killzones' | 'silver-bullet';
type TimelineTz = 'ist' | 'ny';

const HOUR_TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

function getTrackSegments(startMin: number, endMin: number): { leftPct: number; widthPct: number }[] {
  const s = ((startMin % 1440) + 1440) % 1440;
  const e = ((endMin % 1440) + 1440) % 1440;
  if (e === 0 && s > 0) {
    return [{ leftPct: (s / 1440) * 100, widthPct: ((1440 - s) / 1440) * 100 }];
  }
  if (e > s) {
    return [{ leftPct: (s / 1440) * 100, widthPct: ((e - s) / 1440) * 100 }];
  }
  // Wraps across midnight: split into [s..1440] and [0..e]
  return [
    { leftPct: (s / 1440) * 100, widthPct: ((1440 - s) / 1440) * 100 },
    { leftPct: 0, widthPct: (e / 1440) * 100 },
  ];
}

export const SessionsTab: React.FC<SessionsTabProps> = ({ settings, onUpdateSettings }) => {
  const [now, setNow] = useState<Date>(() => new Date());
  const [filter, setFilter] = useState<WindowFilter>('all');
  const [timelineTz, setTimelineTz] = useState<TimelineTz>('ist');

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const clocks = useMemo(() => getIstAndNyClocks(now, settings.dstMode), [now, settings.dstMode]);
  const evaluatedSessions = useMemo(
    () => evaluateSessions(now, settings.dstMode),
    [now, settings.dstMode]
  );

  const filteredSessions = useMemo(() => {
    return evaluatedSessions.filter((s) => {
      if (filter === 'live') return s.isLive;
      if (filter === 'sessions') return s.def.category === 'session';
      if (filter === 'killzones') return s.def.category === 'killzone';
      if (filter === 'silver-bullet') return s.def.category === 'silver-bullet';
      return true;
    });
  }, [evaluatedSessions, filter]);

  const activeClock = timelineTz === 'ist' ? clocks.ist : clocks.ny;
  const nowPct = (activeClock.totalMinutes / 1440) * 100;

  return (
    <div className="space-y-6">
      {/* Live Trading Clocks Card */}
      <section className="tb-glass rounded-2xl p-5 sm:p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-[var(--border-subtle)]">
          <div>
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">
              Live Trading Clocks &amp; Killzones
            </h1>
            <p className="text-xs text-[var(--text-muted)]">
              Synchronized India (IST) &amp; New York institutional clocks with live DST alignment.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* NY DST Mode Switcher */}
            <div className="flex items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-1">
              {DST_OPTIONS.map((opt) => {
                const active = settings.dstMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onUpdateSettings({ dstMode: opt.id })}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                    style={{
                      backgroundColor: active ? 'var(--nav-pill)' : 'transparent',
                      color: active ? 'var(--nav-pill-text)' : 'var(--text-secondary)',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Clock Style Selector */}
            <select
              aria-label="Clock Style"
              value={settings.clockStyle}
              onChange={(e) => onUpdateSettings({ clockStyle: e.target.value as ClockStyleId })}
              className="tb-input rounded-xl px-3 py-2 text-xs font-medium"
            >
              {CLOCK_STYLES.map((c) => (
                <option key={c.id} value={c.id}>
                  Clock: {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Synchronized IST & NY Clocks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[
            { title: 'India Standard Time', zone: clocks.ist },
            { title: 'New York Market Time', zone: clocks.ny },
          ].map(({ title, zone }) => (
            <div
              key={title}
              className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-5 flex flex-col sm:flex-row items-center justify-between gap-5"
            >
              {settings.clockStyle !== 'digital' && (
                <AnalogDial clock={zone} styleId={settings.clockStyle} />
              )}

              <div
                className={`space-y-1.5 ${
                  settings.clockStyle === 'digital'
                    ? 'w-full text-center py-4'
                    : 'text-center sm:text-left flex-1'
                }`}
              >
                <div className="flex items-center justify-center sm:justify-start gap-2 text-xs text-[var(--text-muted)]">
                  <Clock className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                  <span className="font-semibold text-[var(--text-secondary)]">{title}</span>
                </div>
                <p
                  className={`font-mono-num font-bold tracking-tight ${
                    settings.clockStyle === 'digital'
                      ? 'text-4xl sm:text-5xl'
                      : 'text-3xl sm:text-4xl'
                  }`}
                  style={{
                    color: settings.clockStyle === 'neon' ? '#38bdf8' : 'var(--text-primary)',
                  }}
                >
                  {zone.formatted24}
                </p>
                <p className="font-mono-num text-xs text-[var(--text-secondary)]">
                  {zone.formatted12} {zone.ampm} · {zone.offsetLabel}
                </p>
                <p className="text-xs text-[var(--text-muted)]">{zone.dateLabel}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Minimalistic 24H Session Timeline */}
      <section className="tb-glass rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              24H Session Timeline
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Live {timelineTz === 'ist' ? 'IST (UTC+5:30)' : clocks.ny.offsetLabel} window map ·
              Current time{' '}
              <span className="font-mono-num font-semibold text-[var(--accent-text)]">
                {activeClock.formatted24.slice(0, 5)} {timelineTz.toUpperCase()}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-1">
            {(
              [
                { id: 'ist', label: 'IST 24H' },
                { id: 'ny', label: 'NY 24H' },
              ] as const
            ).map((opt) => {
              const active = timelineTz === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTimelineTz(opt.id)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                  style={{
                    backgroundColor: active ? 'var(--nav-pill)' : 'transparent',
                    color: active ? 'var(--nav-pill-text)' : 'var(--text-secondary)',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Hour Axis + Minimalistic Track Bars */}
        <div className="overflow-x-auto pb-1">
          <div className="min-w-[540px] space-y-2">
            {/* Hour Tick Header */}
            <div className="grid grid-cols-12 items-center gap-3">
              <div className="col-span-3 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Window
              </div>
              <div className="col-span-9 relative h-5">
                {HOUR_TICKS.map((hr) => (
                  <span
                    key={hr}
                    className="absolute top-0 -translate-x-1/2 font-mono-num text-[10px] text-[var(--text-muted)]"
                    style={{
                      left: `${(hr / 24) * 100}%`,
                      transform:
                        hr === 0
                          ? 'translateX(0)'
                          : hr === 24
                          ? 'translateX(-100%)'
                          : 'translateX(-50%)',
                    }}
                  >
                    {String(hr).padStart(2, '0')}
                  </span>
                ))}
              </div>
            </div>

            {/* Session Tracks */}
            <div className="space-y-1.5">
              {evaluatedSessions.map((item) => {
                const startMin = timelineTz === 'ist' ? item.istStartMin : item.nyStartMin;
                const endMin = timelineTz === 'ist' ? item.istEndMin : item.nyEndMin;
                const segments = getTrackSegments(startMin, endMin);
                const rangeLabel = timelineTz === 'ist' ? item.istRangeText : item.nyRangeText;

                return (
                  <div
                    key={item.def.id}
                    className="grid grid-cols-12 items-center gap-3 group"
                    title={`${item.def.name}: ${item.istRangeText} | ${item.nyRangeText}`}
                  >
                    <div className="col-span-3 flex items-center justify-between gap-1.5 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{
                            backgroundColor: item.def.color,
                            opacity: item.isLive ? 1 : 0.65,
                          }}
                        />
                        <span
                          className={`text-xs truncate ${
                            item.isLive
                              ? 'font-semibold text-[var(--text-primary)]'
                              : 'font-medium text-[var(--text-secondary)]'
                          }`}
                        >
                          {item.def.shortLabel}
                        </span>
                      </div>
                      <span className="hidden sm:inline font-mono-num text-[10px] text-[var(--text-muted)] whitespace-nowrap shrink-0">
                        {rangeLabel.replace(/ (IST|NY)$/, '')}
                      </span>
                    </div>

                    <div className="col-span-9 relative h-5 rounded-md bg-[var(--bg-input)] border border-[var(--border-subtle)] overflow-hidden">
                      {/* Subtle 6h grid dividers */}
                      {[25, 50, 75].map((pct) => (
                        <div
                          key={pct}
                          className="pointer-events-none absolute top-0 bottom-0 w-px bg-[var(--border-subtle)] opacity-60"
                          style={{ left: `${pct}%` }}
                        />
                      ))}

                      {/* Session Segment Bars */}
                      {segments.map((seg, idx) => (
                        <div
                          key={idx}
                          className="absolute top-1 bottom-1 rounded-sm transition-opacity"
                          style={{
                            left: `${seg.leftPct}%`,
                            width: `${seg.widthPct}%`,
                            backgroundColor: item.def.color,
                            opacity: item.isLive ? 0.92 : 0.36,
                          }}
                        />
                      ))}

                      {/* Live NOW Vertical Marker */}
                      <div
                        className="pointer-events-none absolute top-0 bottom-0 w-[2px] z-10"
                        style={{
                          left: `${nowPct}%`,
                          backgroundColor: 'var(--text-primary)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Session & Killzone Cards */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Session &amp; Killzone Windows
          </h2>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', label: 'All Windows' },
                { id: 'live', label: 'Live Now' },
                { id: 'sessions', label: 'Sessions' },
                { id: 'killzones', label: 'Killzones' },
                { id: 'silver-bullet', label: 'Silver Bullet' },
              ] as { id: WindowFilter; label: string }[]
            ).map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className="rounded-full px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer whitespace-nowrap"
                  style={{
                    backgroundColor: active ? 'var(--nav-pill)' : 'var(--bg-card)',
                    color: active ? 'var(--nav-pill-text)' : 'var(--text-secondary)',
                    border: active ? '1px solid transparent' : '1px solid var(--border-subtle)',
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {filteredSessions.length === 0 ? (
          <div className="tb-glass rounded-2xl p-8 text-center">
            <p className="text-sm font-medium text-[var(--text-primary)]">
              No windows currently active right now
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Switch back to &ldquo;All Windows&rdquo; to view exact IST &amp; NY countdowns.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredSessions.map((item) => (
              <article
                key={item.def.id}
                className="tb-glass rounded-2xl p-5 flex flex-col justify-between space-y-4"
                style={{
                  borderColor: item.isLive ? item.def.color : 'var(--border-subtle)',
                }}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-bold text-[var(--text-primary)]">
                      {item.def.name}
                    </h3>
                    {item.isLive ? (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap shrink-0"
                        style={{
                          backgroundColor: 'var(--positive-soft)',
                          color: 'var(--positive)',
                        }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        LIVE NOW
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-[var(--text-muted)] whitespace-nowrap">
                        Upcoming
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    {item.def.note}
                  </p>
                </div>

                {/* Exact IST & NY Windows */}
                <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-3 text-xs">
                  <div>
                    <span className="block text-[10px] text-[var(--text-muted)]">India (IST)</span>
                    <span className="font-mono-num font-semibold text-[var(--text-primary)]">
                      {item.istRangeText}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10px] text-[var(--text-muted)]">New York</span>
                    <span className="font-mono-num font-semibold text-[var(--text-secondary)]">
                      {item.nyRangeText}
                    </span>
                  </div>
                </div>

                {/* Key Pairs & Live Countdown */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--border-subtle)] text-xs">
                  <span className="font-mono-num text-[11px] text-[var(--text-muted)] truncate">
                    {item.def.keyPairs.join(' · ')}
                  </span>
                  <span className="font-mono-num font-semibold whitespace-nowrap shrink-0 text-[var(--accent-text)]">
                    {item.countdownLabel} {item.countdownText}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
