import { PlaybookSetup, Trade, TradeSide } from '../types';
import { generateId, getTodayISO } from './format';

export type BrokerPreset =
  | 'auto'
  | 'mt5-html'
  | 'mt4-html'
  | 'mt5'
  | 'mt4'
  | 'ctrader'
  | 'tradelocker'
  | 'custom';

export interface CsvColumnMapping {
  dateCol: number;
  symbolCol: number;
  sideCol: number;
  pnlCol: number;
  commissionCol: number; // -1 if unused
  swapCol: number; // -1 if unused
  noteCol: number; // -1 if unused
}

export interface ParsedCsvData {
  headers: string[];
  rows: string[][];
  detectedPreset: Exclude<BrokerPreset, 'auto'>;
  suggestedMapping: CsvColumnMapping;
  reportInfo?: string;
}

/**
 * Decodes uploaded broker files safely, including UTF-16LE / UTF-16BE with BOM
 * which MetaTrader 5 on Windows produces for HTML Trade History reports.
 */
export async function readBrokerFileText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(buffer);
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(buffer);
  }
  return new TextDecoder('utf-8').decode(buffer);
}

export interface MappedTradePreview {
  rowIndex: number;
  date: string;
  symbol: string;
  side: TradeSide;
  netPnl: number;
  note: string;
  isDuplicate: boolean;
  valid: boolean;
}

function detectDelimiter(sampleLine: string): string {
  const counts: Record<string, number> = {
    ',': (sampleLine.match(/,/g) ?? []).length,
    ';': (sampleLine.match(/;/g) ?? []).length,
    '\t': (sampleLine.match(/\t/g) ?? []).length,
  };
  if (counts['\t'] >= counts[','] && counts['\t'] >= counts[';'] && counts['\t'] > 0) return '\t';
  if (counts[';'] > counts[',']) return ';';
  return ',';
}

function parseLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function findHeaderIndex(headers: string[], patterns: RegExp[]): number {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const pat of patterns) {
    const idx = lower.findIndex((h) => pat.test(h));
    if (idx !== -1) return idx;
  }
  return -1;
}

export function parseBrokerCsvText(rawText: string): ParsedCsvData {
  const lines = rawText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return {
      headers: [],
      rows: [],
      detectedPreset: 'custom',
      suggestedMapping: {
        dateCol: -1,
        symbolCol: -1,
        sideCol: -1,
        pnlCol: -1,
        commissionCol: -1,
        swapCol: -1,
        noteCol: -1,
      },
    };
  }

  // Some MT5 exports have title metadata rows before the actual header row; scan first 8 lines
  let headerLineIdx = 0;
  let delimiter = detectDelimiter(lines[0]);
  for (let i = 0; i < Math.min(8, lines.length - 1); i++) {
    const d = detectDelimiter(lines[i]);
    const cols = parseLine(lines[i], d).map((c) => c.toLowerCase());
    const hasSymbol = cols.some((c) => /symbol|instrument|pair|asset|ticker/.test(c));
    const hasProfit = cols.some((c) => /profit|p&l|pnl|net|realized/.test(c));
    if (hasSymbol && hasProfit) {
      headerLineIdx = i;
      delimiter = d;
      break;
    }
  }

  const headers = parseLine(lines[headerLineIdx], delimiter);
  const rows = lines
    .slice(headerLineIdx + 1)
    .map((line) => parseLine(line, delimiter))
    .filter((r) => r.some((cell) => cell.length > 0));

  const joinedHeaders = headers.join(' ').toLowerCase();
  let detectedPreset: Exclude<BrokerPreset, 'auto'> = 'custom';
  if (joinedHeaders.includes('position') && joinedHeaders.includes('profit')) {
    detectedPreset = 'mt5';
  } else if (joinedHeaders.includes('ticket') && joinedHeaders.includes('item')) {
    detectedPreset = 'mt4';
  } else if (joinedHeaders.includes('closing direction') || joinedHeaders.includes('net usd')) {
    detectedPreset = 'ctrader';
  } else if (joinedHeaders.includes('tradelocker') || joinedHeaders.includes('realized pnl')) {
    detectedPreset = 'tradelocker';
  }

  const suggestedMapping: CsvColumnMapping = {
    dateCol: findHeaderIndex(headers, [
      /close\s*time|closing\s*time|exit\s*time/,
      /time|date|opened|executed/,
    ]),
    symbolCol: findHeaderIndex(headers, [/symbol|instrument|item|pair|ticker|asset/]),
    sideCol: findHeaderIndex(headers, [/type|side|direction|action|buy\/sell/]),
    pnlCol: findHeaderIndex(headers, [
      /net\s*p&l|net\s*pnl|net\s*profit|net\s*usd/,
      /profit|p&l|pnl|realized/,
    ]),
    commissionCol: findHeaderIndex(headers, [/commission|comm|fee/]),
    swapCol: findHeaderIndex(headers, [/swap|rollover/]),
    noteCol: findHeaderIndex(headers, [/comment|note|notes|setup/]),
  };

  return { headers, rows, detectedPreset, suggestedMapping };
}

function isHiddenCell(cell: Element): boolean {
  if (cell.classList.contains('hidden')) return true;
  const style = (cell.getAttribute('style') ?? '').toLowerCase().replace(/\s+/g, '');
  if (style.includes('display:none') || style.includes('visibility:hidden')) return true;
  return false;
}

function cleanCellText(text: string | null | undefined): string {
  return (text ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeDuplicateHeaders(rawHeaders: string[]): string[] {
  let timeSeen = 0;
  let priceSeen = 0;
  return rawHeaders.map((h) => {
    const lower = h.toLowerCase().trim();
    if (lower === 'time') {
      timeSeen++;
      return timeSeen === 1 ? 'Open Time' : 'Close Time';
    }
    if (lower === 'price') {
      priceSeen++;
      return priceSeen === 1 ? 'Open Price' : 'Close Price';
    }
    return h.trim();
  });
}

function isSectionBannerRow(row: HTMLTableRowElement, visibleCells: string[]): string | null {
  const tds = Array.from(row.children).filter(
    (el) => (el.tagName === 'TD' || el.tagName === 'TH') && !isHiddenCell(el)
  );
  if (tds.length === 1) {
    const colspan = Number(tds[0].getAttribute('colspan') ?? '1');
    const txt = visibleCells[0]?.toLowerCase() ?? '';
    if (colspan >= 3 || row.querySelector('b, strong, th')) {
      return txt;
    }
  }
  return null;
}

/**
 * Safely parses MetaTrader 5 (Positions / Deals) and MetaTrader 4 (Closed Transactions)
 * HTML trade history reports using DOMParser (inert document — no script execution).
 */
export function parseMt5HtmlText(rawHtml: string): ParsedCsvData {
  const empty: ParsedCsvData = {
    headers: [],
    rows: [],
    detectedPreset: 'mt5-html',
    suggestedMapping: {
      dateCol: -1,
      symbolCol: -1,
      sideCol: -1,
      pnlCol: -1,
      commissionCol: -1,
      swapCol: -1,
      noteCol: -1,
    },
  };

  if (typeof DOMParser === 'undefined') return empty;

  const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
  const allRows = Array.from(doc.querySelectorAll('table tr')) as HTMLTableRowElement[];
  if (allRows.length === 0) return empty;

  // Extract optional report metadata (Account / Company / Name)
  const metaParts: string[] = [];
  for (let i = 0; i < Math.min(12, allRows.length); i++) {
    const rowText = cleanCellText(allRows[i].textContent);
    if (/^account:/i.test(rowText) || /^company:/i.test(rowText)) {
      metaParts.push(rowText);
    }
  }

  interface ExtractedSection {
    kind: 'positions' | 'deals' | 'mt4';
    headers: string[];
    rows: string[][];
  }

  const sections: ExtractedSection[] = [];
  let currentSectionTitle = '';
  let activeSection: ExtractedSection | null = null;
  let awaitingHeaderFor: 'positions' | 'deals' | 'mt4' | null = null;

  for (const tr of allRows) {
    const rawCells = Array.from(tr.children).filter(
      (el) => el.tagName === 'TD' || el.tagName === 'TH'
    );
    if (rawCells.length === 0) continue;

    const visibleEls = rawCells.filter((el) => !isHiddenCell(el));
    const hiddenTexts = rawCells
      .filter((el) => isHiddenCell(el))
      .map((el) => cleanCellText(el.textContent))
      .filter(Boolean);
    const visibleCells = visibleEls.map((el) => cleanCellText(el.textContent));

    if (visibleCells.every((c) => c === '')) continue;

    // Detect section banners (Positions, Orders, Deals, Open Positions, Results, Closed Transactions, etc.)
    const banner = isSectionBannerRow(tr, visibleCells);
    if (banner !== null) {
      if (activeSection && activeSection.rows.length > 0) {
        sections.push(activeSection);
      }
      activeSection = null;
      awaitingHeaderFor = null;
      currentSectionTitle = banner;

      if (banner === 'positions' || banner.startsWith('positions')) {
        awaitingHeaderFor = 'positions';
      } else if (banner === 'deals' || banner.startsWith('deals')) {
        awaitingHeaderFor = 'deals';
      } else if (banner.includes('closed transactions')) {
        awaitingHeaderFor = 'mt4';
      }
      continue;
    }

    const lowerRow = visibleCells.map((c) => c.toLowerCase());
    const looksLikeTradeHeader =
      lowerRow.some((c) => c === 'symbol' || c === 'item') &&
      lowerRow.some((c) => c === 'profit' || c.includes('profit')) &&
      lowerRow.some((c) => c === 'type');

    if (looksLikeTradeHeader) {
      if (activeSection && activeSection.rows.length > 0) {
        sections.push(activeSection);
      }

      const normalizedHeaders = normalizeDuplicateHeaders(visibleCells);
      const hasCommentHeader = normalizedHeaders.some((h) => /comment/i.test(h));
      const finalHeaders = hasCommentHeader
        ? normalizedHeaders
        : [...normalizedHeaders, 'Comment'];

      let kind: 'positions' | 'deals' | 'mt4' = awaitingHeaderFor ?? 'positions';
      if (!awaitingHeaderFor) {
        if (lowerRow.includes('item') || lowerRow.includes('ticket')) {
          kind = 'mt4';
        } else if (lowerRow.includes('deal') || lowerRow.includes('direction')) {
          kind = 'deals';
        } else {
          kind = 'positions';
        }
      }

      // Skip Open Positions or Working Orders sections
      if (
        currentSectionTitle.includes('open position') ||
        currentSectionTitle.includes('working order') ||
        currentSectionTitle === 'orders'
      ) {
        activeSection = null;
        awaitingHeaderFor = null;
        continue;
      }

      activeSection = { kind, headers: finalHeaders, rows: [] };
      awaitingHeaderFor = null;
      continue;
    }

    if (activeSection) {
      const firstCellLower = (visibleCells[0] ?? '').toLowerCase();
      // Stop on totals / summary footer rows
      if (
        firstCellLower.startsWith('total') ||
        firstCellLower.startsWith('closed p/l') ||
        firstCellLower.startsWith('balance:') ||
        firstCellLower.startsWith('gross profit') ||
        visibleCells.length < 5
      ) {
        if (activeSection.rows.length > 0) {
          sections.push(activeSection);
        }
        activeSection = null;
        continue;
      }

      // For MT5 Deals fallback, only include closing deals ('out' or 'in/out')
      if (activeSection.kind === 'deals') {
        const dirIdx = activeSection.headers.findIndex((h) => h.toLowerCase() === 'direction');
        if (dirIdx !== -1) {
          const dirVal = (visibleCells[dirIdx] ?? '').toLowerCase();
          if (dirVal && !dirVal.includes('out')) {
            continue;
          }
        }
      }

      const hasOriginalComment = activeSection.headers.length === visibleCells.length;
      const commentVal = hiddenTexts.join(' · ');
      const rowValues = hasOriginalComment
        ? visibleCells
        : [...visibleCells, commentVal];

      // Pad or trim to match header count
      while (rowValues.length < activeSection.headers.length) {
        rowValues.push('');
      }
      activeSection.rows.push(rowValues);
    }
  }

  if (activeSection && activeSection.rows.length > 0) {
    sections.push(activeSection);
  }

  // Prefer MT5 Positions, then MT4 Closed Transactions, then MT5 Deals
  const chosen =
    sections.find((s) => s.kind === 'positions') ??
    sections.find((s) => s.kind === 'mt4') ??
    sections.find((s) => s.kind === 'deals');

  if (!chosen) return empty;

  const detectedPreset: Exclude<BrokerPreset, 'auto'> =
    chosen.kind === 'mt4' ? 'mt4-html' : 'mt5-html';

  const headers = chosen.headers;
  const suggestedMapping: CsvColumnMapping = {
    dateCol: findHeaderIndex(headers, [
      /close\s*time|closing\s*time|exit\s*time/,
      /open\s*time|time|date/,
    ]),
    symbolCol: findHeaderIndex(headers, [/symbol|item|instrument/]),
    sideCol: findHeaderIndex(headers, [/^type$|side|direction/]),
    pnlCol: findHeaderIndex(headers, [/^profit$|net\s*profit|p&l|pnl/]),
    commissionCol: findHeaderIndex(headers, [/commission|comm|fee/]),
    swapCol: findHeaderIndex(headers, [/swap/]),
    noteCol: findHeaderIndex(headers, [/comment|note/]),
  };

  const sectionLabel =
    chosen.kind === 'positions'
      ? 'MT5 HTML · Positions'
      : chosen.kind === 'mt4'
      ? 'MT4 HTML · Closed Transactions'
      : 'MT5 HTML · Closing Deals';

  return {
    headers,
    rows: chosen.rows,
    detectedPreset,
    suggestedMapping,
    reportInfo: metaParts.length > 0 ? `${sectionLabel} (${metaParts[0]})` : sectionLabel,
  };
}

/**
 * Unified parser for both MetaTrader HTML trade history reports (.html/.htm)
 * and broker CSV / TSV exports.
 */
export function parseBrokerReportText(rawText: string, fileName = ''): ParsedCsvData {
  const trimmed = rawText.replace(/^\uFEFF/, '').trim();
  const isHtmlByName = /\.html?$/i.test(fileName);
  const isHtmlByContent =
    /^<!doctype\s+html/i.test(trimmed) ||
    /^<html/i.test(trimmed) ||
    /<table[\s>]/i.test(trimmed.slice(0, 4000));

  if (isHtmlByName || isHtmlByContent) {
    return parseMt5HtmlText(rawText);
  }
  return parseBrokerCsvText(rawText);
}

function parseNumeric(val: string | undefined): number {
  if (!val) return NaN;
  const cleaned = val
    .replace(/[$€£₹,]/g, '')
    .replace(/\s+/g, '')
    .replace(/^\((.+)\)$/, '-$1');
  return Number(cleaned);
}

function parseDateToIso(raw: string | undefined): string {
  if (!raw) return getTodayISO();
  const s = raw.trim();
  // Match YYYY.MM.DD or YYYY-MM-DD or YYYY/MM/DD (MT5 standard: 2026.11.20 14:32:10)
  const ymd = s.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  }
  // Match DD/MM/YYYY or MM/DD/YYYY
  const dmy = s.match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/);
  if (dmy) {
    const a = Number(dmy[1]);
    const b = Number(dmy[2]);
    const year = dmy[3];
    // If first part > 12, it's definitely DD/MM/YYYY
    const month = a > 12 ? b : a;
    const day = a > 12 ? a : b;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) {
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
      dt.getDate()
    ).padStart(2, '0')}`;
  }
  return getTodayISO();
}

function parseSide(raw: string | undefined): TradeSide | null {
  if (!raw) return 'Long';
  const s = raw.toLowerCase().trim();
  if (s.includes('balance') || s.includes('deposit') || s.includes('withdraw') || s.includes('credit')) {
    return null; // Non-trade ledger row in MT4/MT5
  }
  if (s.includes('sell') || s.includes('short') || s === 's') return 'Short';
  return 'Long';
}

export function buildTradePreviews(
  rows: string[][],
  mapping: CsvColumnMapping,
  existingTrades: Trade[],
  targetAccountId: string
): MappedTradePreview[] {
  const existingSigs = new Set(
    existingTrades
      .filter((t) => t.accountId === targetAccountId)
      .map((t) => `${t.date}|${t.symbol.toUpperCase()}|${t.side}|${Math.round(t.netPnl * 100)}`)
  );

  return rows.map((row, rowIndex) => {
    const rawSymbol = mapping.symbolCol >= 0 ? row[mapping.symbolCol] : '';
    const rawSide = mapping.sideCol >= 0 ? row[mapping.sideCol] : 'Long';
    const rawDate = mapping.dateCol >= 0 ? row[mapping.dateCol] : '';
    const rawPnl = mapping.pnlCol >= 0 ? row[mapping.pnlCol] : '';
    const rawComm = mapping.commissionCol >= 0 ? row[mapping.commissionCol] : '';
    const rawSwap = mapping.swapCol >= 0 ? row[mapping.swapCol] : '';
    const rawNote = mapping.noteCol >= 0 ? row[mapping.noteCol] : '';

    const parsedSide = parseSide(rawSide);
    const symbol = (rawSymbol || '')
      .toUpperCase()
      .replace(/\.PRO$|\.RAW$|\.ECN$|\.M$|\.I$/i, '')
      .trim();

    const basePnl = parseNumeric(rawPnl);
    const comm = parseNumeric(rawComm);
    const swap = parseNumeric(rawSwap);
    const totalPnl =
      (Number.isFinite(basePnl) ? basePnl : NaN) +
      (Number.isFinite(comm) ? comm : 0) +
      (Number.isFinite(swap) ? swap : 0);

    const valid = Boolean(parsedSide && symbol && symbol.length >= 2 && Number.isFinite(totalPnl));
    const date = parseDateToIso(rawDate);
    const roundedPnl = Number.isFinite(totalPnl) ? Math.round(totalPnl * 100) / 100 : 0;
    const side: TradeSide = parsedSide ?? 'Long';

    const sig = `${date}|${symbol}|${side}|${Math.round(roundedPnl * 100)}`;
    const isDuplicate = valid && existingSigs.has(sig);

    return {
      rowIndex,
      date,
      symbol: symbol || '—',
      side,
      netPnl: roundedPnl,
      note: rawNote || 'Imported from Broker History',
      isDuplicate,
      valid,
    };
  });
}

export function convertPreviewsToTrades(
  previews: MappedTradePreview[],
  accountId: string,
  defaultSetup: PlaybookSetup,
  defaultRiskUsd: number
): Trade[] {
  const safeRisk = Math.max(1, defaultRiskUsd);
  return previews.map((p, idx) => ({
    id: generateId(`imp${idx}`),
    accountId,
    date: p.date,
    symbol: p.symbol,
    side: p.side,
    setup: defaultSetup,
    rMultiple: Math.round((p.netPnl / safeRisk) * 100) / 100,
    netPnl: p.netPnl,
    mentalState: 'Calm',
    ruleFollowed: true,
    note: p.note,
    createdAt: new Date(Date.now() + idx).toISOString(),
  }));
}
