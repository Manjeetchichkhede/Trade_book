import {
  AppSettings,
  ChecklistItem,
  EconomicNewsEvent,
  GuardrailConfig,
  PropAccount,
  RoiEntry,
  Trade,
} from '../types';
import { addDaysISO, getTodayISO } from '../utils/format';

export const DEFAULT_SETTINGS: AppSettings = {
  traderName: '',
  theme: 'dark',
  font: 'inter',
  clockStyle: 'modern',
  currency: 'USD',
  dstMode: 'auto',
  glassPage: true,
  glassNav: true,
  bgGradient: true,
  cursorAnimation: true,
  cursorEffect: 'aurora-grid',
  liveClocksOverview: true,
  breachGuardrail: true,
  compactAccounts: false,
  privacyMode: false,
  wallpaperPreset: 'none',
  wallpaperDim: 45,
  wallpaperBlur: 2,
  windowOpacity: 70,
};

export function createDefaultChecklist(): ChecklistItem[] {
  return [
    {
      id: 'chk_1',
      label: 'HTF Draw on Liquidity (PDH / PDL / Asian Range) clearly marked',
      setupScope: 'All',
      required: true,
      checked: false,
    },
    {
      id: 'chk_2',
      label: 'Active inside Killzone or Silver Bullet execution window',
      setupScope: 'All',
      required: true,
      checked: false,
    },
    {
      id: 'chk_3',
      label: 'No Red-Folder High-Impact news within prop-firm buffer window',
      setupScope: 'All',
      required: true,
      checked: false,
    },
    {
      id: 'chk_4',
      label: 'Clean Liquidity Sweep / Inducement taken before entry trigger',
      setupScope: 'Liquidity Sweep + CISD + BB',
      required: true,
      checked: false,
    },
    {
      id: 'chk_5',
      label: 'Displacement candle closed confirming CISD & Breaker Block',
      setupScope: 'Liquidity Sweep + CISD + BB',
      required: true,
      checked: false,
    },
    {
      id: 'chk_6',
      label: 'Internal Inducement swept and CISD candle closed cleanly',
      setupScope: 'Inducement + CISD',
      required: true,
      checked: false,
    },
    {
      id: 'chk_7',
      label: 'Position size verified in Lot Size calculator (Risk ≤ 0.5%–1.0%)',
      setupScope: 'All',
      required: true,
      checked: false,
    },
  ];
}

export function createDefaultGuardrailConfig(): GuardrailConfig {
  return {
    newsBufferMinutes: 2,
    enableNewsWarnings: true,
    checklistDate: getTodayISO(),
  };
}

export function createDefaultNewsEvents(baseDate: string = getTodayISO()): EconomicNewsEvent[] {
  return [
    {
      id: 'news_1',
      date: baseDate,
      nyTime: '08:30',
      currency: 'USD',
      impact: 'High',
      title: 'US Core CPI (MoM) & CPI (YoY)',
      forecast: '0.3%',
      previous: '0.3%',
    },
    {
      id: 'news_2',
      date: baseDate,
      nyTime: '10:00',
      currency: 'USD',
      impact: 'High',
      title: 'ISM Services PMI',
      forecast: '53.8',
      previous: '54.1',
    },
    {
      id: 'news_3',
      date: baseDate,
      nyTime: '14:00',
      currency: 'USD',
      impact: 'High',
      title: 'FOMC Monetary Policy Statement & Press Conference',
      forecast: '4.50%',
      previous: '4.75%',
    },
    {
      id: 'news_4',
      date: addDaysISO(baseDate, 1),
      nyTime: '08:30',
      currency: 'USD',
      impact: 'High',
      title: 'Initial Jobless Claims & Core PPI (MoM)',
      forecast: '220K',
      previous: '217K',
    },
    {
      id: 'news_5',
      date: addDaysISO(baseDate, 1),
      nyTime: '08:15',
      currency: 'EUR',
      impact: 'High',
      title: 'ECB Interest Rate Decision',
      forecast: '3.25%',
      previous: '3.40%',
    },
    {
      id: 'news_6',
      date: addDaysISO(baseDate, 2),
      nyTime: '02:00',
      currency: 'GBP',
      impact: 'High',
      title: 'UK CPI (YoY) & Core Inflation',
      forecast: '2.2%',
      previous: '2.3%',
    },
    {
      id: 'news_7',
      date: addDaysISO(baseDate, 2),
      nyTime: '08:30',
      currency: 'USD',
      impact: 'High',
      title: 'Non-Farm Payrolls (NFP) & Unemployment Rate',
      forecast: '185K',
      previous: '192K',
    },
    {
      id: 'news_8',
      date: addDaysISO(baseDate, 3),
      nyTime: '23:00',
      currency: 'JPY',
      impact: 'Medium',
      title: 'BoJ Monetary Policy Summary of Opinions',
      forecast: '—',
      previous: '—',
    },
  ];
}

function makeDemoChartSvg(title: string, subtitle: string, isAfter: boolean): string {
  const accent = isAfter ? '#10b981' : '#3b82f6';
  const entryY = 230;
  const slY = 285;
  const tpY = 92;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="480" viewBox="0 0 900 480">
    <rect width="900" height="480" fill="#09101f"/>
    <g stroke="#1e293b" stroke-width="1">
      <line x1="0" y1="80" x2="900" y2="80"/>
      <line x1="0" y1="160" x2="900" y2="160"/>
      <line x1="0" y1="240" x2="900" y2="240"/>
      <line x1="0" y1="320" x2="900" y2="320"/>
      <line x1="0" y1="400" x2="900" y2="400"/>
      <line x1="150" y1="0" x2="150" y2="480"/>
      <line x1="350" y1="0" x2="350" y2="480"/>
      <line x1="550" y1="0" x2="550" y2="480"/>
      <line x1="750" y1="0" x2="750" y2="480"/>
    </g>
    <!-- TP & SL zones -->
    <rect x="440" y="${tpY}" width="380" height="${entryY - tpY}" fill="#10b981" fill-opacity="0.11" stroke="#10b981" stroke-opacity="0.45" stroke-dasharray="6 4"/>
    <rect x="440" y="${entryY}" width="380" height="${slY - entryY}" fill="#f43f5e" fill-opacity="0.12" stroke="#f43f5e" stroke-opacity="0.45" stroke-dasharray="6 4"/>
    <!-- Liquidity sweep line -->
    <line x1="90" y1="295" x2="420" y2="295" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="5 5"/>
    <text x="98" y="314" fill="#f59e0b" font-family="monospace" font-size="13">Sellside Liquidity Sweep</text>
    <!-- CISD level -->
    <line x1="310" y1="215" x2="560" y2="215" stroke="#60a5fa" stroke-width="1.5"/>
    <text x="315" y="207" fill="#93c5fd" font-family="monospace" font-size="13">CISD + Breaker Block</text>
    <!-- Price path -->
    <polyline fill="none" stroke="#94a3b8" stroke-width="2.5" points="60,210 110,245 160,220 210,270 255,248 295,292 330,308 365,250 405,198 445,228"/>
    ${
      isAfter
        ? `<polyline fill="none" stroke="${accent}" stroke-width="3.2" points="445,228 495,186 540,204 600,152 655,162 720,108 790,88"/>
           <circle cx="790" cy="88" r="6" fill="#10b981"/>
           <text x="695" y="76" fill="#34d399" font-family="monospace" font-size="14" font-weight="bold">TP HIT +3.2R</text>`
        : `<circle cx="445" cy="228" r="6" fill="#3b82f6"/>
           <text x="460" y="222" fill="#93c5fd" font-family="monospace" font-size="14" font-weight="bold">LIMIT ENTRY</text>`
    }
    <rect x="24" y="20" width="430" height="52" rx="10" fill="#0f172a" fill-opacity="0.88" stroke="#334155"/>
    <text x="40" y="43" fill="#f8fafc" font-family="sans-serif" font-size="16" font-weight="bold">${title}</text>
    <text x="40" y="62" fill="#94a3b8" font-family="monospace" font-size="12">${subtitle}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function createDemoSeed(): {
  accounts: PropAccount[];
  trades: Trade[];
  roiEntries: RoiEntry[];
  images: Record<string, string>;
} {
  const today = getTodayISO();

  const accounts: PropAccount[] = [
    {
      id: 'acc_ftmo_100k',
      firm: 'FTMO',
      name: 'FTMO 100K Swing Funded',
      stage: 'Funded',
      startingBalance: 100000,
      drawdownType: 'Static',
      dailyLossLimit: 5000,
      maxDrawdown: 10000,
      minTradingDays: 5,
      consistencyCapPct: 30,
      evalFee: 585,
      createdAt: addDaysISO(today, -60),
    },
    {
      id: 'acc_fp_50k',
      firm: 'FundingPips',
      name: 'FP 50K Master Funded',
      stage: 'Funded',
      startingBalance: 50000,
      drawdownType: 'EOD Trailing',
      dailyLossLimit: 2500,
      maxDrawdown: 5000,
      minTradingDays: 5,
      consistencyCapPct: 30,
      evalFee: 299,
      createdAt: addDaysISO(today, -45),
    },
    {
      id: 'acc_apex_50k',
      firm: 'Apex Trader',
      name: 'Apex 50K Eval P1',
      stage: 'Eval Phase 1',
      startingBalance: 50000,
      drawdownType: 'Intraday Trailing',
      dailyLossLimit: 1500,
      maxDrawdown: 2500,
      profitTarget: 3000,
      minTradingDays: 5,
      consistencyCapPct: 30,
      evalFee: 167,
      createdAt: addDaysISO(today, -18),
    },
  ];

  const images: Record<string, string> = {
    img_demo_before_1: makeDemoChartSvg(
      'XAUUSD · M5 Before Entry',
      'NY AM Killzone · Liquidity Sweep + CISD + BB',
      false
    ),
    img_demo_after_1: makeDemoChartSvg(
      'XAUUSD · M5 Execution Result',
      'Clean displacement into 2694.80 external liquidity (+3.2R)',
      true
    ),
    img_demo_before_2: makeDemoChartSvg(
      'NAS100 · M1 Before Entry',
      'NY AM Silver Bullet · Inducement + CISD',
      false
    ),
    img_demo_after_2: makeDemoChartSvg(
      'NAS100 · M1 Execution Result',
      'Internal inducement taken -> smooth expansion to London High (+2.4R)',
      true
    ),
  };

  const trades: Trade[] = [
    {
      id: 'tr_01',
      accountId: 'acc_ftmo_100k',
      date: addDaysISO(today, -14),
      symbol: 'XAUUSD',
      side: 'Long',
      setup: 'Liquidity Sweep + CISD + BB',
      rMultiple: 2.6,
      netPnl: 1300,
      mentalState: 'Focused',
      ruleFollowed: true,
      note: 'London Open Killzone swept Asian low, crisp M5 CISD closed above breaker block.',
      createdAt: '2026-01-01T08:15:00Z',
    },
    {
      id: 'tr_02',
      accountId: 'acc_fp_50k',
      date: addDaysISO(today, -13),
      symbol: 'EURUSD',
      side: 'Short',
      setup: 'Inducement + CISD',
      rMultiple: 1.9,
      netPnl: 475,
      mentalState: 'Calm',
      ruleFollowed: true,
      note: 'Waited for London inducement tap into H1 supply, clean delivery.',
      createdAt: '2026-01-02T09:10:00Z',
    },
    {
      id: 'tr_03',
      accountId: 'acc_ftmo_100k',
      date: addDaysISO(today, -11),
      symbol: 'NAS100',
      side: 'Long',
      setup: 'Inducement + CISD',
      rMultiple: -1.0,
      netPnl: -500,
      mentalState: 'Calm',
      ruleFollowed: true,
      note: 'Valid NY AM entry stopped by news wick. Risk respected strictly at 0.5%.',
      createdAt: '2026-01-03T14:05:00Z',
    },
    {
      id: 'tr_04',
      accountId: 'acc_apex_50k',
      date: addDaysISO(today, -10),
      symbol: 'NQ',
      side: 'Long',
      setup: 'Liquidity Sweep + CISD + BB',
      rMultiple: 2.8,
      netPnl: 840,
      mentalState: 'Focused',
      ruleFollowed: true,
      note: 'NY AM Silver Bullet sweep of 09:30 open low + instant CISD.',
      createdAt: '2026-01-04T15:10:00Z',
    },
    {
      id: 'tr_05',
      accountId: 'acc_fp_50k',
      date: addDaysISO(today, -9),
      symbol: 'GBPUSD',
      side: 'Short',
      setup: 'Inducement + CISD',
      rMultiple: -1.3,
      netPnl: -390,
      mentalState: 'Anxious',
      ruleFollowed: false,
      note: 'Entered early before candle close confirmed CISD; widened stop slightly.',
      createdAt: '2026-01-05T13:20:00Z',
    },
    {
      id: 'tr_06',
      accountId: 'acc_ftmo_100k',
      date: addDaysISO(today, -7),
      symbol: 'XAUUSD',
      side: 'Short',
      setup: 'Liquidity Sweep + CISD + BB',
      rMultiple: 3.1,
      netPnl: 1550,
      mentalState: 'Focused',
      ruleFollowed: true,
      note: 'Swept PDH at London open, textbook bearish breaker + CISD continuation.',
      createdAt: '2026-01-06T07:50:00Z',
    },
    {
      id: 'tr_07',
      accountId: 'acc_apex_50k',
      date: addDaysISO(today, -6),
      symbol: 'NQ',
      side: 'Short',
      setup: 'Inducement + CISD',
      rMultiple: 2.2,
      netPnl: 660,
      mentalState: 'Calm',
      ruleFollowed: true,
      note: 'Clean NY PM Silver Bullet short off premium FVG + CISD.',
      createdAt: '2026-01-07T19:15:00Z',
    },
    {
      id: 'tr_08',
      accountId: 'acc_fp_50k',
      date: addDaysISO(today, -5),
      symbol: 'XAUUSD',
      side: 'Long',
      setup: 'Liquidity Sweep + CISD + BB',
      rMultiple: 2.5,
      netPnl: 750,
      mentalState: 'Focused',
      ruleFollowed: true,
      note: 'Sweep of NY midnight open followed by displacement above breaker.',
      createdAt: '2026-01-08T14:25:00Z',
    },
    {
      id: 'tr_09',
      accountId: 'acc_ftmo_100k',
      date: addDaysISO(today, -4),
      symbol: 'US30',
      side: 'Long',
      setup: 'Inducement + CISD',
      rMultiple: -1.5,
      netPnl: -750,
      mentalState: 'Revenge',
      ruleFollowed: false,
      note: 'Forced second entry mid-range after missing initial London expansion.',
      createdAt: '2026-01-09T16:10:00Z',
    },
    {
      id: 'tr_10',
      accountId: 'acc_apex_50k',
      date: addDaysISO(today, -3),
      symbol: 'NAS100',
      side: 'Long',
      setup: 'Inducement + CISD',
      rMultiple: 2.4,
      netPnl: 720,
      mentalState: 'Focused',
      ruleFollowed: true,
      note: 'Textbook NY AM Silver Bullet continuation after inducement sweep.',
      beforeChartId: 'img_demo_before_2',
      afterChartId: 'img_demo_after_2',
      createdAt: '2026-01-10T15:18:00Z',
    },
    {
      id: 'tr_11',
      accountId: 'acc_fp_50k',
      date: addDaysISO(today, -2),
      symbol: 'GBPJPY',
      side: 'Short',
      setup: 'Liquidity Sweep + CISD + BB',
      rMultiple: 2.1,
      netPnl: 630,
      mentalState: 'Calm',
      ruleFollowed: true,
      note: 'Asian Killzone high swept right into London open, clean CISD.',
      createdAt: '2026-01-11T08:05:00Z',
    },
    {
      id: 'tr_12',
      accountId: 'acc_ftmo_100k',
      date: addDaysISO(today, -1),
      symbol: 'EURUSD',
      side: 'Long',
      setup: 'Inducement + CISD',
      rMultiple: 1.8,
      netPnl: 900,
      mentalState: 'Calm',
      ruleFollowed: true,
      note: 'Patient wait for NY AM Killzone pullback, zero drawdown on fill.',
      createdAt: '2026-01-12T13:55:00Z',
    },
    {
      id: 'tr_13',
      accountId: 'acc_ftmo_100k',
      date: today,
      symbol: 'XAUUSD',
      side: 'Long',
      setup: 'Liquidity Sweep + CISD + BB',
      rMultiple: 3.2,
      netPnl: 1600,
      mentalState: 'Focused',
      ruleFollowed: true,
      note: 'Prime NY AM Killzone sellside sweep + M5 CISD + Breaker Block retest to 2694.80.',
      beforeChartId: 'img_demo_before_1',
      afterChartId: 'img_demo_after_1',
      createdAt: '2026-01-13T14:10:00Z',
    },
    {
      id: 'tr_14',
      accountId: 'acc_fp_50k',
      date: today,
      symbol: 'NAS100',
      side: 'Short',
      setup: 'Inducement + CISD',
      rMultiple: -0.8,
      netPnl: -240,
      mentalState: 'Calm',
      ruleFollowed: true,
      note: 'Trimmed risk early when structure invalidated during NY AM Silver Bullet.',
      createdAt: '2026-01-13T15:25:00Z',
    },
  ];

  const roiEntries: RoiEntry[] = [
    {
      id: 'roi_01',
      date: addDaysISO(today, -95),
      type: 'Challenge Fee',
      accountId: 'acc_ftmo_100k',
      firm: 'FTMO',
      grossAmount: 585,
      netAmount: -585,
      note: 'FTMO 100K Swing 2-Step Evaluation fee',
    },
    {
      id: 'roi_02',
      date: addDaysISO(today, -72),
      type: 'Challenge Fee',
      accountId: 'acc_fp_50k',
      firm: 'FundingPips',
      grossAmount: 299,
      netAmount: -299,
      note: 'FundingPips 50K Evaluation fee',
    },
    {
      id: 'roi_03',
      date: addDaysISO(today, -64),
      type: 'Reset Fee',
      firm: 'Apex Trader',
      grossAmount: 85,
      netAmount: -85,
      note: 'Reset fee on earlier 50K PA attempt',
    },
    {
      id: 'roi_04',
      date: addDaysISO(today, -48),
      type: 'Payout',
      accountId: 'acc_ftmo_100k',
      firm: 'FTMO',
      grossAmount: 2650,
      traderSplitPct: 80,
      netAmount: 2120,
      note: 'First bi-weekly funded payout (80% split + fee refund)',
    },
    {
      id: 'roi_05',
      date: addDaysISO(today, -32),
      type: 'Activation Fee',
      accountId: 'acc_fp_50k',
      firm: 'FundingPips',
      grossAmount: 130,
      netAmount: -130,
      note: 'Master funded account activation fee',
    },
    {
      id: 'roi_06',
      date: addDaysISO(today, -20),
      type: 'Payout',
      accountId: 'acc_fp_50k',
      firm: 'FundingPips',
      grossAmount: 1850,
      traderSplitPct: 80,
      netAmount: 1480,
      note: 'FundingPips Tuesday payout processed via Wise',
    },
    {
      id: 'roi_07',
      date: addDaysISO(today, -18),
      type: 'Challenge Fee',
      accountId: 'acc_apex_50k',
      firm: 'Apex Trader',
      grossAmount: 167,
      netAmount: -167,
      note: 'Apex 50K Eval Phase 1 subscription',
    },
    {
      id: 'roi_08',
      date: addDaysISO(today, -6),
      type: 'Payout',
      accountId: 'acc_ftmo_100k',
      firm: 'FTMO',
      grossAmount: 3100,
      traderSplitPct: 90,
      netAmount: 2790,
      note: 'Scaled 90% split bi-weekly payout',
    },
  ];

  return { accounts, trades, roiEntries, images };
}
