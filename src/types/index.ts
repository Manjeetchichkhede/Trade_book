export type TabId =
  | 'overview'
  | 'accounts'
  | 'journal'
  | 'lotsize'
  | 'sessions'
  | 'roi';

export type ThemeId = 'dark' | 'light' | 'monochrome' | 'bw';
export type FontId = 'inter' | 'google-sans' | 'play' | 'ubuntu' | 'ios' | 'comfortaa' | 'mono';
export type ClockStyleId = 'roman' | 'modern' | 'neon' | 'digital';
export type CurrencyId = 'USD' | 'INR';
export type DstMode = 'auto' | 'winter' | 'summer';
export type CursorEffectId =
  | 'aurora-grid'
  | 'spotlight'
  | 'crosshair'
  | 'particles'
  | 'magnetic-rings'
  | 'none';
export type WallpaperPresetId =
  | 'none'
  | 'aurora'
  | 'midnight-mesh'
  | 'emerald-matrix'
  | 'sunset-horizon'
  | 'obsidian-grid'
  | 'custom';

export type AccountStage = 'Funded' | 'Eval Phase 1' | 'Eval Phase 2';
export type DrawdownType = 'EOD Trailing' | 'Intraday Trailing' | 'Static';

export interface PropAccount {
  id: string;
  firm: string;
  name: string;
  stage: AccountStage;
  startingBalance: number;
  drawdownType: DrawdownType;
  dailyLossLimit: number;
  maxDrawdown: number;
  profitTarget?: number;
  minTradingDays: number;
  consistencyCapPct: number;
  evalFee: number;
  createdAt: string;
}

export type PlaybookSetup = 'Inducement + CISD' | 'Liquidity Sweep + CISD + BB';

export const PLAYBOOK_SETUPS: readonly PlaybookSetup[] = [
  'Inducement + CISD',
  'Liquidity Sweep + CISD + BB',
] as const;

export type TradeSide = 'Long' | 'Short';
export type TradeStatus = 'open' | 'closed';
export type MentalState = 'Focused' | 'Calm' | 'Anxious' | 'Overconfident' | 'Revenge';

export const MENTAL_STATES: readonly MentalState[] = [
  'Focused',
  'Calm',
  'Anxious',
  'Overconfident',
  'Revenge',
] as const;

export interface Trade {
  id: string;
  accountId: string;
  date: string; // YYYY-MM-DD
  symbol: string;
  side: TradeSide;
  setup: PlaybookSetup;
  status?: TradeStatus;
  rMultiple: number;
  netPnl: number;
  mentalState: MentalState;
  ruleFollowed: boolean;
  note: string;
  beforeChartId?: string;
  afterChartId?: string;
  createdAt: string;
}

export type RoiEntryType = 'Payout' | 'Challenge Fee' | 'Reset Fee' | 'Activation Fee';

export interface RoiEntry {
  id: string;
  date: string; // YYYY-MM-DD
  type: RoiEntryType;
  accountId?: string;
  firm: string;
  grossAmount: number;
  traderSplitPct?: number; // only for Payout
  netAmount: number; // positive for Payout, negative for Fees
  note: string;
}

export type ChecklistScope = 'All' | PlaybookSetup;

export interface ChecklistItem {
  id: string;
  label: string;
  setupScope: ChecklistScope;
  required: boolean;
  checked: boolean;
}

export type NewsCurrency = 'USD' | 'EUR' | 'GBP' | 'JPY';
export type NewsImpact = 'High' | 'Medium';

export interface EconomicNewsEvent {
  id: string;
  date: string; // YYYY-MM-DD (NY market date)
  nyTime: string; // HH:MM (24h NY local time)
  currency: NewsCurrency;
  impact: NewsImpact;
  title: string;
  forecast?: string;
  previous?: string;
}

export interface GuardrailConfig {
  newsBufferMinutes: 2 | 5 | 15;
  enableNewsWarnings: boolean;
  checklistDate: string;
}

export interface AppSettings {
  traderName: string;
  theme: ThemeId;
  font: FontId;
  clockStyle: ClockStyleId;
  currency: CurrencyId;
  dstMode: DstMode;
  glassPage: boolean;
  glassNav: boolean;
  bgGradient: boolean;
  cursorAnimation: boolean;
  cursorEffect: CursorEffectId;
  liveClocksOverview: boolean;
  breachGuardrail: boolean;
  compactAccounts: boolean;
  privacyMode: boolean;
  wallpaperPreset: WallpaperPresetId;
  wallpaperDim: number; // 0 - 85 (%)
  wallpaperBlur: number; // 0 - 20 (px)
  windowOpacity: number; // 15 - 100 (%)
  autoBackupEnabled: boolean;
  autoBackupFolder: string;
  autoBackupFileName: string;
}

export type AutoBackupTargetType = 'folder' | 'opfs' | 'idb';

export interface AutoBackupMeta {
  lastSavedAt: string | null;
  fileSizeBytes: number;
  targetType: AutoBackupTargetType;
  displayPath: string;
  writeCount: number;
}

export interface AutoBackupState extends AutoBackupMeta {
  status: 'idle' | 'saving' | 'saved' | 'error';
  linkedFolderName: string | null;
  needsFolderPermission: boolean;
  folderPickerSupported: boolean;
  inIframe: boolean;
  errorMessage: string | null;
}

export interface AccountMetrics {
  account: PropAccount;
  equity: number;
  netPnl: number;
  netPnlPct: number;
  todayPnl: number;
  dailyUsed: number;
  dailyUsedPct: number;
  dailyRemaining: number;
  dailyBreachFloor: number;
  highWaterMark: number;
  maxDdUsed: number;
  maxDdUsedPct: number;
  maxDdRemaining: number;
  maxDdBreachFloor: number;
  profitTargetPct: number;
  tradingDaysCount: number;
  consistencyPct: number;
  bestDayPnl: number;
  tradesCount: number;
}

export interface BackupPayload {
  version: string;
  exportedAt: string;
  accounts: PropAccount[];
  trades: Trade[];
  roiEntries: RoiEntry[];
  settings: AppSettings;
  images: Record<string, string>;
  checklist?: ChecklistItem[];
  newsEvents?: EconomicNewsEvent[];
  guardrailConfig?: GuardrailConfig;
}
