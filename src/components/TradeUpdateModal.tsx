import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ImagePlus,
  Pencil,
  ShieldAlert,
  X,
} from 'lucide-react';
import {
  AppSettings,
  MENTAL_STATES,
  MentalState,
  PropAccount,
  Trade,
  TradeStatus,
} from '../types';
import { compressImageFile, deleteImage, getImage, saveImage } from '../db/storage';
import { computeDrawdownImpact } from '../utils/calculations';
import { formatMoney, formatShortDate, generateId } from '../utils/format';
import { ChartAnnotatorModal } from './ChartAnnotatorModal';

interface TradeUpdateModalProps {
  trade: Trade | null;
  accounts: PropAccount[];
  allTrades: Trade[];
  settings: AppSettings;
  onSave: (updated: Trade) => void;
  onClose: () => void;
}

const PNL_PRESETS = [-500, -250, 400, 850];

export const TradeUpdateModal: React.FC<TradeUpdateModalProps> = ({
  trade,
  accounts,
  allTrades,
  settings,
  onSave,
  onClose,
}) => {
  const [status, setStatus] = useState<TradeStatus>('closed');
  const [netPnl, setNetPnl] = useState<string>('');
  const [rMultiple, setRMultiple] = useState<string>('');
  const [mentalState, setMentalState] = useState<MentalState>('Focused');
  const [ruleFollowed, setRuleFollowed] = useState<boolean>(true);
  const [note, setNote] = useState<string>('');

  const [beforePreview, setBeforePreview] = useState<string | null>(null);
  const [afterPreview, setAfterPreview] = useState<string | null>(null);
  const [beforeChanged, setBeforeChanged] = useState(false);
  const [afterChanged, setAfterChanged] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);

  const [annotatingSlot, setAnnotatingSlot] = useState<'before' | 'after' | null>(null);
  const [guardrailOverride, setGuardrailOverride] = useState(false);

  useEffect(() => {
    if (!trade) return;
    let active = true;

    const isOpenTrade = trade.status === 'open';
    setStatus(isOpenTrade ? 'closed' : 'closed');
    setNetPnl(isOpenTrade && trade.netPnl === 0 ? '' : String(trade.netPnl));
    setRMultiple(isOpenTrade && trade.rMultiple === 0 ? '' : String(trade.rMultiple));
    setMentalState(trade.mentalState);
    setRuleFollowed(trade.ruleFollowed);
    setNote(trade.note);
    setBeforeChanged(false);
    setAfterChanged(false);
    setGuardrailOverride(false);
    setBeforePreview(null);
    setAfterPreview(null);

    if (trade.beforeChartId || trade.afterChartId) {
      setLoadingImages(true);
      Promise.all([
        trade.beforeChartId ? getImage(trade.beforeChartId) : Promise.resolve(null),
        trade.afterChartId ? getImage(trade.afterChartId) : Promise.resolve(null),
      ]).then(([bImg, aImg]) => {
        if (!active) return;
        setBeforePreview(bImg);
        setAfterPreview(aImg);
        setLoadingImages(false);
      });
    } else {
      setLoadingImages(false);
    }

    return () => {
      active = false;
    };
  }, [trade]);

  const account = useMemo(
    () => (trade ? accounts.find((a) => a.id === trade.accountId) : undefined),
    [accounts, trade]
  );

  // Exclude the trade currently being edited so drawdown impact reflects the updated outcome accurately
  const otherTrades = useMemo(
    () => (trade ? allTrades.filter((t) => t.id !== trade.id) : allTrades),
    [allTrades, trade]
  );

  const parsedPnl = status === 'open' ? 0 : Number(netPnl) || 0;
  const parsedR = status === 'open' ? 0 : Number(rMultiple) || 0;

  const drawdownPreview = useMemo(() => {
    if (!trade || status === 'open') return null;
    return computeDrawdownImpact(account, otherTrades, trade.date, parsedPnl);
  }, [account, otherTrades, trade, status, parsedPnl]);

  useEffect(() => {
    setGuardrailOverride(false);
  }, [netPnl, status]);

  if (!trade) return null;

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    slot: 'before' | 'after'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file);
      if (slot === 'before') {
        setBeforePreview(dataUrl);
        setBeforeChanged(true);
      } else {
        setAfterPreview(dataUrl);
        setAfterChanged(true);
      }
    } catch {
      // Ignore invalid image
    }
    e.target.value = '';
  };

  const handleClearImage = (slot: 'before' | 'after') => {
    if (slot === 'before') {
      setBeforePreview(null);
      setBeforeChanged(true);
    } else {
      setAfterPreview(null);
      setAfterChanged(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      status === 'closed' &&
      settings.breachGuardrail &&
      drawdownPreview?.anyBreach &&
      !guardrailOverride
    ) {
      setGuardrailOverride(true);
      return;
    }

    let nextBeforeId = trade.beforeChartId;
    let nextAfterId = trade.afterChartId;

    if (beforeChanged) {
      if (beforePreview) {
        const id = trade.beforeChartId ?? generateId('img_b');
        await saveImage(id, beforePreview);
        nextBeforeId = id;
      } else {
        if (trade.beforeChartId) await deleteImage(trade.beforeChartId);
        nextBeforeId = undefined;
      }
    }

    if (afterChanged) {
      if (afterPreview) {
        const id = trade.afterChartId ?? generateId('img_a');
        await saveImage(id, afterPreview);
        nextAfterId = id;
      } else {
        if (trade.afterChartId) await deleteImage(trade.afterChartId);
        nextAfterId = undefined;
      }
    }

    onSave({
      ...trade,
      status,
      netPnl: parsedPnl,
      rMultiple: parsedR,
      mentalState,
      ruleFollowed,
      note: note.trim(),
      beforeChartId: nextBeforeId,
      afterChartId: nextAfterId,
    });
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-5 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="tb-glass w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl p-5 sm:p-6 space-y-5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 pb-4 border-b border-[var(--border-subtle)]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
                  Update Trade Outcome &amp; Charts
                </h2>
                <span className="font-mono-num text-xs font-bold text-[var(--text-primary)]">
                  {trade.symbol}
                </span>
                <span
                  className="text-xs font-semibold"
                  style={{
                    color: trade.side === 'Long' ? 'var(--positive)' : 'var(--negative)',
                  }}
                >
                  {trade.side}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {formatShortDate(trade.date)} · {trade.setup} ·{' '}
                {account?.name ?? (trade.accountId === 'general' ? 'General Account' : 'Account')}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Status Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-3">
              <div>
                <p className="text-xs font-semibold text-[var(--text-primary)]">Trade Status</p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Mark as Closed once TP, SL, or manual exit hits to include P&amp;L in analytics.
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-solid)] p-1">
                {(
                  [
                    { id: 'closed' as TradeStatus, label: 'Closed (TP / SL)' },
                    { id: 'open' as TradeStatus, label: 'Still Open' },
                  ] as const
                ).map((opt) => {
                  const active = status === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setStatus(opt.id)}
                      className="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
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

            {/* Outcome Inputs: Net P&L + Presets + R-Multiple */}
            {status === 'closed' && (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div className="sm:col-span-8">
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                    Net P&amp;L (USD)
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      step="any"
                      value={netPnl}
                      onChange={(e) => setNetPnl(e.target.value)}
                      placeholder="0.00"
                      className="tb-input font-mono-num flex-1 min-w-[120px] rounded-xl px-3.5 py-2.5 text-sm"
                    />
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {PNL_PRESETS.map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => {
                            setNetPnl(String(val));
                            setRMultiple(
                              val < 0 ? (val === -500 ? '-1.0' : '-0.5') : val === 400 ? '1.6' : '2.5'
                            );
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

                <div className="sm:col-span-4">
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                    R-Multiple
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={rMultiple}
                    onChange={(e) => setRMultiple(e.target.value)}
                    placeholder="0.0"
                    className="tb-input font-mono-num w-full rounded-xl px-3.5 py-2.5 text-sm"
                  />
                </div>
              </div>
            )}

            {/* Live Drawdown Impact Preview */}
            {status === 'closed' && drawdownPreview && (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[var(--text-primary)]">
                    Drawdown Impact Preview
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">{account?.name}</span>
                </div>
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
                      <strong>Rule Breach Warning:</strong> This outcome breaches{' '}
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
            )}

            {/* Before & After Chart Screenshots */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[var(--text-secondary)]">
                  Before &amp; After Chart Proof
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  Stored locally offline · Supports markup annotations
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                            onClick={() => setAnnotatingSlot(slot)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent-text)] hover:underline cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" /> Annotate
                          </button>
                          <button
                            type="button"
                            onClick={() => handleClearImage(slot)}
                            className="inline-flex items-center gap-1 text-[11px] text-rose-400 hover:underline cursor-pointer"
                          >
                            <X className="w-3 h-3" /> Clear
                          </button>
                        </div>
                      )}
                    </div>
                    {loadingImages ? (
                      <div className="h-28 rounded-lg bg-[var(--bg-elevated)] animate-pulse" />
                    ) : preview ? (
                      <img
                        src={preview}
                        alt={`${label} preview`}
                        className="h-28 w-full rounded-lg object-cover border border-[var(--border-subtle)]"
                      />
                    ) : (
                      <label className="flex h-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors">
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
            </div>

            {/* Post-Trade Psychology & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
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
                        className="rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all cursor-pointer whitespace-nowrap"
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
                  <span>{ruleFollowed ? 'Yes — Followed' : 'No — Rule Broken'}</span>
                  <span className="font-mono-num">{ruleFollowed ? 'ON' : 'OFF'}</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Execution &amp; Post-Trade Review Note
              </label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="TP/SL execution review, management lessons, CISD confirmation notes..."
                className="tb-input w-full rounded-xl px-3.5 py-2.5 text-sm resize-none"
              />
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={onClose}
                className="tb-btn-ghost rounded-xl px-4 py-2.5 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="tb-btn-primary inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-semibold cursor-pointer"
              >
                {guardrailOverride ? (
                  <>
                    <AlertTriangle className="w-4 h-4" />
                    Confirm &amp; Save Breaching Trade
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {status === 'closed' ? 'Save Outcome & Charts' : 'Save Open Trade Update'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <ChartAnnotatorModal
        open={Boolean(annotatingSlot)}
        title={annotatingSlot === 'before' ? 'Annotate Before Chart' : 'Annotate After Chart'}
        imageUrl={annotatingSlot === 'before' ? beforePreview : afterPreview}
        onSave={(annotatedUrl) => {
          if (annotatingSlot === 'before') {
            setBeforePreview(annotatedUrl);
            setBeforeChanged(true);
          } else if (annotatingSlot === 'after') {
            setAfterPreview(annotatedUrl);
            setAfterChanged(true);
          }
          setAnnotatingSlot(null);
        }}
        onClose={() => setAnnotatingSlot(null)}
      />
    </>
  );
};
