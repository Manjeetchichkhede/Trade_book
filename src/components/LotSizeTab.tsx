import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import {
  INSTRUMENT_CATEGORIES,
  INSTRUMENTS,
  InstrumentCategory,
} from '../data/instruments';
import { AppSettings, PropAccount, Trade } from '../types';
import { computeAccountMetrics } from '../utils/calculations';
import { formatMoney } from '../utils/format';

interface LotSizeTabProps {
  accounts: PropAccount[];
  trades: Trade[];
  settings: AppSettings;
}

const RISK_PRESETS = [0.25, 0.5, 1.0, 2.0];

export const LotSizeTab: React.FC<LotSizeTabProps> = ({ accounts, trades, settings }) => {
  const [category, setCategory] = useState<InstrumentCategory>('All');
  const [symbol, setSymbol] = useState<string>('XAUUSD');
  const [balance, setBalance] = useState<string>('100000');
  const [riskPct, setRiskPct] = useState<number>(0.5);
  const [mode, setMode] = useState<'pips' | 'price'>('pips');

  // Pips / Points mode inputs
  const [stopDistance, setStopDistance] = useState<string>('35');
  const [targetDistance, setTargetDistance] = useState<string>('105');

  // Price Levels mode inputs
  const [entryPrice, setEntryPrice] = useState<string>('2685.50');
  const [slPrice, setSlPrice] = useState<string>('2682.00');
  const [tpPrice, setTpPrice] = useState<string>('2696.00');

  const filteredInstruments = useMemo(
    () =>
      category === 'All'
        ? INSTRUMENTS
        : INSTRUMENTS.filter((inst) => inst.category === category),
    [category]
  );

  const spec = useMemo(
    () => INSTRUMENTS.find((i) => i.symbol === symbol) ?? INSTRUMENTS[0],
    [symbol]
  );

  const accountEquities = useMemo(
    () =>
      accounts.map((acc) => {
        const m = computeAccountMetrics(acc, trades);
        return { id: acc.id, name: acc.name, equity: Math.round(m.equity) };
      }),
    [accounts, trades]
  );

  const selectInstrument = (nextSymbol: string) => {
    setSymbol(nextSymbol);
    const nextSpec = INSTRUMENTS.find((i) => i.symbol === nextSymbol);
    if (!nextSpec) return;
    setStopDistance(String(nextSpec.defaultStopDistance));
    setTargetDistance(String(nextSpec.defaultTargetDistance));
    const entry = nextSpec.sampleEntry;
    const sl = entry - nextSpec.defaultStopDistance * nextSpec.pipSize;
    const tp = entry + nextSpec.defaultTargetDistance * nextSpec.pipSize;
    setEntryPrice(entry.toFixed(nextSpec.decimals));
    setSlPrice(sl.toFixed(nextSpec.decimals));
    setTpPrice(tp.toFixed(nextSpec.decimals));
  };

  // Core Position Sizing Math
  const calc = useMemo(() => {
    const bal = Math.max(0, Number(balance) || 0);
    const riskUsd = bal * (riskPct / 100);

    let effectiveStopPips = 0;
    let effectiveTargetPips = 0;
    let direction: 'Long' | 'Short' | 'Neutral' = 'Neutral';

    if (mode === 'pips') {
      effectiveStopPips = Math.max(0, Number(stopDistance) || 0);
      effectiveTargetPips = Math.max(0, Number(targetDistance) || 0);
    } else {
      const e = Number(entryPrice) || 0;
      const sl = Number(slPrice) || 0;
      const tp = Number(tpPrice) || 0;
      if (e > 0 && sl > 0 && e !== sl) {
        direction = e > sl ? 'Long' : 'Short';
        effectiveStopPips = Math.abs(e - sl) / spec.pipSize;
        if (tp > 0) {
          const favorable = direction === 'Long' ? tp - e : e - tp;
          effectiveTargetPips = Math.max(0, favorable / spec.pipSize);
        }
      }
    }

    const denom = effectiveStopPips * spec.usdPerPipPerStandardLot;
    const rawLots = denom > 0 ? riskUsd / denom : 0;
    const recommendedLots = Math.max(0, Math.floor(rawLots * 100) / 100);
    const rrRatio = effectiveStopPips > 0 ? effectiveTargetPips / effectiveStopPips : 0;
    const rewardUsd = riskUsd * rrRatio;

    // Prop-firm consecutive-loss safety guardrail (standard 5% Daily / 10% Max DD)
    const lossesToDaily5 = riskPct > 0 ? Math.floor(5 / riskPct) : 0;
    const lossesToMax10 = riskPct > 0 ? Math.floor(10 / riskPct) : 0;

    return {
      riskUsd,
      rewardUsd,
      effectiveStopPips,
      effectiveTargetPips,
      recommendedLots,
      miniLots: recommendedLots * 10,
      microLots: recommendedLots * 100,
      rrRatio,
      direction,
      lossesToDaily5,
      lossesToMax10,
    };
  }, [balance, riskPct, mode, stopDistance, targetDistance, entryPrice, slPrice, tpPrice, spec]);

  const guardrailTone =
    riskPct > 1.5
      ? {
          label: 'High Risk — Aggressive Prop Exposure',
          color: 'var(--negative)',
          bg: 'var(--negative-soft)',
          Icon: ShieldAlert,
        }
      : riskPct > 0.75
      ? {
          label: 'Moderate Risk — Standard Eval Pace',
          color: 'var(--warning)',
          bg: 'var(--warning-soft)',
          Icon: AlertTriangle,
        }
      : {
          label: 'Institutional Guardrail — Funded Safe',
          color: 'var(--positive)',
          bg: 'var(--positive-soft)',
          Icon: CheckCircle2,
        };

  return (
    <div className="space-y-5">
      {/* Top Row: Section 1 & Section 2 side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        {/* Section 1: Instrument & Account Capital */}
        <section className="tb-glass rounded-2xl p-5 sm:p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div>
              <h1 className="text-base font-semibold text-[var(--text-primary)]">
                1. Instrument &amp; Account Capital
              </h1>
              <p className="text-xs text-[var(--text-muted)]">
                Select asset class, instrument, or load live equity from an active prop account.
              </p>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-1.5">
              {INSTRUMENT_CATEGORIES.map((cat) => {
                const active = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className="rounded-full px-3 py-1.5 text-xs font-medium transition-all cursor-pointer whitespace-nowrap"
                    style={{
                      backgroundColor: active ? 'var(--nav-pill)' : 'var(--bg-input)',
                      color: active ? 'var(--nav-pill-text)' : 'var(--text-secondary)',
                      border: active ? '1px solid transparent' : '1px solid var(--border-subtle)',
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Instrument Dropdown + Quick Chips */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-medium text-[var(--text-secondary)]">Instrument</label>
                <span className="font-mono-num text-[11px] text-[var(--text-muted)]">
                  ${spec.usdPerPipPerStandardLot}/{spec.unitLabel.slice(0, -1).toLowerCase()} per 1.0{' '}
                  {spec.sizeUnit.slice(0, -1).toLowerCase()}
                </span>
              </div>

              <select
                value={symbol}
                onChange={(e) => selectInstrument(e.target.value)}
                className="tb-input w-full rounded-xl px-3.5 py-2.5 text-sm font-semibold"
              >
                {INSTRUMENTS.map((inst) => (
                  <option key={inst.symbol} value={inst.symbol}>
                    {inst.symbol} — {inst.name} ({inst.category})
                  </option>
                ))}
              </select>

              <div className="flex flex-wrap gap-1.5">
                {filteredInstruments.map((inst) => {
                  const active = inst.symbol === symbol;
                  return (
                    <button
                      key={inst.symbol}
                      type="button"
                      onClick={() => selectInstrument(inst.symbol)}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-mono-num font-semibold transition-all cursor-pointer"
                      style={{
                        backgroundColor: active ? 'var(--accent-soft)' : 'var(--bg-input)',
                        border: active
                          ? '1px solid var(--accent)'
                          : '1px solid var(--border-subtle)',
                        color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
                      }}
                    >
                      {inst.symbol}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Account Balance Loader & Input */}
          <div className="space-y-2.5 pt-4 border-t border-[var(--border-subtle)]">
            <label className="block text-xs font-medium text-[var(--text-secondary)]">
              Account Balance (USD)
            </label>
            {accountEquities.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {accountEquities.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setBalance(String(acc.equity))}
                    className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--text-primary)] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {acc.name}:{' '}
                    <span className="font-mono-num font-semibold text-[var(--accent-text)]">
                      {formatMoney(acc.equity, settings.currency, settings.privacyMode, {
                        decimals: 0,
                      })}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <input
              type="number"
              min="100"
              step="100"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              className="tb-input font-mono-num w-full rounded-xl px-4 py-3 text-base font-bold"
            />
          </div>
        </section>

        {/* Section 2: Risk Parameters & Stop Distance */}
        <section className="tb-glass rounded-2xl p-5 sm:p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                2. Risk Parameters &amp; Stop Distance
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Dial in risk percentage and compute stop distance via {spec.unitLabel} or exact Price
                Levels.
              </p>
            </div>

            {/* Risk % Slider + Presets */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  Risk Per Trade
                </span>
                <span className="font-mono-num text-base font-bold text-[var(--accent-text)]">
                  {riskPct.toFixed(2)}% (
                  {formatMoney(calc.riskUsd, settings.currency, settings.privacyMode)})
                </span>
              </div>

              <input
                type="range"
                min="0.1"
                max="3.0"
                step="0.05"
                value={riskPct}
                onChange={(e) => setRiskPct(Number(e.target.value))}
                className="tb-range w-full"
              />

              <div className="grid grid-cols-4 gap-2">
                {RISK_PRESETS.map((preset) => {
                  const active = Math.abs(riskPct - preset) < 0.001;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRiskPct(preset)}
                      className="rounded-xl py-2 text-xs font-mono-num font-semibold transition-all cursor-pointer"
                      style={{
                        backgroundColor: active ? 'var(--nav-pill)' : 'var(--bg-input)',
                        color: active ? 'var(--nav-pill-text)' : 'var(--text-secondary)',
                        border: active
                          ? '1px solid transparent'
                          : '1px solid var(--border-subtle)',
                      }}
                    >
                      {preset}%
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mode Toggle: Pips/Points vs Price Levels */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-1">
                <button
                  type="button"
                  onClick={() => setMode('pips')}
                  className="rounded-lg py-2 text-xs font-semibold transition-colors cursor-pointer"
                  style={{
                    backgroundColor: mode === 'pips' ? 'var(--nav-pill)' : 'transparent',
                    color: mode === 'pips' ? 'var(--nav-pill-text)' : 'var(--text-secondary)',
                  }}
                >
                  Pips / Points Mode
                </button>
                <button
                  type="button"
                  onClick={() => setMode('price')}
                  className="rounded-lg py-2 text-xs font-semibold transition-colors cursor-pointer"
                  style={{
                    backgroundColor: mode === 'price' ? 'var(--nav-pill)' : 'transparent',
                    color: mode === 'price' ? 'var(--nav-pill-text)' : 'var(--text-secondary)',
                  }}
                >
                  Price Levels Mode
                </button>
              </div>

              {mode === 'pips' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                      Stop Loss ({spec.unitLabel})
                    </label>
                    <input
                      type="number"
                      min="0.1"
                      step="0.5"
                      value={stopDistance}
                      onChange={(e) => setStopDistance(e.target.value)}
                      className="tb-input font-mono-num w-full rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                      Take Profit ({spec.unitLabel})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={targetDistance}
                      onChange={(e) => setTargetDistance(e.target.value)}
                      className="tb-input font-mono-num w-full rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                        Entry Price
                      </label>
                      <input
                        type="number"
                        step={spec.pipSize}
                        value={entryPrice}
                        onChange={(e) => setEntryPrice(e.target.value)}
                        className="tb-input font-mono-num w-full rounded-xl px-3 py-2.5 text-xs sm:text-sm font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                        Stop Loss
                      </label>
                      <input
                        type="number"
                        step={spec.pipSize}
                        value={slPrice}
                        onChange={(e) => setSlPrice(e.target.value)}
                        className="tb-input font-mono-num w-full rounded-xl px-3 py-2.5 text-xs sm:text-sm font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                        Take Profit
                      </label>
                      <input
                        type="number"
                        step={spec.pipSize}
                        value={tpPrice}
                        onChange={(e) => setTpPrice(e.target.value)}
                        className="tb-input font-mono-num w-full rounded-xl px-3 py-2.5 text-xs sm:text-sm font-semibold"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] font-mono-num">
                    Detected: {calc.direction} · SL {calc.effectiveStopPips.toFixed(1)}{' '}
                    {spec.unitLabel} · TP {calc.effectiveTargetPips.toFixed(1)} {spec.unitLabel}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Prop-Firm Consecutive-Loss Safety Guardrail */}
          <div
            className="rounded-xl p-3.5 flex items-start gap-3"
            style={{
              backgroundColor: guardrailTone.bg,
              border: `1px solid ${guardrailTone.color}`,
            }}
          >
            <guardrailTone.Icon
              className="w-5 h-5 shrink-0 mt-0.5"
              style={{ color: guardrailTone.color }}
            />
            <div className="text-xs space-y-1">
              <p className="font-semibold" style={{ color: guardrailTone.color }}>
                {guardrailTone.label}
              </p>
              <p className="text-[var(--text-secondary)]">
                At <strong className="font-mono-num">{riskPct.toFixed(2)}%</strong> risk, a 5% Daily
                Loss Limit absorbs{' '}
                <strong className="font-mono-num text-[var(--text-primary)]">
                  {calc.lossesToDaily5}
                </strong>{' '}
                consecutive losses, and a 10% Max Drawdown absorbs{' '}
                <strong className="font-mono-num text-[var(--text-primary)]">
                  {calc.lossesToMax10}
                </strong>{' '}
                consecutive losses.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Bottom Output Window (Strictly Below Sections 1 & 2) */}
      <section className="tb-glass rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold text-[var(--text-muted)]">
                Recommended Lot Size · {spec.symbol}
              </span>
              <span
                className="rounded-full px-3 py-1 font-mono-num text-xs font-bold"
                style={{
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--accent-text)',
                }}
              >
                1 : {calc.rrRatio.toFixed(2)} R
              </span>
            </div>

            <div className="mt-2 flex items-baseline gap-3">
              <span className="font-mono-num text-4xl sm:text-5xl font-bold tracking-tight text-[var(--text-primary)]">
                {spec.sizeUnit === 'Contracts'
                  ? Math.max(0, Math.floor(calc.recommendedLots))
                  : calc.recommendedLots.toFixed(2)}
              </span>
              <span className="text-lg sm:text-xl font-semibold text-[var(--accent-text)]">
                {spec.sizeUnit}
              </span>
            </div>

            <p className="mt-1.5 text-xs text-[var(--text-muted)] font-mono-num">
              Stop Distance: {calc.effectiveStopPips.toFixed(1)} {spec.unitLabel} · Target:{' '}
              {calc.effectiveTargetPips.toFixed(1)} {spec.unitLabel}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:min-w-[500px]">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-4">
              <span className="block text-[11px] text-[var(--text-muted)]">Mini (0.10)</span>
              <span className="mt-1 block font-mono-num text-lg font-bold text-[var(--text-primary)]">
                {calc.miniLots.toFixed(1)}
              </span>
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-4">
              <span className="block text-[11px] text-[var(--text-muted)]">Micro (0.01)</span>
              <span className="mt-1 block font-mono-num text-lg font-bold text-[var(--text-primary)]">
                {calc.microLots.toFixed(0)}
              </span>
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--negative-soft)] p-4">
              <span className="block text-[11px] text-[var(--text-muted)]">Risk $</span>
              <span
                className="mt-1 block font-mono-num text-lg font-bold"
                style={{ color: 'var(--negative)' }}
              >
                {formatMoney(calc.riskUsd, settings.currency, settings.privacyMode)}
              </span>
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--positive-soft)] p-4">
              <span className="block text-[11px] text-[var(--text-muted)]">Reward $</span>
              <span
                className="mt-1 block font-mono-num text-lg font-bold"
                style={{ color: 'var(--positive)' }}
              >
                {formatMoney(calc.rewardUsd, settings.currency, settings.privacyMode)}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
