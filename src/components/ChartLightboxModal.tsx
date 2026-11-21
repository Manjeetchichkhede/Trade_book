import React, { useEffect, useState } from 'react';
import { Maximize2, Minimize2, Pencil, X } from 'lucide-react';
import { AppSettings, PropAccount, Trade } from '../types';
import { getImage, saveImage } from '../db/storage';
import { formatMoney, formatR, formatShortDate } from '../utils/format';
import { ChartAnnotatorModal } from './ChartAnnotatorModal';

interface ChartLightboxModalProps {
  trade: Trade | null;
  account?: PropAccount;
  settings: AppSettings;
  onImageUpdated?: (imageId: string, newDataUrl: string) => void;
  onClose: () => void;
}

export const ChartLightboxModal: React.FC<ChartLightboxModalProps> = ({
  trade,
  account,
  settings,
  onImageUpdated,
  onClose,
}) => {
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const [afterUrl, setAfterUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoomed, setZoomed] = useState<'before' | 'after' | null>(null);
  const [annotatingSlot, setAnnotatingSlot] = useState<'before' | 'after' | null>(null);

  useEffect(() => {
    if (!trade) return;
    let active = true;
    setLoading(true);
    setZoomed(null);
    Promise.all([
      trade.beforeChartId ? getImage(trade.beforeChartId) : Promise.resolve(null),
      trade.afterChartId ? getImage(trade.afterChartId) : Promise.resolve(null),
    ]).then(([before, after]) => {
      if (!active) return;
      setBeforeUrl(before);
      setAfterUrl(after);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [trade]);

  if (!trade) return null;

  const handleSaveAnnotation = async (annotatedDataUrl: string) => {
    if (annotatingSlot === 'before' && trade.beforeChartId) {
      await saveImage(trade.beforeChartId, annotatedDataUrl);
      setBeforeUrl(annotatedDataUrl);
      onImageUpdated?.(trade.beforeChartId, annotatedDataUrl);
    } else if (annotatingSlot === 'after' && trade.afterChartId) {
      await saveImage(trade.afterChartId, annotatedDataUrl);
      setAfterUrl(annotatedDataUrl);
      onImageUpdated?.(trade.afterChartId, annotatedDataUrl);
    }
    setAnnotatingSlot(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="tb-glass w-full max-w-6xl max-h-[92vh] overflow-y-auto rounded-2xl p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[var(--border-subtle)]">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">{trade.symbol}</h2>
              <span
                className="text-xs font-semibold"
                style={{
                  color: trade.side === 'Long' ? 'var(--positive)' : 'var(--negative)',
                }}
              >
                {trade.side}
              </span>
              <span className="text-xs text-[var(--text-muted)]">·</span>
              <span className="text-xs text-[var(--text-secondary)]">{trade.setup}</span>
              <span className="text-xs text-[var(--text-muted)]">·</span>
              <span className="text-xs text-[var(--text-muted)]">{formatShortDate(trade.date)}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
              <span>{account ? account.name : 'Account'}</span>
              <span>·</span>
              <span
                className="font-mono-num font-semibold"
                style={{ color: trade.netPnl >= 0 ? 'var(--positive)' : 'var(--negative)' }}
              >
                {formatMoney(trade.netPnl, settings.currency, settings.privacyMode, { signed: true })}
              </span>
              <span>·</span>
              <span className="font-mono-num">{formatR(trade.rMultiple)}</span>
              <span>·</span>
              <span>Mental: {trade.mentalState}</span>
              <span>·</span>
              <span>{trade.ruleFollowed ? 'Rules Followed' : 'Rule Broken'}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close chart lightbox"
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {trade.note && (
          <p className="mt-4 text-sm text-[var(--text-secondary)] leading-relaxed">{trade.note}</p>
        )}

        {loading ? (
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-72 rounded-xl bg-[var(--bg-elevated)] animate-pulse" />
            <div className="h-72 rounded-xl bg-[var(--bg-elevated)] animate-pulse" />
          </div>
        ) : (
          <div
            className={`mt-5 grid gap-4 ${
              zoomed ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'
            }`}
          >
            {(!zoomed || zoomed === 'before') && (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-subtle)]">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                    Before Chart (Setup & Trigger)
                  </span>
                  {beforeUrl && (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setAnnotatingSlot('before')}
                        className="flex items-center gap-1 text-xs font-medium text-[var(--accent-text)] hover:underline cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Annotate
                      </button>
                      <button
                        type="button"
                        onClick={() => setZoomed(zoomed === 'before' ? null : 'before')}
                        className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                      >
                        {zoomed === 'before' ? (
                          <>
                            <Minimize2 className="w-3.5 h-3.5" /> Side-by-Side
                          </>
                        ) : (
                          <>
                            <Maximize2 className="w-3.5 h-3.5" /> Expand
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
                {beforeUrl ? (
                  <img
                    src={beforeUrl}
                    alt={`${trade.symbol} Before Chart`}
                    className="w-full h-auto max-h-[60vh] object-contain bg-[#060a14]"
                  />
                ) : (
                  <div className="flex h-64 items-center justify-center text-sm text-[var(--text-muted)]">
                    No Before Chart attached
                  </div>
                )}
              </div>
            )}

            {(!zoomed || zoomed === 'after') && (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-subtle)]">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                    After Chart (Execution Outcome)
                  </span>
                  {afterUrl && (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setAnnotatingSlot('after')}
                        className="flex items-center gap-1 text-xs font-medium text-[var(--accent-text)] hover:underline cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Annotate
                      </button>
                      <button
                        type="button"
                        onClick={() => setZoomed(zoomed === 'after' ? null : 'after')}
                        className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                      >
                        {zoomed === 'after' ? (
                          <>
                            <Minimize2 className="w-3.5 h-3.5" /> Side-by-Side
                          </>
                        ) : (
                          <>
                            <Maximize2 className="w-3.5 h-3.5" /> Expand
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
                {afterUrl ? (
                  <img
                    src={afterUrl}
                    alt={`${trade.symbol} After Chart`}
                    className="w-full h-auto max-h-[60vh] object-contain bg-[#060a14]"
                  />
                ) : (
                  <div className="flex h-64 items-center justify-center text-sm text-[var(--text-muted)]">
                    No After Chart attached
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <ChartAnnotatorModal
        open={Boolean(annotatingSlot)}
        title={
          annotatingSlot === 'before'
            ? `Annotate Before Chart — ${trade.symbol}`
            : `Annotate After Chart — ${trade.symbol}`
        }
        imageUrl={annotatingSlot === 'before' ? beforeUrl : afterUrl}
        onSave={handleSaveAnnotation}
        onClose={() => setAnnotatingSlot(null)}
      />
    </div>
  );
};
