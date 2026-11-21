import React, { useMemo, useRef, useState } from 'react';
import { Check, FileSpreadsheet, Upload, X } from 'lucide-react';
import {
  AppSettings,
  PLAYBOOK_SETUPS,
  PlaybookSetup,
  PropAccount,
  Trade,
} from '../types';
import {
  buildTradePreviews,
  convertPreviewsToTrades,
  CsvColumnMapping,
  parseBrokerCsvText,
  ParsedCsvData,
} from '../utils/csvParser';
import { formatMoney, getTodayISO } from '../utils/format';

interface CsvImportModalProps {
  open: boolean;
  accounts: PropAccount[];
  existingTrades: Trade[];
  settings: AppSettings;
  onImportTrades: (trades: Trade[]) => void;
  onClose: () => void;
}

const SAMPLE_MT5_CSV = `Position,Time,Symbol,Type,Volume,Price,Close Time,Commission,Swap,Profit,Comment
104821,2026.11.18 09:15:00,XAUUSD.pro,buy,1.20,2678.40,2026.11.18 10:05:00,-8.40,0.00,920.00,London CISD sweep
104822,2026.11.19 14:35:00,NAS100,sell,2.00,20890.0,2026.11.19 15:12:00,-4.00,0.00,-310.00,NY AM stopped
104823,2026.11.20 15:05:00,EURUSD.raw,buy,3.00,1.08420,2026.11.20 15:48:00,-12.00,0.00,645.00,NY AM Silver Bullet`;

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  open,
  accounts,
  existingTrades,
  settings,
  onImportTrades,
  onClose,
}) => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [parsed, setParsed] = useState<ParsedCsvData | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [mapping, setMapping] = useState<CsvColumnMapping>({
    dateCol: -1,
    symbolCol: -1,
    sideCol: -1,
    pnlCol: -1,
    commissionCol: -1,
    swapCol: -1,
    noteCol: -1,
  });
  const [targetAccountId, setTargetAccountId] = useState<string>(accounts[0]?.id ?? '');
  const [defaultSetup, setDefaultSetup] = useState<PlaybookSetup>('Liquidity Sweep + CISD + BB');
  const [defaultRiskUsd, setDefaultRiskUsd] = useState<string>('500');
  const [selectedRowIds, setSelectedRowIds] = useState<Set<number>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadRawCsv = (raw: string, name: string) => {
    setErrorMsg(null);
    const result = parseBrokerCsvText(raw);
    if (result.headers.length === 0 || result.rows.length === 0) {
      setErrorMsg('Could not find valid CSV rows. Check that the file has a header and trade rows.');
      return;
    }
    setParsed(result);
    setFileName(name);
    setMapping(result.suggestedMapping);

    const accId = targetAccountId || accounts[0]?.id || '';
    setTargetAccountId(accId);

    const initialPreviews = buildTradePreviews(
      result.rows,
      result.suggestedMapping,
      existingTrades,
      accId
    );
    const nonDupIndices = new Set<number>();
    initialPreviews.forEach((p) => {
      if (p.valid && !p.isDuplicate) nonDupIndices.add(p.rowIndex);
    });
    setSelectedRowIds(nonDupIndices);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    loadRawCsv(text, file.name);
    e.target.value = '';
  };

  const previews = useMemo(() => {
    if (!parsed) return [];
    return buildTradePreviews(parsed.rows, mapping, existingTrades, targetAccountId);
  }, [parsed, mapping, existingTrades, targetAccountId]);

  const validPreviews = useMemo(() => previews.filter((p) => p.valid), [previews]);
  const selectedPreviews = useMemo(
    () => validPreviews.filter((p) => selectedRowIds.has(p.rowIndex)),
    [validPreviews, selectedRowIds]
  );

  const selectedNetTotal = useMemo(
    () => selectedPreviews.reduce((s, p) => s + p.netPnl, 0),
    [selectedPreviews]
  );

  const toggleRow = (idx: number) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleImport = () => {
    if (!targetAccountId || selectedPreviews.length === 0) return;
    const risk = Math.max(1, Number(defaultRiskUsd) || 500);
    const tradesToAdd = convertPreviewsToTrades(
      selectedPreviews,
      targetAccountId,
      defaultSetup,
      risk
    );
    onImportTrades(tradesToAdd);
    setParsed(null);
    setFileName('');
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-5 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="tb-glass w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl p-5 sm:p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-[var(--accent-text)]" />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
                Broker &amp; MT5 CSV Trade Importer
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Supports MetaTrader 5, MT4, cTrader, TradeLocker, and standard broker CSV/TSV exports.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close CSV importer"
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Upload Zone */}
        <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-input)] p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Upload className="w-6 h-6 text-[var(--accent-text)] shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {fileName ? `Loaded: ${fileName}` : 'Upload Broker History CSV / TSV'}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                100% local browser parsing · Duplicate rows are flagged automatically.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => loadRawCsv(SAMPLE_MT5_CSV, `sample-mt5-${getTodayISO()}.csv`)}
              className="tb-btn-ghost rounded-xl px-3 py-2 text-xs font-medium cursor-pointer"
            >
              Load Sample MT5 CSV
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="tb-btn-primary rounded-xl px-4 py-2 text-xs font-semibold cursor-pointer"
            >
              Choose File
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt,text/csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>

        {errorMsg && (
          <p className="text-xs font-semibold" style={{ color: 'var(--negative)' }}>
            {errorMsg}
          </p>
        )}

        {/* Mapping & Import Options */}
        {parsed && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-4">
              <div>
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                  Destination Prop Account
                </label>
                <select
                  value={targetAccountId}
                  onChange={(e) => setTargetAccountId(e.target.value)}
                  className="tb-input w-full rounded-lg px-3 py-2 text-xs"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                  Default Playbook Setup
                </label>
                <select
                  value={defaultSetup}
                  onChange={(e) => setDefaultSetup(e.target.value as PlaybookSetup)}
                  className="tb-input w-full rounded-lg px-3 py-2 text-xs"
                >
                  {PLAYBOOK_SETUPS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                  1R Reference Risk ($)
                </label>
                <input
                  type="number"
                  min="1"
                  value={defaultRiskUsd}
                  onChange={(e) => setDefaultRiskUsd(e.target.value)}
                  className="tb-input font-mono-num w-full rounded-lg px-3 py-2 text-xs"
                />
              </div>
            </div>

            {/* Column Mapper */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[var(--text-primary)]">
                  Column Mapping (Detected: {parsed.detectedPreset.toUpperCase()})
                </span>
                <span className="text-[var(--text-muted)]">
                  {validPreviews.length} valid trade rows found
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {(
                  [
                    { key: 'dateCol', label: 'Date / Time' },
                    { key: 'symbolCol', label: 'Symbol' },
                    { key: 'sideCol', label: 'Side / Type' },
                    { key: 'pnlCol', label: 'Profit / P&L' },
                    { key: 'commissionCol', label: 'Commission' },
                    { key: 'swapCol', label: 'Swap' },
                  ] as { key: keyof CsvColumnMapping; label: string }[]
                ).map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-[10px] text-[var(--text-muted)] mb-1">
                      {label}
                    </label>
                    <select
                      value={mapping[key]}
                      onChange={(e) =>
                        setMapping((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                      }
                      className="tb-input w-full rounded-lg px-2 py-1.5 text-[11px]"
                    >
                      <option value={-1}>— None —</option>
                      {parsed.headers.map((h, i) => (
                        <option key={`${h}-${i}`} value={i}>
                          {h || `Col ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview Table */}
            <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] max-h-64 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-input)] text-[var(--text-muted)] sticky top-0">
                    <th className="py-2.5 px-3">
                      <input
                        type="checkbox"
                        checked={
                          validPreviews.length > 0 &&
                          selectedPreviews.length === validPreviews.length
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRowIds(new Set(validPreviews.map((p) => p.rowIndex)));
                          } else {
                            setSelectedRowIds(new Set());
                          }
                        }}
                        className="accent-blue-500"
                      />
                    </th>
                    <th className="py-2.5 px-3 font-medium">Date</th>
                    <th className="py-2.5 px-3 font-medium">Symbol</th>
                    <th className="py-2.5 px-3 font-medium">Side</th>
                    <th className="py-2.5 px-3 font-medium text-right">Net P&amp;L</th>
                    <th className="py-2.5 px-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {validPreviews.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-[var(--text-muted)]">
                        No valid trades matched. Adjust the Symbol / Profit column mappings above.
                      </td>
                    </tr>
                  ) : (
                    validPreviews.map((p) => (
                      <tr key={p.rowIndex} className="hover:bg-[var(--bg-hover)]">
                        <td className="py-2 px-3">
                          <input
                            type="checkbox"
                            checked={selectedRowIds.has(p.rowIndex)}
                            onChange={() => toggleRow(p.rowIndex)}
                            className="accent-blue-500"
                          />
                        </td>
                        <td className="py-2 px-3 font-mono-num text-[var(--text-secondary)]">
                          {p.date}
                        </td>
                        <td className="py-2 px-3 font-mono-num font-bold text-[var(--text-primary)]">
                          {p.symbol}
                        </td>
                        <td className="py-2 px-3 font-semibold">
                          <span
                            style={{
                              color: p.side === 'Long' ? 'var(--positive)' : 'var(--negative)',
                            }}
                          >
                            {p.side}
                          </span>
                        </td>
                        <td
                          className="py-2 px-3 font-mono-num font-bold text-right"
                          style={{ color: p.netPnl >= 0 ? 'var(--positive)' : 'var(--negative)' }}
                        >
                          {formatMoney(p.netPnl, settings.currency, settings.privacyMode, {
                            signed: true,
                          })}
                        </td>
                        <td className="py-2 px-3">
                          {p.isDuplicate ? (
                            <span className="text-amber-400 font-semibold">Possible Duplicate</span>
                          ) : (
                            <span style={{ color: 'var(--positive)' }}>Ready</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Action */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--border-subtle)]">
              <div className="text-xs text-[var(--text-secondary)]">
                Selected:{' '}
                <strong className="font-mono-num text-[var(--text-primary)]">
                  {selectedPreviews.length}
                </strong>{' '}
                trades · Total P&amp;L:{' '}
                <strong
                  className="font-mono-num"
                  style={{ color: selectedNetTotal >= 0 ? 'var(--positive)' : 'var(--negative)' }}
                >
                  {formatMoney(selectedNetTotal, settings.currency, settings.privacyMode, {
                    signed: true,
                  })}
                </strong>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="tb-btn-ghost rounded-xl px-4 py-2 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={selectedPreviews.length === 0 || !targetAccountId}
                  onClick={handleImport}
                  className="tb-btn-primary inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-semibold cursor-pointer disabled:opacity-40"
                >
                  <Check className="w-4 h-4" />
                  Import {selectedPreviews.length} Trades
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
