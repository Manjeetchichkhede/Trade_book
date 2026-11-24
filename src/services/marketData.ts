import { ChartTimeframe, MarketSymbolConfig, OhlcBar } from '../types/chart';
import { kvGet, kvSet } from '../db/storage';

export const DEFAULT_MARKET_SYMBOLS: MarketSymbolConfig[] = [
  {
    id: 'XAUUSD',
    label: 'XAUUSD',
    name: 'Gold Spot (PAXG/USD)',
    category: 'Forex & Gold',
    provider: 'binance',
    providerSymbol: 'PAXGUSDT',
    precision: 2,
    minMove: 0.01,
  },
  {
    id: 'EURUSD',
    label: 'EURUSD',
    name: 'Euro / US Dollar',
    category: 'Forex & Gold',
    provider: 'binance',
    providerSymbol: 'EURUSDT',
    precision: 5,
    minMove: 0.00001,
  },
  {
    id: 'GBPUSD',
    label: 'GBPUSD',
    name: 'British Pound / US Dollar',
    category: 'Forex & Gold',
    provider: 'kraken',
    providerSymbol: 'GBPUSD',
    precision: 5,
    minMove: 0.00001,
  },
  {
    id: 'USDJPY',
    label: 'USDJPY',
    name: 'US Dollar / Japanese Yen',
    category: 'Forex & Gold',
    provider: 'kraken',
    providerSymbol: 'USDJPY',
    precision: 3,
    minMove: 0.001,
  },
  {
    id: 'AUDUSD',
    label: 'AUDUSD',
    name: 'Australian Dollar / USD',
    category: 'Forex & Gold',
    provider: 'kraken',
    providerSymbol: 'AUDUSD',
    precision: 5,
    minMove: 0.00001,
  },
  {
    id: 'USDCAD',
    label: 'USDCAD',
    name: 'US Dollar / Canadian Dollar',
    category: 'Forex & Gold',
    provider: 'kraken',
    providerSymbol: 'USDCAD',
    precision: 5,
    minMove: 0.00001,
  },
  {
    id: 'EURGBP',
    label: 'EURGBP',
    name: 'Euro / British Pound',
    category: 'Forex & Gold',
    provider: 'kraken',
    providerSymbol: 'EURGBP',
    precision: 5,
    minMove: 0.00001,
  },
  {
    id: 'EURJPY',
    label: 'EURJPY',
    name: 'Euro / Japanese Yen',
    category: 'Forex & Gold',
    provider: 'kraken',
    providerSymbol: 'EURJPY',
    precision: 3,
    minMove: 0.001,
  },
  {
    id: 'BTCUSD',
    label: 'BTCUSD',
    name: 'Bitcoin / USD',
    category: 'Crypto',
    provider: 'binance',
    providerSymbol: 'BTCUSDT',
    precision: 2,
    minMove: 0.01,
  },
  {
    id: 'ETHUSD',
    label: 'ETHUSD',
    name: 'Ethereum / USD',
    category: 'Crypto',
    provider: 'binance',
    providerSymbol: 'ETHUSDT',
    precision: 2,
    minMove: 0.01,
  },
  {
    id: 'SOLUSD',
    label: 'SOLUSD',
    name: 'Solana / USD',
    category: 'Crypto',
    provider: 'binance',
    providerSymbol: 'SOLUSDT',
    precision: 2,
    minMove: 0.01,
  },
  {
    id: 'XRPUSD',
    label: 'XRPUSD',
    name: 'Ripple / USD',
    category: 'Crypto',
    provider: 'binance',
    providerSymbol: 'XRPUSDT',
    precision: 4,
    minMove: 0.0001,
  },
  {
    id: 'BNBUSD',
    label: 'BNBUSD',
    name: 'BNB / USD',
    category: 'Crypto',
    provider: 'binance',
    providerSymbol: 'BNBUSDT',
    precision: 2,
    minMove: 0.01,
  },
];

export const TIMEFRAME_SECONDS: Record<ChartTimeframe, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
};

const KRAKEN_INTERVAL_MINUTES: Record<ChartTimeframe, number> = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '30m': 30,
  '1h': 60,
  '4h': 240,
  '1d': 1440,
};

function cacheKey(symbolId: string, tf: ChartTimeframe): string {
  return `chartCandles_${symbolId}_${tf}`;
}

export async function fetchOhlcBars(
  symbol: MarketSymbolConfig,
  timeframe: ChartTimeframe
): Promise<{ bars: OhlcBar[]; source: 'live' | 'cached' }> {
  try {
    let bars: OhlcBar[] = [];
    if (symbol.provider === 'binance') {
      const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(
        symbol.providerSymbol
      )}&interval=${timeframe}&limit=400`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
      const raw = (await res.json()) as unknown[][];
      bars = raw
        .map((row) => ({
          time: Math.floor(Number(row[0]) / 1000),
          open: Number(row[1]),
          high: Number(row[2]),
          low: Number(row[3]),
          close: Number(row[4]),
          volume: Number(row[5]),
        }))
        .filter((b) => Number.isFinite(b.time) && Number.isFinite(b.close));
    } else {
      const intervalMin = KRAKEN_INTERVAL_MINUTES[timeframe];
      const url = `https://api.kraken.com/0/public/OHLC?pair=${encodeURIComponent(
        symbol.providerSymbol
      )}&interval=${intervalMin}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Kraken HTTP ${res.status}`);
      const json = (await res.json()) as {
        error?: string[];
        result?: Record<string, unknown>;
      };
      if (json.error && json.error.length > 0) {
        throw new Error(json.error[0]);
      }
      const resultObj = json.result ?? {};
      const pairKey = Object.keys(resultObj).find((k) => k !== 'last');
      const rows = (pairKey ? (resultObj[pairKey] as unknown[][]) : []) ?? [];
      bars = rows
        .slice(-400)
        .map((row) => ({
          time: Math.floor(Number(row[0])),
          open: Number(row[1]),
          high: Number(row[2]),
          low: Number(row[3]),
          close: Number(row[4]),
          volume: Number(row[6] ?? 0),
        }))
        .filter((b) => Number.isFinite(b.time) && Number.isFinite(b.close));
    }

    // Ensure strict ascending unique timestamps required by Lightweight Charts
    const deduped: OhlcBar[] = [];
    let lastTime = -1;
    for (const bar of bars.sort((a, b) => a.time - b.time)) {
      if (bar.time > lastTime) {
        deduped.push(bar);
        lastTime = bar.time;
      }
    }

    if (deduped.length > 0) {
      void kvSet(cacheKey(symbol.id, timeframe), deduped.slice(-250));
      return { bars: deduped, source: 'live' };
    }
    throw new Error('No candle bars returned');
  } catch {
    const cached = await kvGet<OhlcBar[]>(cacheKey(symbol.id, timeframe));
    if (Array.isArray(cached) && cached.length > 0) {
      return { bars: cached, source: 'cached' };
    }
    throw new Error(`Unable to load market data for ${symbol.label}`);
  }
}

export function subscribeLiveCandle(
  symbol: MarketSymbolConfig,
  timeframe: ChartTimeframe,
  onBar: (bar: OhlcBar) => void
): () => void {
  if (symbol.provider === 'binance') {
    let closed = false;
    let ws: WebSocket | null = null;
    try {
      const streamName = `${symbol.providerSymbol.toLowerCase()}@kline_${timeframe}`;
      ws = new WebSocket(`wss://stream.binance.com:9443/ws/${streamName}`);
      ws.onmessage = (event) => {
        if (closed) return;
        try {
          const msg = JSON.parse(String(event.data)) as {
            k?: { t: number; o: string; h: string; l: string; c: string; v: string };
          };
          if (!msg.k) return;
          onBar({
            time: Math.floor(msg.k.t / 1000),
            open: Number(msg.k.o),
            high: Number(msg.k.h),
            low: Number(msg.k.l),
            close: Number(msg.k.c),
            volume: Number(msg.k.v),
          });
        } catch {
          // Ignore malformed frame
        }
      };
    } catch {
      // WebSocket unavailable
    }
    return () => {
      closed = true;
      try {
        ws?.close();
      } catch {
        // Ignore close error
      }
    };
  }

  // Kraken: poll latest bar every 6 seconds
  let active = true;
  const intervalId = window.setInterval(async () => {
    if (!active) return;
    try {
      const { bars } = await fetchOhlcBars(symbol, timeframe);
      if (active && bars.length > 0) {
        onBar(bars[bars.length - 1]);
      }
    } catch {
      // Ignore transient poll error
    }
  }, 6000);

  return () => {
    active = false;
    window.clearInterval(intervalId);
  };
}

// ---------- Technical Indicator Calculations ----------

export function computeHeikinAshi(bars: OhlcBar[]): OhlcBar[] {
  const out: OhlcBar[] = [];
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const haClose = (b.open + b.high + b.low + b.close) / 4;
    const haOpen = i === 0 ? (b.open + b.close) / 2 : (out[i - 1].open + out[i - 1].close) / 2;
    const haHigh = Math.max(b.high, haOpen, haClose);
    const haLow = Math.min(b.low, haOpen, haClose);
    out.push({
      time: b.time,
      open: haOpen,
      high: haHigh,
      low: haLow,
      close: haClose,
      volume: b.volume,
    });
  }
  return out;
}

export function computeEMA(bars: OhlcBar[], period: number): { time: number; value: number }[] {
  if (bars.length < period) return [];
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += bars[i].close;
  let ema = sum / period;
  const out: { time: number; value: number }[] = [{ time: bars[period - 1].time, value: ema }];
  for (let i = period; i < bars.length; i++) {
    ema = bars[i].close * k + ema * (1 - k);
    out.push({ time: bars[i].time, value: ema });
  }
  return out;
}

export function computeSMA(bars: OhlcBar[], period: number): { time: number; value: number }[] {
  if (bars.length < period) return [];
  const out: { time: number; value: number }[] = [];
  let windowSum = 0;
  for (let i = 0; i < bars.length; i++) {
    windowSum += bars[i].close;
    if (i >= period) windowSum -= bars[i - period].close;
    if (i >= period - 1) {
      out.push({ time: bars[i].time, value: windowSum / period });
    }
  }
  return out;
}

export function computeBollingerBands(
  bars: OhlcBar[],
  period = 20,
  mult = 2
): {
  upper: { time: number; value: number }[];
  middle: { time: number; value: number }[];
  lower: { time: number; value: number }[];
} {
  const upper: { time: number; value: number }[] = [];
  const middle: { time: number; value: number }[] = [];
  const lower: { time: number; value: number }[] = [];
  if (bars.length < period) return { upper, middle, lower };

  for (let i = period - 1; i < bars.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += bars[j].close;
    const mean = sum / period;
    let sqDiff = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = bars[j].close - mean;
      sqDiff += d * d;
    }
    const std = Math.sqrt(sqDiff / period);
    const t = bars[i].time;
    middle.push({ time: t, value: mean });
    upper.push({ time: t, value: mean + mult * std });
    lower.push({ time: t, value: mean - mult * std });
  }
  return { upper, middle, lower };
}

export function computeVWAP(bars: OhlcBar[]): { time: number; value: number }[] {
  const out: { time: number; value: number }[] = [];
  let cumPV = 0;
  let cumVol = 0;
  let currentDay = -1;

  for (const b of bars) {
    const utcDay = Math.floor(b.time / 86400);
    if (utcDay !== currentDay) {
      currentDay = utcDay;
      cumPV = 0;
      cumVol = 0;
    }
    const typical = (b.high + b.low + b.close) / 3;
    const vol = b.volume > 0 ? b.volume : 1;
    cumPV += typical * vol;
    cumVol += vol;
    out.push({ time: b.time, value: cumPV / cumVol });
  }
  return out;
}
