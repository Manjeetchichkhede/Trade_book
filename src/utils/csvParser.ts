import { PlaybookSetup, Trade, TradeSide } from '../types';
import { generateId, getTodayISO } from './format';

export type BrokerPreset = 'auto' | 'mt5' | 'mt4' | 'ctrader' | 'tradelocker' | 'custom';

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
      note: rawNote || 'Imported via Broker CSV',
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
