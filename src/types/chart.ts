export type ChartTimeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';

export type CandleStyle = 'candles' | 'hollow' | 'heikin' | 'bars' | 'line' | 'area';

export type ChartThemePresetId =
  | 'tv-dark'
  | 'tv-light'
  | 'ict-mono'
  | 'midnight'
  | 'obsidian'
  | 'custom';

export interface ChartThemeConfig {
  presetId: ChartThemePresetId;
  backgroundColor: string;
  textColor: string;
  gridColor: string;
  showGrid: boolean;
  crosshairColor: string;
  upColor: string;
  downColor: string;
  wickUpColor: string;
  wickDownColor: string;
  borderUpColor: string;
  borderDownColor: string;
  candleStyle: CandleStyle;
  scaleMode: 'normal' | 'log';
}

export interface ChartIndicatorsConfig {
  ema20: boolean;
  ema50: boolean;
  ema200: boolean;
  sma20: boolean;
  bollinger: boolean;
  vwap: boolean;
  volume: boolean;
}

export type DrawingToolType =
  | 'cursor'
  | 'trendline'
  | 'ray'
  | 'hline'
  | 'rect'
  | 'fib'
  | 'long'
  | 'short'
  | 'text';

export interface DrawingPoint {
  time: number; // Unix timestamp in seconds
  price: number;
}

export interface ChartDrawing {
  id: string;
  symbol: string;
  type: Exclude<DrawingToolType, 'cursor'>;
  points: DrawingPoint[];
  color: string;
  lineWidth: 1 | 2 | 3;
  lineStyle: 'solid' | 'dashed';
  label?: string;
}

export interface OhlcBar {
  time: number; // Unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketSymbolConfig {
  id: string; // e.g. 'XAUUSD'
  label: string;
  name: string;
  category: 'Forex & Gold' | 'Crypto';
  provider: 'binance' | 'kraken';
  providerSymbol: string; // e.g. 'PAXGUSDT' or 'GBPUSD'
  precision: number;
  minMove: number;
  custom?: boolean;
}

export const CHART_THEME_PRESETS: Record<
  Exclude<ChartThemePresetId, 'custom'>,
  { name: string; config: ChartThemeConfig }
> = {
  'tv-dark': {
    name: 'TradingView Dark',
    config: {
      presetId: 'tv-dark',
      backgroundColor: '#131722',
      textColor: '#b2b5be',
      gridColor: '#1e222d',
      showGrid: true,
      crosshairColor: '#758696',
      upColor: '#089981',
      downColor: '#f23645',
      wickUpColor: '#089981',
      wickDownColor: '#f23645',
      borderUpColor: '#089981',
      borderDownColor: '#f23645',
      candleStyle: 'candles',
      scaleMode: 'normal',
    },
  },
  'tv-light': {
    name: 'TradingView Light',
    config: {
      presetId: 'tv-light',
      backgroundColor: '#ffffff',
      textColor: '#363a45',
      gridColor: '#f0f3fa',
      showGrid: true,
      crosshairColor: '#9598a1',
      upColor: '#089981',
      downColor: '#f23645',
      wickUpColor: '#089981',
      wickDownColor: '#f23645',
      borderUpColor: '#089981',
      borderDownColor: '#f23645',
      candleStyle: 'candles',
      scaleMode: 'normal',
    },
  },
  'ict-mono': {
    name: 'ICT Monochrome',
    config: {
      presetId: 'ict-mono',
      backgroundColor: '#0d0e12',
      textColor: '#9ca3af',
      gridColor: '#181a20',
      showGrid: false,
      crosshairColor: '#6b7280',
      upColor: '#e5e7eb',
      downColor: '#4b5563',
      wickUpColor: '#d1d5db',
      wickDownColor: '#6b7280',
      borderUpColor: '#f9fafb',
      borderDownColor: '#6b7280',
      candleStyle: 'candles',
      scaleMode: 'normal',
    },
  },
  midnight: {
    name: 'Midnight Navy',
    config: {
      presetId: 'midnight',
      backgroundColor: '#070d1b',
      textColor: '#94a3b8',
      gridColor: '#111c33',
      showGrid: true,
      crosshairColor: '#60a5fa',
      upColor: '#22c55e',
      downColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      candleStyle: 'candles',
      scaleMode: 'normal',
    },
  },
  obsidian: {
    name: 'Pure Obsidian',
    config: {
      presetId: 'obsidian',
      backgroundColor: '#000000',
      textColor: '#a1a1aa',
      gridColor: '#141417',
      showGrid: true,
      crosshairColor: '#38bdf8',
      upColor: '#38bdf8',
      downColor: '#f43f5e',
      wickUpColor: '#38bdf8',
      wickDownColor: '#f43f5e',
      borderUpColor: '#38bdf8',
      borderDownColor: '#f43f5e',
      candleStyle: 'candles',
      scaleMode: 'normal',
    },
  },
};

export const DEFAULT_CHART_THEME: ChartThemeConfig = CHART_THEME_PRESETS['tv-dark'].config;

export const DEFAULT_CHART_INDICATORS: ChartIndicatorsConfig = {
  ema20: true,
  ema50: false,
  ema200: false,
  sma20: false,
  bollinger: false,
  vwap: false,
  volume: true,
};

export const DRAWING_COLORS = [
  '#3b82f6', // Blue
  '#22c55e', // Green
  '#ef4444', // Red
  '#f59e0b', // Amber
  '#a855f7', // Purple
  '#06b6d4', // Cyan
  '#f8fafc', // White
  '#94a3b8', // Slate
] as const;
