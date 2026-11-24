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
  parseBrokerReportText,
  ParsedCsvData,
  readBrokerFileText,
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

const SAMPLE_MT5_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Trade History Report</title></head>
<body>
<table>
  <tr><th colspan="13">Trade History Report</th></tr>
  <tr><td colspan="13">Account: 51092841 (USD, Hedge)</td></tr>
  <tr><th colspan="13"><b>Positions</b></th></tr>
  <tr>
    <td><b>Time</b></td><td><b>Position</b></td><td><b>Symbol</b></td><td><b>Type</b></td>
    <td><b>Volume</b></td><td><b>Price</b></td><td><b>S / L</b></td><td><b>T / P</b></td>
    <td><b>Time</b></td><td><b>Price</b></td><td><b>Commission</b></td><td><b>Swap</b></td><td><b>Profit</b></td>
  </tr>
  <tr>
    <td>2026.11.19 08:42:10</td><td>50918271</td><td>XAUUSD.pro</td><td>buy</td>
    <td class="hidden" colspan="8">London CISD Sweep</td>
    <td>1.00</td><td>2668.50</td><td>2663.50</td><td>2679.00</td>
    <td>2026.11.19 09:38:22</td><td>2679.00</td><td>-7.00</td><td>0.00</td><td>1 050.00</td>
  </tr>
  <tr>
    <td>2026.11.20 14:35:05</td><td>50919044</td><td>NAS100</td><td>sell</td>
    <td class="hidden" colspan="8">NY AM Silver Bullet</td>
    <td>2.00</td><td>20945.00</td><td>20975.00</td><td>20875.00</td>
    <td>2026.11.20 15:18:40</td><td>20875.00</td><td>-4.50</td><td>0.00</td><td>700.00</td>
  </tr>
  <tr>
    <td>2026.11.21 15:02:18</td><td>50920118</td><td>EURUSD.raw</td><td>buy</td>
    <td class="hidden" colspan="8">Stopped at BE/SL</td>
    <td>2.50</td><td>1.08350</td><td>1.08230</td><td>1.08650</td>
    <td>2026.11.21 15:26:09</td><td>1.08230</td><td>-10.00</td><td>0.00</td><td>-300.00</td>
  </tr>
  <tr><th colspan="13"><b>Orders</b></th></tr>
</table>
</body>
</html>`;

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
  const [targetAccountId, setTargetAccountId] = useState<string>(accounts[0]?.id ?? 'general');
  const [defaultSetup, setDefaultSetup] = useState<PlaybookSetup>('Liquidity Sweep + CISD + BB');
  const [defaultRiskUsd, setDefaultRiskUsd] = useState<string>('0');
  const [selectedRowIds, setSelectedRowIds] = useState<Set<number>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadRawReport = (raw: string, name: string) => {
    setErrorMsg(null);
    const result = parseBrokerReportText(raw, name);
    if (result.headers.length === 0 || result.rows.length === 0) {
      setErrorMsg(
        'Could not find closed trade rows. For MT5 HTML reports, export via History → Right-click → Report → HTML (Open XML/HTML).'
      );
      return;
    }
    setParsed(result);
    setFileName(name);
    setMapping(result.suggestedMapping);

    const accId =
      (targetAccountId && (targetAccountId === 'general' || accounts.some((a) => a.id === targetAccountId))
        ? targetAccountId
        : accounts[0]?.id) || 'general';
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
    try {
      const text = await readBrokerFileText(file);
      loadRawReport(text, file.name);
    } catch {
      setErrorMsg('Unable to read this file. Please try exporting again from MT5 or your broker.');
    }
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
    const risk = Math.max(0, Number(defaultRiskUsd) || 0);
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
                Import MT5 HTML &amp; Broker CSV Trade History
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Supports MetaTrader 5 HTML reports (.html / .htm), MT4 statements, and broker CSV/TSV
                exports.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close trade importer"
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
                {fileName ? `Loaded: ${fileName}` : 'Upload MT5 HTML Report or Broker CSV'}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                100% local browser parsing · Handles MT5 UTF-16LE HTML Positions, Commissions &amp;
                Swaps automatically.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                loadRawReport(SAMPLE_MT5_HTML, `ReportHistory-MT5-${getTodayISO()}.html`)
              }
              className="tb-btn-ghost rounded-xl px-3 py-2 text-xs font-medium cursor-pointer"
            >
              Sample MT5 HTML
            </button>
            <button
              type="button"
              onClick={() => loadRawReport(SAMPLE_MT5_CSV, `sample-mt5-${getTodayISO()}.csv`)}
              className="tb-btn-ghost rounded-xl px-3 py-2 text-xs font-medium cursor-pointer"
            >
              Sample CSV
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="tb-btn-primary rounded-xl px-4 py-2 text-xs font-semibold cursor-pointer"
            >
              Choose HTML / CSV
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".html,.htm,.csv,.tsv,.txt,text/html,text/csv"
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
                  min="0"
                  placeholder="0"
                  value={defaultRiskUsd}
                  onChange={(e) => setDefaultRiskUsd(e.target.value)}
                  className="tb-input font-mono-num w-full rounded-lg px-3 py-2 text-xs"
                />
              </div>
            </div>

            {/* Column Mapper */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-[var(--text-primary)]">
                  Column Mapping (Detected:{' '}
                  {parsed.reportInfo || parsed.detectedPreset.toUpperCase()})
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
