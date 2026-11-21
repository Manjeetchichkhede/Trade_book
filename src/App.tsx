import { useCallback, useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import {
  AppSettings,
  BackupPayload,
  ChecklistItem,
  EconomicNewsEvent,
  GuardrailConfig,
  PropAccount,
  RoiEntry,
  TabId,
  Trade,
} from './types';
import {
  clearAllImages,
  deleteImage,
  getAllImages,
  kvGet,
  kvSet,
  saveImage,
} from './db/storage';
import {
  createDefaultChecklist,
  createDefaultGuardrailConfig,
  createDefaultNewsEvents,
  createDemoSeed,
  DEFAULT_SETTINGS,
} from './data/demoData';
import { getTodayISO } from './utils/format';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { Navbar } from './components/Navbar';
import { OverviewTab } from './components/OverviewTab';
import { AccountsTab } from './components/AccountsTab';
import { JournalTab } from './components/JournalTab';
import { LotSizeTab } from './components/LotSizeTab';
import { SessionsTab } from './components/SessionsTab';
import { RoiTab } from './components/RoiTab';
import { GuardTab } from './components/GuardTab';
import { SettingsModal } from './components/SettingsModal';
import { StartupNameModal } from './components/StartupNameModal';
import { CursorBackground } from './components/CursorBackground';

const THEME_COLORS: Record<AppSettings['theme'], string> = {
  dark: '#060a14',
  light: '#eef2f8',
  monochrome: '#0b0c0e',
  bw: '#000000',
};

export default function App() {
  const [hydrated, setHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [accounts, setAccounts] = useState<PropAccount[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [roiEntries, setRoiEntries] = useState<RoiEntry[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(() => createDefaultChecklist());
  const [newsEvents, setNewsEvents] = useState<EconomicNewsEvent[]>(() => createDefaultNewsEvents());
  const [guardrailConfig, setGuardrailConfig] = useState<GuardrailConfig>(() =>
    createDefaultGuardrailConfig()
  );

  const [preselectedJournalAcc, setPreselectedJournalAcc] = useState<string | null>(null);
  const [preselectedPayoutAcc, setPreselectedPayoutAcc] = useState<string | null>(null);

  const isOnline = useOnlineStatus();

  // Hydrate offline store or seed demo data on first visit
  useEffect(() => {
    let active = true;
    (async () => {
      const [
        savedSeeded,
        savedAccounts,
        savedTrades,
        savedRoi,
        savedSettings,
        savedChecklist,
        savedNews,
        savedGuardrail,
      ] = await Promise.all([
        kvGet<boolean>('seeded_v2'),
        kvGet<PropAccount[]>('accounts'),
        kvGet<Trade[]>('trades'),
        kvGet<RoiEntry[]>('roiEntries'),
        kvGet<AppSettings>('settings'),
        kvGet<ChecklistItem[]>('checklist'),
        kvGet<EconomicNewsEvent[]>('newsEvents'),
        kvGet<GuardrailConfig>('guardrailConfig'),
      ]);

      if (!active) return;

      const today = getTodayISO();
      const defaultChecklist = createDefaultChecklist();
      const defaultNews = createDefaultNewsEvents();
      const defaultGuardrail = createDefaultGuardrailConfig();

      if (!savedSeeded || !savedAccounts) {
        const demo = createDemoSeed();
        setAccounts(demo.accounts);
        setTrades(demo.trades);
        setRoiEntries(demo.roiEntries);
        setSettings(DEFAULT_SETTINGS);
        setChecklist(defaultChecklist);
        setNewsEvents(defaultNews);
        setGuardrailConfig(defaultGuardrail);

        await Promise.all([
          kvSet('seeded_v2', true),
          kvSet('accounts', demo.accounts),
          kvSet('trades', demo.trades),
          kvSet('roiEntries', demo.roiEntries),
          kvSet('settings', DEFAULT_SETTINGS),
          kvSet('checklist', defaultChecklist),
          kvSet('newsEvents', defaultNews),
          kvSet('guardrailConfig', defaultGuardrail),
          ...Object.entries(demo.images).map(([id, dataUrl]) => saveImage(id, dataUrl)),
        ]);
      } else {
        setAccounts(savedAccounts);
        setTrades(savedTrades ?? []);
        setRoiEntries(savedRoi ?? []);
        setSettings({ ...DEFAULT_SETTINGS, ...(savedSettings ?? {}) });

        const mergedGuardrail: GuardrailConfig = {
          ...defaultGuardrail,
          ...(savedGuardrail ?? {}),
        };
        const rawChecklist =
          Array.isArray(savedChecklist) && savedChecklist.length > 0
            ? savedChecklist
            : defaultChecklist;

        // Auto-reset daily pre-trade checklist checks on a new calendar date
        if (mergedGuardrail.checklistDate !== today) {
          setChecklist(rawChecklist.map((item) => ({ ...item, checked: false })));
          setGuardrailConfig({ ...mergedGuardrail, checklistDate: today });
        } else {
          setChecklist(rawChecklist);
          setGuardrailConfig(mergedGuardrail);
        }

        setNewsEvents(
          Array.isArray(savedNews) && savedNews.length > 0 ? savedNews : defaultNews
        );
      }
      if (active) setHydrated(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Sync theme, font, custom fontColor, glass & gradient attributes on <html>
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', settings.theme);
    root.setAttribute('data-font', settings.font);
    root.setAttribute('data-glass-page', String(settings.glassPage));
    root.setAttribute('data-glass-nav', String(settings.glassNav));
    root.setAttribute('data-bg-gradient', String(settings.bgGradient));

    if (settings.fontColor && settings.fontColor.trim()) {
      root.style.setProperty('--text-primary', settings.fontColor.trim());
    } else {
      root.style.removeProperty('--text-primary');
    }

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', THEME_COLORS[settings.theme]);
    }
  }, [settings]);

  // Persist slices when hydrated
  useEffect(() => {
    if (!hydrated) return;
    kvSet('accounts', accounts);
  }, [accounts, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    kvSet('trades', trades);
  }, [trades, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    kvSet('roiEntries', roiEntries);
  }, [roiEntries, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    kvSet('settings', settings);
  }, [settings, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    kvSet('checklist', checklist);
  }, [checklist, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    kvSet('newsEvents', newsEvents);
  }, [newsEvents, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    kvSet('guardrailConfig', guardrailConfig);
  }, [guardrailConfig, hydrated]);

  const handleUpdateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSaveAccount = useCallback((account: PropAccount) => {
    setAccounts((prev) => {
      const exists = prev.some((a) => a.id === account.id);
      if (exists) return prev.map((a) => (a.id === account.id ? account : a));
      return [...prev, account];
    });
  }, []);

  const handleDeleteAccount = useCallback((accountId: string) => {
    setAccounts((prev) => prev.filter((a) => a.id !== accountId));
  }, []);

  const handleUpdateGuardrailConfig = useCallback((patch: Partial<GuardrailConfig>) => {
    setGuardrailConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleAddTrade = useCallback((trade: Trade) => {
    setTrades((prev) => [trade, ...prev]);
  }, []);

  const handleBulkImportTrades = useCallback((imported: Trade[]) => {
    if (imported.length === 0) return;
    setTrades((prev) => [...imported, ...prev]);
  }, []);

  const handleDeleteTrade = useCallback((tradeId: string) => {
    setTrades((prev) => {
      const target = prev.find((t) => t.id === tradeId);
      if (target?.beforeChartId) void deleteImage(target.beforeChartId);
      if (target?.afterChartId) void deleteImage(target.afterChartId);
      return prev.filter((t) => t.id !== tradeId);
    });
  }, []);

  const handleAddRoiEntry = useCallback((entry: RoiEntry) => {
    setRoiEntries((prev) => [entry, ...prev]);
  }, []);

  const handleDeleteRoiEntry = useCallback((id: string) => {
    setRoiEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const handleQuickLogForAccount = useCallback((accountId: string) => {
    setPreselectedJournalAcc(accountId);
    setActiveTab('journal');
  }, []);

  const handleQuickPayoutForAccount = useCallback((accountId: string) => {
    setPreselectedPayoutAcc(accountId);
    setActiveTab('roi');
  }, []);

  const handleBuildBackupPayload = useCallback(async (): Promise<BackupPayload> => {
    const images = await getAllImages();
    return {
      version: '2.5.0',
      exportedAt: new Date().toISOString(),
      accounts,
      trades,
      roiEntries,
      settings,
      images,
      checklist,
      newsEvents,
      guardrailConfig,
    };
  }, [accounts, trades, roiEntries, settings, checklist, newsEvents, guardrailConfig]);

  const handleApplyBackupPayload = useCallback(
    async (parsed: Partial<BackupPayload>): Promise<{ ok: boolean; message: string }> => {
      if (!Array.isArray(parsed.accounts) || !Array.isArray(parsed.trades)) {
        return { ok: false, message: 'Invalid backup file: missing accounts or trades.' };
      }
      await clearAllImages();
      if (parsed.images && typeof parsed.images === 'object') {
        await Promise.all(
          Object.entries(parsed.images).map(([id, dataUrl]) => saveImage(id, String(dataUrl)))
        );
      }
      setAccounts(parsed.accounts);
      setTrades(parsed.trades);
      setRoiEntries(Array.isArray(parsed.roiEntries) ? parsed.roiEntries : []);
      if (parsed.settings) {
        setSettings((prev) => ({
          ...DEFAULT_SETTINGS,
          ...parsed.settings,
          traderName: parsed.settings?.traderName || prev.traderName,
        }));
      }
      if (Array.isArray(parsed.checklist) && parsed.checklist.length > 0) {
        setChecklist(parsed.checklist);
      }
      if (Array.isArray(parsed.newsEvents) && parsed.newsEvents.length > 0) {
        setNewsEvents(parsed.newsEvents);
      }
      if (parsed.guardrailConfig) {
        setGuardrailConfig({ ...createDefaultGuardrailConfig(), ...parsed.guardrailConfig });
      }
      return {
        ok: true,
        message: `Restored ${parsed.accounts.length} accounts & ${parsed.trades.length} trades.`,
      };
    },
    []
  );

  const handleBackupJson = useCallback(async () => {
    const payload = await handleBuildBackupPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tradebook-backup-${getTodayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [handleBuildBackupPayload]);

  const handleRestoreJson = useCallback(
    async (file: File): Promise<{ ok: boolean; message: string }> => {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as Partial<BackupPayload>;
        return await handleApplyBackupPayload(parsed);
      } catch {
        return { ok: false, message: 'Could not parse JSON backup file.' };
      }
    },
    [handleApplyBackupPayload]
  );

  const handleResetDemoData = useCallback(async () => {
    await clearAllImages();
    const demo = createDemoSeed();
    const freshChecklist = createDefaultChecklist();
    const freshNews = createDefaultNewsEvents();
    const freshGuardrail = createDefaultGuardrailConfig();
    await Promise.all(
      Object.entries(demo.images).map(([id, dataUrl]) => saveImage(id, dataUrl))
    );
    setAccounts(demo.accounts);
    setTrades(demo.trades);
    setRoiEntries(demo.roiEntries);
    setChecklist(freshChecklist);
    setNewsEvents(freshNews);
    setGuardrailConfig(freshGuardrail);
    await Promise.all([
      kvSet('seeded_v2', true),
      kvSet('accounts', demo.accounts),
      kvSet('trades', demo.trades),
      kvSet('roiEntries', demo.roiEntries),
      kvSet('checklist', freshChecklist),
      kvSet('newsEvents', freshNews),
      kvSet('guardrailConfig', freshGuardrail),
    ]);
  }, []);

  return (
    <div className="relative min-h-screen w-full overflow-x-clip">
      {/* Fixed ambient multi-tone radial background gradient */}
      <div className="tb-ambient-bg" aria-hidden="true" />
      {/* Interactive cursor-reactive ambient animation on Windows/desktop */}
      <CursorBackground
        enabled={settings.cursorAnimation && settings.bgGradient}
        theme={settings.theme}
      />

      <div className="relative z-10 flex min-h-screen flex-col">
        <Navbar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 sm:px-6 pt-3 pb-28 md:pb-12">
          {!hydrated ? (
            <div className="space-y-4 py-6">
              <div className="tb-glass h-40 rounded-2xl animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="tb-glass h-28 rounded-2xl animate-pulse" />
                ))}
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewTab
                  accounts={accounts}
                  trades={trades}
                  roiEntries={roiEntries}
                  settings={settings}
                  newsEvents={newsEvents}
                  guardrailConfig={guardrailConfig}
                  onNavigateTab={setActiveTab}
                />
              )}

              {activeTab === 'accounts' && (
                <AccountsTab
                  accounts={accounts}
                  trades={trades}
                  settings={settings}
                  onSaveAccount={handleSaveAccount}
                  onDeleteAccount={handleDeleteAccount}
                  onQuickLogForAccount={handleQuickLogForAccount}
                  onQuickPayoutForAccount={handleQuickPayoutForAccount}
                />
              )}

              {activeTab === 'journal' && (
                <JournalTab
                  accounts={accounts}
                  trades={trades}
                  settings={settings}
                  newsEvents={newsEvents}
                  guardrailConfig={guardrailConfig}
                  preselectedAccountId={preselectedJournalAcc}
                  onClearPreselectedAccount={() => setPreselectedJournalAcc(null)}
                  onAddTrade={handleAddTrade}
                  onBulkImportTrades={handleBulkImportTrades}
                  onDeleteTrade={handleDeleteTrade}
                  onNavigateTab={setActiveTab}
                />
              )}

              {activeTab === 'lotsize' && (
                <LotSizeTab accounts={accounts} trades={trades} settings={settings} />
              )}

              {activeTab === 'sessions' && (
                <SessionsTab settings={settings} onUpdateSettings={handleUpdateSettings} />
              )}

              {activeTab === 'roi' && (
                <RoiTab
                  accounts={accounts}
                  roiEntries={roiEntries}
                  settings={settings}
                  preselectedPayoutAccountId={preselectedPayoutAcc}
                  onClearPreselectedPayout={() => setPreselectedPayoutAcc(null)}
                  onAddRoiEntry={handleAddRoiEntry}
                  onDeleteRoiEntry={handleDeleteRoiEntry}
                />
              )}

              {activeTab === 'guard' && (
                <GuardTab
                  settings={settings}
                  checklist={checklist}
                  newsEvents={newsEvents}
                  guardrailConfig={guardrailConfig}
                  onUpdateChecklist={setChecklist}
                  onUpdateNewsEvents={setNewsEvents}
                  onUpdateGuardrailConfig={handleUpdateGuardrailConfig}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Offline Banner (only shown when offline) */}
      {!isOnline && (
        <div className="fixed bottom-20 md:bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/20 px-3.5 py-2 text-xs font-semibold text-amber-300 backdrop-blur-md shadow-lg">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Offline Mode — Local IndexedDB data active</span>
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onBuildBackupPayload={handleBuildBackupPayload}
        onApplyBackupPayload={handleApplyBackupPayload}
        onBackupJson={handleBackupJson}
        onRestoreJson={handleRestoreJson}
        onResetDemoData={handleResetDemoData}
        onClose={() => setSettingsOpen(false)}
      />

      {/* Startup Trader Name Prompt (shown until trader name is saved) */}
      <StartupNameModal
        open={hydrated && !settings.traderName.trim()}
        onSaveName={(name) => handleUpdateSettings({ traderName: name })}
      />
    </div>
  );
}
