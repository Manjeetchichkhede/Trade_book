import React, { useRef, useState } from 'react';
import {
  Check,
  Download,
  ImagePlus,
  RotateCcw,
  Trash2,
  Upload,
  X,
  AlertTriangle,
  Smartphone,
} from 'lucide-react';
import {
  AppSettings,
  AutoBackupState,
  BackupPayload,
  CurrencyId,
  CursorEffectId,
  FontId,
  ThemeId,
} from '../types';
import { compressImageFile } from '../db/storage';
import { WALLPAPER_PRESETS } from '../data/wallpapers';
import { CLOCK_STYLES } from './AnalogDial';
import { TradebookLogo } from './TradebookLogo';
import { AutoBackupCard } from './AutoBackupCard';
import { GoogleDriveBackupCard } from './GoogleDriveBackupCard';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface SettingsModalProps {
  open: boolean;
  settings: AppSettings;
  customWallpaperUrl: string | null;
  autoBackupState: AutoBackupState;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onUploadWallpaper: (dataUrl: string) => Promise<void>;
  onRemoveWallpaper: () => Promise<void>;
  onPickAutoBackupFolder: () => Promise<{ ok: boolean; message: string }>;
  onResumeAutoBackupFolder: () => Promise<{ ok: boolean; message: string }>;
  onClearAutoBackupFolder: () => Promise<void>;
  onRequestPersistentStorage: () => Promise<{ ok: boolean; message: string }>;
  onRunAutoBackupNow: () => Promise<{ ok: boolean; message: string }>;
  onDownloadAutoBackup: () => Promise<{ ok: boolean; message: string }>;
  onRestoreAutoBackup: () => Promise<{ ok: boolean; message: string }>;
  onBuildBackupPayload: () => Promise<BackupPayload>;
  onApplyBackupPayload: (payload: Partial<BackupPayload>) => Promise<{ ok: boolean; message: string }>;
  onBackupJson: () => Promise<void>;
  onRestoreJson: (file: File) => Promise<{ ok: boolean; message: string }>;
  onResetDemoData: () => Promise<void>;
  onClose: () => void;
}

const THEMES: { id: ThemeId; label: string; swatch: string }[] = [
  { id: 'dark', label: 'Dark', swatch: 'linear-gradient(135deg, #060a14 40%, #2563eb 100%)' },
  { id: 'light', label: 'Light', swatch: 'linear-gradient(135deg, #f8fafc 45%, #3b82f6 100%)' },
  { id: 'monochrome', label: 'Monochrome', swatch: 'linear-gradient(135deg, #0b0c0e 40%, #a1a1aa 100%)' },
  { id: 'bw', label: 'Black & White', swatch: 'linear-gradient(135deg, #000000 50%, #ffffff 50%)' },
];

const FONTS: { id: FontId; label: string; sample: string }[] = [
  { id: 'inter', label: 'Inter', sample: 'Clean geometric UI' },
  { id: 'google-sans', label: 'Google Sans', sample: 'Modern rounded clarity' },
  { id: 'play', label: 'Play', sample: 'Sharp tech precision' },
  { id: 'ubuntu', label: 'Ubuntu', sample: 'Humanist precision' },
  { id: 'ios', label: 'iOS 15.5', sample: 'SF Pro system look' },
  { id: 'comfortaa', label: 'Comfortaa', sample: 'Soft rounded display' },
  { id: 'mono', label: 'Terminal Mono', sample: '01:45:20 · +2.5R' },
];

const CURSOR_EFFECTS: { id: CursorEffectId; label: string; desc: string }[] = [
  { id: 'aurora-grid', label: 'Aurora Grid', desc: 'Soft luminous orbs & dot grid reveal' },
  { id: 'spotlight', label: 'Spotlight', desc: 'Clean focused ambient beam' },
  { id: 'crosshair', label: 'Trader Crosshair', desc: 'Precision terminal reticle lines' },
  { id: 'particles', label: 'Constellation', desc: 'Interactive particle trails & threads' },
  { id: 'magnetic-rings', label: 'Magnetic Rings', desc: 'Layered rings with click ripples' },
  { id: 'none', label: 'Off', desc: 'Disable cursor background effects' },
];

const CHANGELOG_HISTORY: { version: string; date: string; highlights: string[] }[] = [
  {
    version: 'v2.6.0 Glass Edition',
    date: 'Nov 2026',
    highlights: [
      'Journal split layout: Pre-Trade Checklist on left & fast Quick Trade Logger on right',
      'Two-stage logging: capture trade entry fast, update Net P&L & screenshots after TP/SL',
      'Overview live analog IST & NY clocks and streamlined Hero layout',
      'Unified Lot Size calculator with live Recommended Lot Size panel on the right',
      'Added Google Sans & Play fonts, Windows Opacity control, 5 Mouse Cursor Effects & Zoom Lock',
      'Zero-permission Auto-Backup JSON that overwrites automatically on every change with custom folder location',
    ],
  },
  {
    version: 'v2.5.0',
    date: 'Nov 2026',
    highlights: [
      'Custom Background Wallpaper presets & offline photo uploads with Dim/Blur controls',
      'MT5 HTML Trade History & broker CSV importer with UTF-16 & duplicate detection',
      'Google Drive Cloud Backup with one-click restore and encrypted JSON export',
    ],
  },
  {
    version: 'v2.4.0',
    date: 'Oct 2026',
    highlights: [
      'Dedicated Active Funded & Eval Accounts tab with live drawdown & consistency tracking',
      'Interactive Before & After Chart Annotator with drawing markup tools',
      'Swipeable mobile bottom navigation pill bar with 5-tab viewport fit',
    ],
  },
  {
    version: 'v2.0.0',
    date: 'Sep 2026',
    highlights: [
      'Offline-first IndexedDB PWA architecture with Glass Edition multi-theme UI',
      'IST & New York Killzone clocks, Prop Challenge ROI ledger, and Playbook audit',
    ],
  },
];

const TOGGLE_ITEMS: { key: keyof AppSettings; label: string; desc: string }[] = [
  {
    key: 'glassPage',
    label: 'Glass Effect on Page',
    desc: 'Frosted translucent blur on cards and panels',
  },
  {
    key: 'glassNav',
    label: 'Glass Effect on Navigation Bar',
    desc: 'Frosted translucent pill bar on desktop and mobile',
  },
  {
    key: 'bgGradient',
    label: 'Background Gradient Effect',
    desc: 'Ambient multi-tone radial glow behind all content',
  },
  {
    key: 'liveClocksOverview',
    label: 'Live Clocks on Overview',
    desc: 'Show ticking IST & NY analog clocks inside Hero card',
  },
  {
    key: 'breachGuardrail',
    label: 'Drawdown Breach Guardrail',
    desc: 'Warn & guard before saving a trade outcome that breaches firm rules',
  },
  {
    key: 'compactAccounts',
    label: 'Compact Account Cards',
    desc: 'Condense prop-firm cards for dense multi-account monitoring',
  },
  {
    key: 'privacyMode',
    label: 'Hide Dollar Balances (Privacy Mode)',
    desc: 'Mask all monetary figures with ••••• across every screen',
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  settings,
  customWallpaperUrl,
  autoBackupState,
  onUpdateSettings,
  onUploadWallpaper,
  onRemoveWallpaper,
  onPickAutoBackupFolder,
  onResumeAutoBackupFolder,
  onClearAutoBackupFolder,
  onRequestPersistentStorage,
  onRunAutoBackupNow,
  onDownloadAutoBackup,
  onRestoreAutoBackup,
  onBuildBackupPayload,
  onApplyBackupPayload,
  onBackupJson,
  onRestoreJson,
  onResetDemoData,
  onClose,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const wallpaperInputRef = useRef<HTMLInputElement | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [wallpaperBusy, setWallpaperBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const { isInstallable, isInstalled, install } = usePWAInstall();

  if (!open) return null;

  const handleWallpaperUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setWallpaperBusy(true);
    try {
      const dataUrl = await compressImageFile(file, 1920, 0.85);
      await onUploadWallpaper(dataUrl);
    } catch {
      setStatusMsg({ type: 'err', text: 'Could not read wallpaper image. Try PNG, JPG, or WebP.' });
    } finally {
      setWallpaperBusy(false);
      e.target.value = '';
    }
  };

  const handleBackup = async () => {
    await onBackupJson();
    setStatusMsg({ type: 'ok', text: 'Full offline JSON backup downloaded (including charts).' });
  };

  const handleRestoreChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await onRestoreJson(file);
    setStatusMsg({ type: res.ok ? 'ok' : 'err', text: res.message });
    e.target.value = '';
  };

  const handleConfirmReset = async () => {
    await onResetDemoData();
    setConfirmReset(false);
    setStatusMsg({ type: 'ok', text: 'Demo accounts, trades, charts, and ROI ledger restored.' });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 sm:p-5 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="tb-glass w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-5 sm:p-6 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Settings</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Customize appearance, typography, clocks, currency, and local offline data.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Settings"
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Optional PWA Install Card */}
        {!isInstalled && isInstallable && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-strong)] bg-[var(--accent-soft)] p-4">
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-[var(--accent-text)] shrink-0" />
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  Install tradebook App
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Install directly to your PC desktop or Android home screen for offline use.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={install}
              className="tb-btn-primary rounded-xl px-4 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              Install App
            </button>
          </div>
        )}

        {/* Trader Profile Name */}
        <section>
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
            Trader Greeting Name
          </h3>
          <input
            type="text"
            maxLength={60}
            value={settings.traderName}
            onChange={(e) => onUpdateSettings({ traderName: e.target.value })}
            placeholder="Enter your trader name..."
            className="tb-input w-full rounded-xl px-3.5 py-2.5 text-sm"
          />
          <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
            Saved locally and displayed in the header and Overview welcome greeting.
          </p>
        </section>

        {/* Theme */}
        <section>
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Theme</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {THEMES.map((t) => {
              const active = settings.theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onUpdateSettings({ theme: t.id })}
                  className="flex items-center gap-2.5 rounded-xl p-3 text-left transition-all cursor-pointer"
                  style={{
                    backgroundColor: active ? 'var(--accent-soft)' : 'var(--bg-input)',
                    border: active
                      ? '1px solid var(--accent)'
                      : '1px solid var(--border-subtle)',
                  }}
                >
                  <span
                    className="h-5 w-5 rounded-full shrink-0 border border-white/25"
                    style={{ background: t.swatch }}
                  />
                  <span className="text-xs font-medium text-[var(--text-primary)] truncate">
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Background Wallpaper */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Background Wallpaper
              </h3>
              <p className="text-[11px] text-[var(--text-muted)]">
                Pick a built-in ambient backdrop or upload your own photo (saved locally offline).
              </p>
            </div>
            <button
              type="button"
              disabled={wallpaperBusy}
              onClick={() => wallpaperInputRef.current?.click()}
              className="tb-btn-ghost inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium cursor-pointer disabled:opacity-50"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              {wallpaperBusy
                ? 'Processing...'
                : customWallpaperUrl
                ? 'Change Photo'
                : 'Upload Photo'}
            </button>
            <input
              ref={wallpaperInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleWallpaperUpload}
            />
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-3.5 space-y-3.5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {WALLPAPER_PRESETS.map((wp) => {
                const active = settings.wallpaperPreset === wp.id;
                return (
                  <button
                    key={wp.id}
                    type="button"
                    onClick={() => onUpdateSettings({ wallpaperPreset: wp.id })}
                    className="group relative overflow-hidden rounded-xl text-left transition-all cursor-pointer"
                    style={{
                      border: active
                        ? '2px solid var(--accent)'
                        : '1px solid var(--border-subtle)',
                    }}
                  >
                    <div
                      className="h-14 w-full"
                      style={{
                        background: wp.background,
                        backgroundSize: wp.backgroundSize,
                      }}
                    />
                    <div className="flex items-center justify-between gap-1.5 bg-[var(--bg-card-solid)] px-2.5 py-1.5">
                      <span className="text-[11px] font-medium text-[var(--text-primary)] truncate">
                        {wp.label}
                      </span>
                      {active && <Check className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" />}
                    </div>
                  </button>
                );
              })}

              {/* Custom Uploaded Wallpaper Card */}
              {customWallpaperUrl && (
                <div
                  className="relative overflow-hidden rounded-xl transition-all"
                  style={{
                    border:
                      settings.wallpaperPreset === 'custom'
                        ? '2px solid var(--accent)'
                        : '1px solid var(--border-subtle)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ wallpaperPreset: 'custom' })}
                    className="block w-full text-left cursor-pointer"
                  >
                    <div
                      className="h-14 w-full bg-cover bg-center"
                      style={{ backgroundImage: `url(${customWallpaperUrl})` }}
                    />
                    <div className="flex items-center justify-between gap-1.5 bg-[var(--bg-card-solid)] px-2.5 py-1.5">
                      <span className="text-[11px] font-medium text-[var(--text-primary)] truncate">
                        Custom Photo
                      </span>
                      {settings.wallpaperPreset === 'custom' && (
                        <Check className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" />
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => void onRemoveWallpaper()}
                    aria-label="Remove custom wallpaper"
                    title="Remove custom photo"
                    className="absolute top-1.5 right-1.5 rounded-lg bg-black/65 p-1 text-rose-300 hover:bg-rose-600 hover:text-white cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Wallpaper Dim & Blur Sliders (when any wallpaper is active) */}
            {settings.wallpaperPreset !== 'none' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[var(--border-subtle)]">
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span className="text-[var(--text-secondary)] font-medium">
                      Readability Dim Overlay
                    </span>
                    <span className="font-mono-num text-[var(--text-primary)] font-semibold">
                      {settings.wallpaperDim}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="85"
                    step="5"
                    value={settings.wallpaperDim}
                    onChange={(e) => onUpdateSettings({ wallpaperDim: Number(e.target.value) })}
                    className="tb-range w-full"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span className="text-[var(--text-secondary)] font-medium">
                      Wallpaper Blur
                    </span>
                    <span className="font-mono-num text-[var(--text-primary)] font-semibold">
                      {settings.wallpaperBlur}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="1"
                    value={settings.wallpaperBlur}
                    onChange={(e) => onUpdateSettings({ wallpaperBlur: Number(e.target.value) })}
                    className="tb-range w-full"
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Window Opacity */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Windows Opacity
              </h3>
              <p className="text-[11px] text-[var(--text-muted)]">
                Adjust transparency of cards, panels, modals, and navigation bars over your background.
              </p>
            </div>
            {settings.windowOpacity !== 70 && (
              <button
                type="button"
                onClick={() => onUpdateSettings({ windowOpacity: 70 })}
                className="text-xs font-medium text-[var(--accent-text)] hover:underline cursor-pointer"
              >
                Reset (70%)
              </button>
            )}
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-3.5 space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-[var(--text-secondary)] font-medium">
                  Window Surface Opacity
                </span>
                <span className="font-mono-num text-[var(--text-primary)] font-semibold">
                  {settings.windowOpacity}%
                </span>
              </div>
              <input
                type="range"
                aria-label="Window surface opacity"
                min="15"
                max="100"
                step="1"
                value={settings.windowOpacity}
                onChange={(e) => onUpdateSettings({ windowOpacity: Number(e.target.value) })}
                className="tb-range w-full"
              />
              <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] mt-1">
                <span>15% Ultra Glass</span>
                <span>50% Frosted</span>
                <span>100% Solid</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border-subtle)]">
              {(
                [
                  { label: 'Ultra Glass', value: 25 },
                  { label: 'Frosted', value: 50 },
                  { label: 'Balanced', value: 70 },
                  { label: 'Deep', value: 88 },
                  { label: 'Solid', value: 100 },
                ] as const
              ).map((preset) => {
                const active = settings.windowOpacity === preset.value;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => onUpdateSettings({ windowOpacity: preset.value })}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all cursor-pointer"
                    style={{
                      backgroundColor: active ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                      border: active
                        ? '1px solid var(--accent)'
                        : '1px solid var(--border-subtle)',
                      color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
                    }}
                  >
                    {active && <Check className="w-3 h-3" />}
                    <span>{preset.label}</span>
                    <span className="font-mono-num opacity-75">{preset.value}%</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Font Style */}
        <section>
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Font Style</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {FONTS.map((f) => {
              const active = settings.font === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onUpdateSettings({ font: f.id })}
                  className="flex flex-col rounded-xl p-3 text-left transition-all cursor-pointer"
                  style={{
                    backgroundColor: active ? 'var(--accent-soft)' : 'var(--bg-input)',
                    border: active
                      ? '1px solid var(--accent)'
                      : '1px solid var(--border-subtle)',
                  }}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">
                      {f.label}
                    </span>
                    {active && <Check className="w-3.5 h-3.5 text-[var(--accent-text)]" />}
                  </div>
                  <span className="text-[11px] text-[var(--text-muted)] mt-0.5">{f.sample}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Mouse Cursor Effect */}
        <section>
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Mouse Cursor Effect
            </h3>
            <p className="text-[11px] text-[var(--text-muted)]">
              Choose an interactive desktop cursor effect rendered behind cards and panels.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {CURSOR_EFFECTS.map((fx) => {
              const active = settings.cursorEffect === fx.id;
              return (
                <button
                  key={fx.id}
                  type="button"
                  onClick={() =>
                    onUpdateSettings({
                      cursorEffect: fx.id,
                      cursorAnimation: fx.id !== 'none',
                    })
                  }
                  className="flex flex-col rounded-xl p-3 text-left transition-all cursor-pointer"
                  style={{
                    backgroundColor: active ? 'var(--accent-soft)' : 'var(--bg-input)',
                    border: active
                      ? '1px solid var(--accent)'
                      : '1px solid var(--border-subtle)',
                  }}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">
                      {fx.label}
                    </span>
                    {active && <Check className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" />}
                  </div>
                  <span className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">
                    {fx.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Session Clock Style & Display Currency */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <section>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
              Session Clock Style
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {CLOCK_STYLES.map((c) => {
                const active = settings.clockStyle === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onUpdateSettings({ clockStyle: c.id })}
                    className="rounded-xl px-3 py-2.5 text-xs font-medium text-left transition-all cursor-pointer"
                    style={{
                      backgroundColor: active ? 'var(--accent-soft)' : 'var(--bg-input)',
                      border: active
                        ? '1px solid var(--accent)'
                        : '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
              Display Currency
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'USD' as CurrencyId, label: 'USD ($)', sub: 'Base prop currency' },
                  { id: 'INR' as CurrencyId, label: 'INR (₹)', sub: 'Converted at ₹85/USD' },
                ] as const
              ).map((curr) => {
                const active = settings.currency === curr.id;
                return (
                  <button
                    key={curr.id}
                    type="button"
                    onClick={() => onUpdateSettings({ currency: curr.id })}
                    className="rounded-xl px-3 py-2.5 text-left transition-all cursor-pointer"
                    style={{
                      backgroundColor: active ? 'var(--accent-soft)' : 'var(--bg-input)',
                      border: active
                        ? '1px solid var(--accent)'
                        : '1px solid var(--border-subtle)',
                    }}
                  >
                    <span className="block text-xs font-semibold text-[var(--text-primary)]">
                      {curr.label}
                    </span>
                    <span className="block text-[11px] text-[var(--text-muted)] mt-0.5">
                      {curr.sub}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Toggles */}
        <section>
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
            Interface & Guardrails
          </h3>
          <div className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)]">
            {TOGGLE_ITEMS.map(({ key, label, desc }) => {
              const checked = Boolean(settings[key]);
              return (
                <div key={key} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
                    <p className="text-xs text-[var(--text-muted)]">{desc}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={checked}
                    onClick={() => onUpdateSettings({ [key]: !checked } as Partial<AppSettings>)}
                    className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 cursor-pointer"
                    style={{
                      backgroundColor: checked ? 'var(--btn-primary-bg)' : 'var(--border-strong)',
                    }}
                  >
                    <span
                      className="inline-block h-4 w-4 rounded-full transition-transform duration-200"
                      style={{
                        transform: checked ? 'translateX(24px)' : 'translateX(4px)',
                        backgroundColor: checked ? 'var(--btn-primary-text)' : '#ffffff',
                      }}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Data Backup & Restore */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Data Backup &amp; Restore
          </h3>

          {/* Zero-Permission Auto-Backup JSON (Overwrite on Every Change) */}
          <AutoBackupCard
            settings={settings}
            autoBackup={autoBackupState}
            onUpdateSettings={onUpdateSettings}
            onPickFolder={onPickAutoBackupFolder}
            onResumeFolder={onResumeAutoBackupFolder}
            onClearFolder={onClearAutoBackupFolder}
            onRequestPersistentStorage={onRequestPersistentStorage}
            onRunNow={onRunAutoBackupNow}
            onDownloadLatest={onDownloadAutoBackup}
            onRestoreLatest={onRestoreAutoBackup}
          />

          {/* Google Drive Cloud Backup */}
          <GoogleDriveBackupCard
            onBuildBackupPayload={onBuildBackupPayload}
            onApplyBackupPayload={onApplyBackupPayload}
          />

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleBackup}
              className="tb-btn-primary flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Backup JSON
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="tb-btn-ghost flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              Restore JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleRestoreChange}
            />

            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="flex items-center gap-2 rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-2.5 text-xs font-medium text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Demo Data
            </button>
          </div>

          {statusMsg && (
            <p
              className="mt-3 text-xs font-medium"
              style={{ color: statusMsg.type === 'ok' ? 'var(--positive)' : 'var(--negative)' }}
            >
              {statusMsg.text}
            </p>
          )}

          {/* In-Page Reset Confirmation Modal (never window.confirm) */}
          {confirmReset && (
            <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    Reset all local data to demo defaults?
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    This replaces your current accounts, trades, chart images, and ROI entries with
                    the fresh demo dataset. Consider downloading a JSON backup first.
                  </p>
                  <div className="mt-3 flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleConfirmReset}
                      className="rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700 cursor-pointer"
                    >
                      Yes, Reset Demo Data
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="tb-btn-ghost rounded-lg px-3.5 py-2 text-xs font-medium cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Software Details — Strictly Last Card at Bottom of Settings */}
        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-5 space-y-5">
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] mb-4">Software Details</p>
            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-5">
              <TradebookLogo size={80} className="rounded-[22px] shadow-lg shrink-0" />
              <div className="text-center sm:text-left space-y-1">
                <h4 className="text-xl font-bold tracking-tight lowercase text-[var(--text-primary)]">
                  tradebook
                </h4>
                <p className="text-sm text-[var(--text-secondary)]">
                  <span className="text-[var(--text-muted)]">Author: </span>
                  <span className="font-medium text-[var(--text-primary)]">
                    Mr. Manjeet Chichkhede (Intraday Trader)
                  </span>
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  <span className="text-[var(--text-muted)]">Software Version: </span>
                  <span className="font-mono-num font-medium text-[var(--accent-text)]">
                    v2.6.0 Glass Edition
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Changelog & Version History */}
          <div className="pt-4 border-t border-[var(--border-subtle)] space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-[var(--text-primary)]">
                Changelog &amp; Version History
              </p>
              <span className="font-mono-num text-[11px] text-[var(--text-muted)]">
                Latest: v2.6.0
              </span>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {CHANGELOG_HISTORY.map((release, idx) => (
                <div
                  key={release.version}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card-solid)] p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-num text-xs font-bold text-[var(--accent-text)]">
                        {release.version}
                      </span>
                      {idx === 0 && (
                        <span
                          className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{
                            backgroundColor: 'var(--positive-soft)',
                            color: 'var(--positive)',
                          }}
                        >
                          Current
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-[var(--text-muted)]">{release.date}</span>
                  </div>
                  <ul className="space-y-1 text-[11px] text-[var(--text-secondary)] list-disc pl-4">
                    {release.highlights.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
