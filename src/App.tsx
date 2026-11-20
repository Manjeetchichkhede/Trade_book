import { useCallback, useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import {
  AppSettings,
  BackupPayload,
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
import { createDemoSeed, DEFAULT_SETTINGS } from './data/demoData';
import { getTodayISO } from './utils/format';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { Navbar } from './components/Navbar';
import { OverviewTab } from './components/OverviewTab';
import { JournalTab } from './components/JournalTab';
import { LotSizeTab } from './components/LotSizeTab';
import { SessionsTab } from './components/SessionsTab';
import { RoiTab } from './components/RoiTab';
import { SettingsModal } from './components/SettingsModal';

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

  const [preselectedJournalAcc, setPreselectedJournalAcc] = useState<string | null>(null);
  const [preselectedPayoutAcc, setPreselectedPayoutAcc] = useState<string | null>(null);

  const isOnline = useOnlineStatus();

  // Hydrate offline store or seed demo data on first visit
  useEffect(() => {
    let active = true;
    (async () => {
      const [savedSeeded, savedAccounts, savedTrades, savedRoi, savedSettings] = await Promise.all([
        kvGet<boolean>('seeded_v2'),
        kvGet<PropAccount[]>('accounts'),
        kvGet<Trade[]>('trades'),
        kvGet<RoiEntry[]>('roiEntries'),
        kvGet<AppSettings>('settings'),
      ]);

      if (!active) return;

      if (!savedSeeded || !savedAccounts) {
        const demo = createDemoSeed();
        setAccounts(demo.accounts);
        setTrades(demo.trades);
        setRoiEntries(demo.roiEntries);
        setSettings(DEFAULT_SETTINGS);

        await Promise.all([
          kvSet('seeded_v2', true),
          kvSet('accounts', demo.accounts),
          kvSet('trades', demo.trades),
          kvSet('roiEntries', demo.roiEntries),
          kvSet('settings', DEFAULT_SETTINGS),
          ...Object.entries(demo.images).map(([id, dataUrl]) => saveImage(id, dataUrl)),
        ]);
      } else {
        setAccounts(savedAccounts);
        setTrades(savedTrades ?? []);
        setRoiEntries(savedRoi ?? []);
        setSettings({ ...DEFAULT_SETTINGS, ...(savedSettings ?? {}) });
      }
      if (active) setHydrated(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Sync theme, font, glass & gradient attributes on <html>
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', settings.theme);
    root.setAttribute('data-font', settings.font);
    root.setAttribute('data-glass-page', String(settings.glassPage));
    root.setAttribute('data-glass-nav', String(settings.glassNav));
    root.setAttribute('data-bg-gradient', String(settings.bgGradient));

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

  const handleAddTrade = useCallback((trade: Trade) => {
    setTrades((prev) => [trade, ...prev]);
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

  const handleBackupJson = useCallback(async () => {
    const images = await getAllImages();
    const payload: BackupPayload = {
      version: '2.4.0',
      exportedAt: new Date().toISOString(),
      accounts,
      trades,
      roiEntries,
      settings,
      images,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tradebook-backup-${getTodayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [accounts, trades, roiEntries, settings]);

  const handleRestoreJson = useCallback(
    async (file: File): Promise<{ ok: boolean; message: string }> => {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as Partial<BackupPayload>;
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
          setSettings({ ...DEFAULT_SETTINGS, ...parsed.settings });
        }
        return {
          ok: true,
          message: `Restored ${parsed.accounts.length} accounts & ${parsed.trades.length} trades.`,
        };
      } catch {
        return { ok: false, message: 'Could not parse JSON backup file.' };
      }
    },
    []
  );

  const handleResetDemoData = useCallback(async () => {
    await clearAllImages();
    const demo = createDemoSeed();
    await Promise.all(
      Object.entries(demo.images).map(([id, dataUrl]) => saveImage(id, dataUrl))
    );
    setAccounts(demo.accounts);
    setTrades(demo.trades);
    setRoiEntries(demo.roiEntries);
    await Promise.all([
      kvSet('seeded_v2', true),
      kvSet('accounts', demo.accounts),
      kvSet('trades', demo.trades),
      kvSet('roiEntries', demo.roiEntries),
    ]);
  }, []);

  return (
    <div className="relative min-h-screen w-full overflow-x-clip">
      {/* Fixed ambient multi-tone radial background gradient */}
      <div className="tb-ambient-bg" aria-hidden="true" />

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
                  onSaveAccount={handleSaveAccount}
                  onDeleteAccount={handleDeleteAccount}
                  onNavigateTab={setActiveTab}
                  onQuickLogForAccount={handleQuickLogForAccount}
                  onQuickPayoutForAccount={handleQuickPayoutForAccount}
                />
              )}

              {activeTab === 'journal' && (
                <JournalTab
                  accounts={accounts}
                  trades={trades}
                  settings={settings}
                  preselectedAccountId={preselectedJournalAcc}
                  onClearPreselectedAccount={() => setPreselectedJournalAcc(null)}
                  onAddTrade={handleAddTrade}
                  onDeleteTrade={handleDeleteTrade}
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
        onBackupJson={handleBackupJson}
        onRestoreJson={handleRestoreJson}
        onResetDemoData={handleResetDemoData}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
