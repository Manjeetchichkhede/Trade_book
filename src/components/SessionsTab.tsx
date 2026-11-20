import React, { useEffect, useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import { AppSettings, ClockStyleId, DstMode } from '../types';
import {
  evaluateSessions,
  getIstAndNyClocks,
  ZonedClock,
} from '../utils/sessions';

interface SessionsTabProps {
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
}

const CLOCK_STYLES: { id: ClockStyleId; label: string }[] = [
  { id: 'roman', label: 'Roman Classic' },
  { id: 'modern', label: 'Modern Minimal' },
  { id: 'neon', label: 'Neon Terminal' },
  { id: 'digital', label: 'Digital Only' },
];

const DST_OPTIONS: { id: DstMode; label: string }[] = [
  { id: 'auto', label: 'Auto DST' },
  { id: 'winter', label: 'Winter (UTC-5)' },
  { id: 'summer', label: 'Summer (UTC-4)' },
];

type WindowFilter = 'all' | 'live' | 'killzones' | 'silver-bullet';

const ROMAN_NUMERALS = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

const AnalogDial: React.FC<{ clock: ZonedClock; styleId: ClockStyleId }> = ({
  clock,
  styleId,
}) => {
  const secDeg = clock.seconds * 6;
  const minDeg = clock.minutes * 6 + clock.seconds * 0.1;
  const hrDeg = (clock.hours % 12) * 30 + clock.minutes * 0.5;

  const isNeon = styleId === 'neon';
  const isRoman = styleId === 'roman';

  return (
    <svg viewBox="0 0 180 180" className="w-36 h-36 sm:w-40 sm:h-40 shrink-0">
      {/* Outer Rim */}
      <circle
        cx="90"
        cy="90"
        r="84"
        fill={isNeon ? 'rgba(6, 12, 26, 0.92)' : 'var(--bg-input)'}
        stroke={isNeon ? '#38bdf8' : 'var(--border-strong)'}
        strokeWidth={isNeon ? '2.5' : '2'}
      />
      {isNeon && (
        <circle
          cx="90"
          cy="90"
          r="76"
          fill="none"
          stroke="#3b82f6"
          strokeOpacity="0.35"
          strokeDasharray="4 4"
          strokeWidth="1.5"
        />
      )}

      {/* Hour markers / Roman numerals */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i * 30 - 90) * (Math.PI / 180);
        if (isRoman) {
          const tx = 90 + Math.cos(angle) * 65;
          const ty = 90 + Math.sin(angle) * 65 + 4;
          return (
            <text
              key={i}
              x={tx}
              y={ty}
              textAnchor="middle"
              fontSize="10.5"
              fontWeight="600"
              fontFamily="Georgia, serif"
              fill="var(--text-secondary)"
            >
              {ROMAN_NUMERALS[i]}
            </text>
          );
        }
        const r1 = i % 3 === 0 ? 66 : 71;
        const r2 = 77;
        return (
          <line
            key={i}
            x1={90 + Math.cos(angle) * r1}
            y1={90 + Math.sin(angle) * r1}
            x2={90 + Math.cos(angle) * r2}
            y2={90 + Math.sin(angle) * r2}
            stroke={
              isNeon
                ? i % 3 === 0
                  ? '#38bdf8'
                  : '#1e40af'
                : i % 3 === 0
                ? 'var(--text-primary)'
                : 'var(--text-muted)'
            }
            strokeWidth={i % 3 === 0 ? '2.4' : '1.3'}
            strokeLinecap="round"
          />
        );
      })}

      {/* Hour Hand */}
      <line
        x1="90"
        y1="90"
        x2="90"
        y2="46"
        stroke={isNeon ? '#e0f2fe' : 'var(--text-primary)'}
        strokeWidth={isRoman ? '3.5' : '4'}
        strokeLinecap="round"
        transform={`rotate(${hrDeg} 90 90)`}
      />

      {/* Minute Hand */}
      <line
        x1="90"
        y1="90"
        x2="90"
        y2="30"
        stroke={isNeon ? '#38bdf8' : 'var(--text-secondary)'}
        strokeWidth="2.6"
        strokeLinecap="round"
        transform={`rotate(${minDeg} 90 90)`}
      />

      {/* Second Hand */}
      <line
        x1="90"
        y1="102"
        x2="90"
        y2="24"
        stroke={isNeon ? '#10b981' : '#3b82f6'}
        strokeWidth="1.5"
        strokeLinecap="round"
        transform={`rotate(${secDeg} 90 90)`}
      />

      {/* Center Cap */}
      <circle cx="90" cy="90" r="4" fill={isNeon ? '#10b981' : '#3b82f6'} />
    </svg>
  );
};

export const SessionsTab: React.FC<SessionsTabProps> = ({ settings, onUpdateSettings }) => {
  const [now, setNow] = useState<Date>(() => new Date());
  const [filter, setFilter] = useState<WindowFilter>('all');

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
      if (filter === 'killzones') return s.def.category === 'killzone';
      if (filter === 'silver-bullet') return s.def.category === 'silver-bullet';
      return true;
    });
  }, [evaluatedSessions, filter]);

  // Helper to split a session interval into 1 or 2 timeline segments (handles crossing midnight in IST)
  const timelineBands = useMemo(() => {
    const bands: { id: string; label: string; color: string; leftPct: number; widthPct: number }[] =
      [];
    for (const s of evaluatedSessions) {
      if (s.def.id === 'asian-killzone') continue; // avoid cluttering over Asian session
      const start = s.istStartMin;
      const end = s.istEndMin;
      if (end > start) {
        bands.push({
          id: s.def.id,
          label: s.def.shortLabel,
          color: s.def.color,
          leftPct: (start / 1440) * 100,
          widthPct: ((end - start) / 1440) * 100,
        });
      } else {
        bands.push({
          id: `${s.def.id}-a`,
          label: s.def.shortLabel,
          color: s.def.color,
          leftPct: (start / 1440) * 100,
          widthPct: ((1440 - start) / 1440) * 100,
        });
        if (end > 0) {
          bands.push({
            id: `${s.def.id}-b`,
            label: s.def.shortLabel,
            color: s.def.color,
            leftPct: 0,
            widthPct: (end / 1440) * 100,
          });
        }
      }
    }
    return bands;
  }, [evaluatedSessions]);

  const istMarkerPct = (clocks.ist.totalMinutes / 1440) * 100;

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
                  settings.clockStyle === 'digital' ? 'w-full text-center py-4' : 'text-center sm:text-left flex-1'
                }`}
              >
                <div className="flex items-center justify-center sm:justify-start gap-2 text-xs text-[var(--text-muted)]">
                  <Clock className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                  <span className="font-semibold text-[var(--text-secondary)]">{title}</span>
                </div>
                <p
                  className={`font-mono-num font-bold tracking-tight ${
                    settings.clockStyle === 'digital' ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl'
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

        {/* 24-Hour IST Session Timeline Bar */}
        <div className="space-y-2.5 pt-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--text-primary)]">
              24-Hour IST Session Timeline
            </span>
            <span className="font-mono-num text-[var(--accent-text)]">
              Live Now: {clocks.ist.formatted24} IST
            </span>
          </div>

          <div className="relative h-12 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] overflow-hidden">
            {timelineBands.map((b) => (
              <div
                key={b.id}
                title={b.label}
                className="absolute top-1.5 bottom-1.5 rounded-md flex items-center justify-center overflow-hidden px-1"
                style={{
                  left: `${b.leftPct}%`,
                  width: `${Math.max(b.widthPct, 2)}%`,
                  backgroundColor: `${b.color}33`,
                  border: `1px solid ${b.color}88`,
                }}
              >
                <span className="text-[10px] font-semibold text-[var(--text-primary)] truncate">
                  {b.label}
                </span>
              </div>
            ))}

            {/* Live Marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] z-10"
              style={{ left: `${istMarkerPct}%` }}
            >
              <span className="absolute -top-0.5 -left-1.5 h-3 w-3 rounded-full bg-blue-500 border-2 border-white" />
            </div>
          </div>

          <div className="flex items-center justify-between font-mono-num text-[10px] text-[var(--text-muted)]">
            <span>00:00</span>
            <span>04:00</span>
            <span>08:00</span>
            <span>12:00</span>
            <span>16:00</span>
            <span>20:00</span>
            <span>24:00 IST</span>
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
