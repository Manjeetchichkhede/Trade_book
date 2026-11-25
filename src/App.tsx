import { useCallback, useEffect, useRef, useState } from 'react';
import { WifiOff } from 'lucide-react';
import {
  AppSettings,
  AutoBackupState,
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
  getImage,
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
import { CUSTOM_WALLPAPER_IMAGE_ID, getWallpaperPreset } from './data/wallpapers';
import { getTodayISO } from './utils/format';
import {
  clearSavedFolderHandle,
  getAutoBackupMeta,
  getSavedFolderInfo,
  isFolderPickerSupported,
  isInIframe,
  isOpfsSupported,
  performAutoBackupOverwrite,
  pickCustomBackupFolder,
  readLatestAutoBackupText,
  resumeSavedFolderPermission,
} from './utils/autoBackup';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { Navbar } from './components/Navbar';
import { OverviewTab } from './components/OverviewTab';
import { AccountsTab } from './components/AccountsTab';
import { JournalTab } from './components/JournalTab';
import { LotSizeTab } from './components/LotSizeTab';
import { SessionsTab } from './components/SessionsTab';
import { RoiTab } from './components/RoiTab';
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
  const [customWallpaperUrl, setCustomWallpaperUrl] = useState<string | null>(null);
  const [autoBackupState, setAutoBackupState] = useState<AutoBackupState>(() => ({
    status: 'idle',
    lastSavedAt: null,
    fileSizeBytes: 0,
    targetType: isOpfsSupported() ? 'opfs' : 'idb',
    displayPath: `${DEFAULT_SETTINGS.autoBackupFolder}/${DEFAULT_SETTINGS.autoBackupFileName}`,
    writeCount: 0,
    linkedFolderName: null,
    needsFolderPermission: false,
    folderPickerSupported: isFolderPickerSupported(),
    inIframe: isInIframe(),
    errorMessage: null,
  }));
  const autoBackupInitializedRef = useRef(false);
  const lastSavedAtRef = useRef<string | null>(null);

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
        savedWallpaper,
        savedAutoBackupMeta,
        savedFolderInfo,
      ] = await Promise.all([
        kvGet<boolean>('seeded_v2'),
        kvGet<PropAccount[]>('accounts'),
        kvGet<Trade[]>('trades'),
        kvGet<RoiEntry[]>('roiEntries'),
        kvGet<AppSettings>('settings'),
        kvGet<ChecklistItem[]>('checklist'),
        kvGet<EconomicNewsEvent[]>('newsEvents'),
        kvGet<GuardrailConfig>('guardrailConfig'),
        getImage(CUSTOM_WALLPAPER_IMAGE_ID),
        getAutoBackupMeta(),
        getSavedFolderInfo(),
      ]);

      if (!active) return;

      setCustomWallpaperUrl(savedWallpaper);
      lastSavedAtRef.current = savedAutoBackupMeta.lastSavedAt;
      setAutoBackupState((prev) => ({
        ...prev,
        ...savedAutoBackupMeta,
        status: savedAutoBackupMeta.lastSavedAt ? 'saved' : 'idle',
        linkedFolderName: savedFolderInfo.name,
        needsFolderPermission:
          Boolean(savedFolderInfo.handle) && savedFolderInfo.permission !== 'granted',
      }));

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
        const mergedSettings: AppSettings = {
          ...DEFAULT_SETTINGS,
          ...(savedSettings ?? {}),
        };
        if (!savedSettings?.cursorEffect) {
          mergedSettings.cursorEffect =
            savedSettings?.cursorAnimation === false ? 'none' : DEFAULT_SETTINGS.cursorEffect;
        }
        setSettings(mergedSettings);

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

  // Sync theme, font, window opacity, glass & gradient attributes on <html>
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', settings.theme);
    root.setAttribute('data-font', settings.font);
    root.setAttribute('data-glass-page', String(settings.glassPage));
    root.setAttribute('data-glass-nav', String(settings.glassNav));
    root.setAttribute('data-bg-gradient', String(settings.bgGradient));

    const rawOpacity = Number.isFinite(settings.windowOpacity) ? settings.windowOpacity : 70;
    const cardAlpha = Math.min(1, Math.max(0.15, rawOpacity / 100));
    const navAlpha = Math.min(1, cardAlpha + 0.08);
    const elevatedAlpha = Math.min(1, cardAlpha + 0.1);
    const inputAlpha = Math.min(1, cardAlpha + 0.12);

    root.style.setProperty('--window-opacity', cardAlpha.toFixed(2));
    root.style.setProperty('--nav-opacity', navAlpha.toFixed(2));
    root.style.setProperty('--elevated-opacity', elevatedAlpha.toFixed(2));
    root.style.setProperty('--input-opacity', inputAlpha.toFixed(2));
    root.style.removeProperty('--text-primary');

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', THEME_COLORS[settings.theme]);
    }
  }, [settings]);

  // Disable zoom in / zoom out (Ctrl/Cmd+wheel, Ctrl/Cmd+ +/-/0, pinch-to-zoom, Safari gestures)
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        (['+', '-', '=', '_', '0'].includes(e.key) ||
          ['Equal', 'Minus', 'Digit0', 'NumpadAdd', 'NumpadSubtract', 'Numpad0'].includes(e.code))
      ) {
        e.preventDefault();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    const preventGesture = (e: Event) => {
      e.preventDefault();
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('gesturestart', preventGesture, { passive: false });
    document.addEventListener('gesturechange', preventGesture, { passive: false });
    document.addEventListener('gestureend', preventGesture, { passive: false });

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('gesturestart', preventGesture);
      document.removeEventListener('gesturechange', preventGesture);
      document.removeEventListener('gestureend', preventGesture);
    };
  }, []);

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
    kvSet('guardrailConfig', guardrailConfig);
  }, [guardrailConfig, hydrated]);

  const handleUpdateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleUploadWallpaper = useCallback(async (dataUrl: string) => {
    await saveImage(CUSTOM_WALLPAPER_IMAGE_ID, dataUrl);
    setCustomWallpaperUrl(dataUrl);
    setSettings((prev) => ({ ...prev, wallpaperPreset: 'custom' }));
  }, []);

  const handleRemoveWallpaper = useCallback(async () => {
    await deleteImage(CUSTOM_WALLPAPER_IMAGE_ID);
    setCustomWallpaperUrl(null);
    setSettings((prev) => ({
      ...prev,
      wallpaperPreset: prev.wallpaperPreset === 'custom' ? 'none' : prev.wallpaperPreset,
    }));
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

  const handleUpdateTrade = useCallback((updated: Trade) => {
    setTrades((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
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
      version: '2.6.0',
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
        setCustomWallpaperUrl(
          parsed.images[CUSTOM_WALLPAPER_IMAGE_ID]
            ? String(parsed.images[CUSTOM_WALLPAPER_IMAGE_ID])
            : null
        );
      } else {
        setCustomWallpaperUrl(null);
      }
      setAccounts(parsed.accounts);
      setTrades(parsed.trades);
      setRoiEntries(Array.isArray(parsed.roiEntries) ? parsed.roiEntries : []);
      if (parsed.settings) {
        setSettings((prev) => {
          const next: AppSettings = {
            ...DEFAULT_SETTINGS,
            ...parsed.settings,
            traderName: parsed.settings?.traderName || prev.traderName,
          };
          if (!parsed.settings?.cursorEffect) {
            next.cursorEffect =
              parsed.settings?.cursorAnimation === false ? 'none' : DEFAULT_SETTINGS.cursorEffect;
          }
          return next;
        });
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

  const runAutoBackupNow = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    setAutoBackupState((prev) => ({ ...prev, status: 'saving', errorMessage: null }));
    try {
      const payload = await handleBuildBackupPayload();
      const result = await performAutoBackupOverwrite(
        payload,
        settings.autoBackupFolder,
        settings.autoBackupFileName
      );
      lastSavedAtRef.current = result.meta.lastSavedAt;
      setAutoBackupState((prev) => ({
        ...prev,
        ...result.meta,
        status: 'saved',
        linkedFolderName: result.linkedFolderName,
        needsFolderPermission: result.needsFolderPermission,
        errorMessage: null,
      }));
      return {
        ok: true,
        message: `Overwrote ${result.meta.displayPath} successfully.`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Auto-backup overwrite failed.';
      setAutoBackupState((prev) => ({ ...prev, status: 'error', errorMessage: msg }));
      return { ok: false, message: msg };
    }
  }, [handleBuildBackupPayload, settings.autoBackupFolder, settings.autoBackupFileName]);

  // Automatically overwrite JSON backup whenever ANY app data changes (zero permission prompts)
  useEffect(() => {
    if (!hydrated || !settings.autoBackupEnabled) return;

    // On first hydrated pass, only run immediately if no backup snapshot exists yet
    if (!autoBackupInitializedRef.current) {
      autoBackupInitializedRef.current = true;
      if (lastSavedAtRef.current) return;
    }

    const timer = window.setTimeout(() => {
      void runAutoBackupNow();
    }, 900);

    return () => window.clearTimeout(timer);
  }, [
    hydrated,
    settings.autoBackupEnabled,
    accounts,
    trades,
    roiEntries,
    settings,
    checklist,
    newsEvents,
    guardrailConfig,
    customWallpaperUrl,
    runAutoBackupNow,
  ]);

  const handlePickAutoBackupFolder = useCallback(async (): Promise<{
    ok: boolean;
    message: string;
  }> => {
    const res = await pickCustomBackupFolder();
    if (!res.ok) {
      return { ok: false, message: res.reason === 'cancelled' ? '' : res.message };
    }
    setAutoBackupState((prev) => ({
      ...prev,
      linkedFolderName: res.name,
      needsFolderPermission: false,
      errorMessage: null,
    }));
    const writeRes = await runAutoBackupNow();
    return writeRes.ok
      ? {
          ok: true,
          message: `Folder "${res.name}" linked & backup overwritten. Future changes will overwrite automatically.`,
        }
      : writeRes;
  }, [runAutoBackupNow]);

  const handleResumeAutoBackupFolder = useCallback(async (): Promise<{
    ok: boolean;
    message: string;
  }> => {
    const res = await resumeSavedFolderPermission();
    if (!res.ok) return res;
    setAutoBackupState((prev) => ({ ...prev, needsFolderPermission: false, errorMessage: null }));
    const writeRes = await runAutoBackupNow();
    return writeRes.ok ? res : writeRes;
  }, [runAutoBackupNow]);

  const handleClearAutoBackupFolder = useCallback(async () => {
    await clearSavedFolderHandle();
    setAutoBackupState((prev) => ({
      ...prev,
      linkedFolderName: null,
      needsFolderPermission: false,
      targetType: isOpfsSupported() ? 'opfs' : 'idb',
    }));
    if (settings.autoBackupEnabled) {
      await runAutoBackupNow();
    }
  }, [runAutoBackupNow, settings.autoBackupEnabled]);

  const handleDownloadAutoBackup = useCallback(async (): Promise<{
    ok: boolean;
    message: string;
  }> => {
    const found = await readLatestAutoBackupText(
      settings.autoBackupFolder,
      settings.autoBackupFileName
    );
    if (!found) {
      return { ok: false, message: 'No auto-backup JSON file exists yet. Click Overwrite Now first.' };
    }
    const blob = new Blob([found.text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = found.fileName;
    a.click();
    URL.revokeObjectURL(url);
    return { ok: true, message: `Downloaded latest auto-backup (${found.fileName}).` };
  }, [settings.autoBackupFolder, settings.autoBackupFileName]);

  const handleRestoreAutoBackup = useCallback(async (): Promise<{
    ok: boolean;
    message: string;
  }> => {
    const found = await readLatestAutoBackupText(
      settings.autoBackupFolder,
      settings.autoBackupFileName
    );
    if (!found) {
      return { ok: false, message: 'No auto-backup JSON file found to restore.' };
    }
    try {
      const parsed = JSON.parse(found.text) as Partial<BackupPayload>;
      return await handleApplyBackupPayload(parsed);
    } catch {
      return { ok: false, message: 'Stored auto-backup JSON file is corrupted.' };
    }
  }, [handleApplyBackupPayload, settings.autoBackupFolder, settings.autoBackupFileName]);

  const handleResetDemoData = useCallback(async () => {
    const existingWallpaper = await getImage(CUSTOM_WALLPAPER_IMAGE_ID);
    await clearAllImages();
    const demo = createDemoSeed();
    const freshChecklist = createDefaultChecklist();
    const freshNews = createDefaultNewsEvents();
    const freshGuardrail = createDefaultGuardrailConfig();
    await Promise.all([
      ...Object.entries(demo.images).map(([id, dataUrl]) => saveImage(id, dataUrl)),
      ...(existingWallpaper ? [saveImage(CUSTOM_WALLPAPER_IMAGE_ID, existingWallpaper)] : []),
    ]);
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

  const activePreset = getWallpaperPreset(settings.wallpaperPreset);
  const hasCustomWallpaper = settings.wallpaperPreset === 'custom' && Boolean(customWallpaperUrl);
  const showWallpaperLayer =
    hasCustomWallpaper || (settings.wallpaperPreset !== 'none' && Boolean(activePreset));
  const dimScrimColor =
    settings.theme === 'light'
      ? `rgba(238, 242, 248, ${Math.min(0.85, Math.max(0, settings.wallpaperDim / 100))})`
      : `rgba(6, 10, 20, ${Math.min(0.85, Math.max(0, settings.wallpaperDim / 100))})`;

  return (
    <div className="relative min-h-screen w-full overflow-x-clip">
      {/* Fixed ambient multi-tone radial background gradient */}
      <div className="tb-ambient-bg" aria-hidden="true" />

      {/* Custom or Preset Background Wallpaper Layer */}
      {showWallpaperLayer && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
        >
          <div
            className="absolute inset-0 transition-all duration-300"
            style={{
              ...(hasCustomWallpaper
                ? {
                    backgroundImage: `url(${customWallpaperUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                  }
                : {
                    background: activePreset?.background,
                    backgroundSize: activePreset?.backgroundSize,
                  }),
              filter: settings.wallpaperBlur > 0 ? `blur(${settings.wallpaperBlur}px)` : undefined,
              transform: settings.wallpaperBlur > 0 ? 'scale(1.06)' : undefined,
            }}
          />
          <div
            className="absolute inset-0 transition-colors duration-200"
            style={{ backgroundColor: dimScrimColor }}
          />
        </div>
      )}

      {/* Interactive cursor-reactive ambient animation on Windows/desktop */}
      <CursorBackground effect={settings.cursorEffect} theme={settings.theme} />

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
                  checklist={checklist}
                  preselectedAccountId={preselectedJournalAcc}
                  onClearPreselectedAccount={() => setPreselectedJournalAcc(null)}
                  onAddTrade={handleAddTrade}
                  onUpdateTrade={handleUpdateTrade}
                  onBulkImportTrades={handleBulkImportTrades}
                  onDeleteTrade={handleDeleteTrade}
                  onUpdateChecklist={setChecklist}
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
        customWallpaperUrl={customWallpaperUrl}
        autoBackupState={autoBackupState}
        onUpdateSettings={handleUpdateSettings}
        onUploadWallpaper={handleUploadWallpaper}
        onRemoveWallpaper={handleRemoveWallpaper}
        onPickAutoBackupFolder={handlePickAutoBackupFolder}
        onResumeAutoBackupFolder={handleResumeAutoBackupFolder}
        onClearAutoBackupFolder={handleClearAutoBackupFolder}
        onRunAutoBackupNow={runAutoBackupNow}
        onDownloadAutoBackup={handleDownloadAutoBackup}
        onRestoreAutoBackup={handleRestoreAutoBackup}
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
