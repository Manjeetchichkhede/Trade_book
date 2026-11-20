export type InstrumentCategory = 'All' | 'Metals' | 'Forex Majors' | 'Forex Crosses' | 'Indices';

export interface InstrumentSpec {
  symbol: string;
  name: string;
  category: Exclude<InstrumentCategory, 'All'>;
  unitLabel: 'Pips' | 'Points';
  sizeUnit: 'Lots' | 'Contracts';
  pipSize: number; // 1 pip or 1 point price delta
  usdPerPipPerStandardLot: number; // USD value per 1.00 lot/contract for 1 pip/point move
  defaultStopDistance: number;
  defaultTargetDistance: number;
  sampleEntry: number;
  decimals: number;
}

export const INSTRUMENTS: InstrumentSpec[] = [
  {
    symbol: 'XAUUSD',
    name: 'Gold Spot vs USD',
    category: 'Metals',
    unitLabel: 'Pips',
    sizeUnit: 'Lots',
    pipSize: 0.1, // $0.10 move = 1 pip -> $10 per standard 100 oz lot
    usdPerPipPerStandardLot: 10,
    defaultStopDistance: 35,
    defaultTargetDistance: 105,
    sampleEntry: 2685.5,
    decimals: 2,
  },
  {
    symbol: 'XAGUSD',
    name: 'Silver Spot vs USD',
    category: 'Metals',
    unitLabel: 'Pips',
    sizeUnit: 'Lots',
    pipSize: 0.01, // 5,000 oz standard lot -> $50 per $0.01
    usdPerPipPerStandardLot: 50,
    defaultStopDistance: 15,
    defaultTargetDistance: 45,
    sampleEntry: 31.45,
    decimals: 3,
  },
  {
    symbol: 'EURUSD',
    name: 'Euro vs US Dollar',
    category: 'Forex Majors',
    unitLabel: 'Pips',
    sizeUnit: 'Lots',
    pipSize: 0.0001,
    usdPerPipPerStandardLot: 10,
    defaultStopDistance: 12,
    defaultTargetDistance: 36,
    sampleEntry: 1.0845,
    decimals: 5,
  },
  {
    symbol: 'GBPUSD',
    name: 'British Pound vs USD',
    category: 'Forex Majors',
    unitLabel: 'Pips',
    sizeUnit: 'Lots',
    pipSize: 0.0001,
    usdPerPipPerStandardLot: 10,
    defaultStopDistance: 15,
    defaultTargetDistance: 45,
    sampleEntry: 1.296,
    decimals: 5,
  },
  {
    symbol: 'USDJPY',
    name: 'US Dollar vs Japanese Yen',
    category: 'Forex Majors',
    unitLabel: 'Pips',
    sizeUnit: 'Lots',
    pipSize: 0.01,
    usdPerPipPerStandardLot: 6.55,
    defaultStopDistance: 18,
    defaultTargetDistance: 54,
    sampleEntry: 152.6,
    decimals: 3,
  },
  {
    symbol: 'GBPJPY',
    name: 'British Pound vs Yen',
    category: 'Forex Crosses',
    unitLabel: 'Pips',
    sizeUnit: 'Lots',
    pipSize: 0.01,
    usdPerPipPerStandardLot: 6.55,
    defaultStopDistance: 22,
    defaultTargetDistance: 66,
    sampleEntry: 197.8,
    decimals: 3,
  },
  {
    symbol: 'EURJPY',
    name: 'Euro vs Japanese Yen',
    category: 'Forex Crosses',
    unitLabel: 'Pips',
    sizeUnit: 'Lots',
    pipSize: 0.01,
    usdPerPipPerStandardLot: 6.55,
    defaultStopDistance: 20,
    defaultTargetDistance: 60,
    sampleEntry: 165.4,
    decimals: 3,
  },
  {
    symbol: 'NAS100',
    name: 'US Tech 100 CFD',
    category: 'Indices',
    unitLabel: 'Points',
    sizeUnit: 'Lots',
    pipSize: 1.0, // $1 per point per 1.0 CFD lot (standard prop CFD)
    usdPerPipPerStandardLot: 1,
    defaultStopDistance: 45,
    defaultTargetDistance: 135,
    sampleEntry: 20850.0,
    decimals: 1,
  },
  {
    symbol: 'US30',
    name: 'Wall Street 30 CFD',
    category: 'Indices',
    unitLabel: 'Points',
    sizeUnit: 'Lots',
    pipSize: 1.0,
    usdPerPipPerStandardLot: 1,
    defaultStopDistance: 60,
    defaultTargetDistance: 180,
    sampleEntry: 43920.0,
    decimals: 1,
  },
  {
    symbol: 'NQ',
    name: 'E-Mini Nasdaq-100 Futures',
    category: 'Indices',
    unitLabel: 'Points',
    sizeUnit: 'Contracts',
    pipSize: 1.0, // $20 per full point per 1 NQ contract
    usdPerPipPerStandardLot: 20,
    defaultStopDistance: 25,
    defaultTargetDistance: 75,
    sampleEntry: 20910.25,
    decimals: 2,
  },
];

export const INSTRUMENT_CATEGORIES: InstrumentCategory[] = [
  'All',
  'Metals',
  'Forex Majors',
  'Forex Crosses',
  'Indices',
];
