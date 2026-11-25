import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  Download,
  FolderCog,
  FolderPlus,
  HardDrive,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  Unlink,
} from 'lucide-react';
import { AppSettings, AutoBackupState } from '../types';
import { sanitizeFileName, sanitizeFolderSegments } from '../utils/autoBackup';

interface AutoBackupCardProps {
  settings: AppSettings;
  autoBackup: AutoBackupState;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onPickFolder: () => Promise<{ ok: boolean; message: string }>;
  onResumeFolder: () => Promise<{ ok: boolean; message: string }>;
  onClearFolder: () => Promise<void>;
  onRequestPersistentStorage: () => Promise<{ ok: boolean; message: string }>;
  onRunNow: () => Promise<{ ok: boolean; message: string }>;
  onDownloadLatest: () => Promise<{ ok: boolean; message: string }>;
  onRestoreLatest: () => Promise<{ ok: boolean; message: string }>;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatSavedTime(iso: string | null): string {
  if (!iso) return 'Not saved yet';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const AutoBackupCard: React.FC<AutoBackupCardProps> = ({
  settings,
  autoBackup,
  onUpdateSettings,
  onPickFolder,
  onResumeFolder,
  onClearFolder,
  onRequestPersistentStorage,
  onRunNow,
  onDownloadLatest,
  onRestoreLatest,
}) => {
  const [busy, setBusy] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const normalizedFileName = sanitizeFileName(settings.autoBackupFileName);
  const normalizedSegments = sanitizeFolderSegments(settings.autoBackupFolder);
  const subfolderPath = normalizedSegments.join('/');
  const vaultPreviewPath = subfolderPath
    ? `${subfolderPath}/${normalizedFileName}`
    : normalizedFileName;

  const activeDestinationLabel = autoBackup.linkedFolderName
    ? settings.autoBackupCreateSubfolder && subfolderPath
      ? `${autoBackup.linkedFolderName}/${subfolderPath}/${normalizedFileName}`
      : `${autoBackup.linkedFolderName}/${normalizedFileName}`
    : vaultPreviewPath;

  const handlePickFolder = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await onPickFolder();
      if (res.message) {
        setFeedback({ type: res.ok ? 'ok' : 'err', text: res.message });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleResumeFolder = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await onResumeFolder();
      setFeedback({ type: res.ok ? 'ok' : 'err', text: res.message });
    } finally {
      setBusy(false);
    }
  };

  const handleClearFolder = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      await onClearFolder();
      setFeedback({
        type: 'ok',
        text: 'Unlinked device folder. Zero-permission local auto-vault remains active.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRequestPersistent = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await onRequestPersistentStorage();
      setFeedback({ type: res.ok ? 'ok' : 'err', text: res.message });
    } finally {
      setBusy(false);
    }
  };

  const handleRunNow = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await onRunNow();
      setFeedback({ type: res.ok ? 'ok' : 'err', text: res.message });
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadLatest = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await onDownloadLatest();
      setFeedback({ type: res.ok ? 'ok' : 'err', text: res.message });
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmRestore = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await onRestoreLatest();
      setConfirmRestore(false);
      setFeedback({ type: res.ok ? 'ok' : 'err', text: res.message });
    } finally {
      setBusy(false);
    }
  };

  const folderPermBadge =
    autoBackup.folderPermission === 'granted'
      ? { label: 'Read/Write Granted', color: 'var(--positive)', bg: 'var(--positive-soft)' }
      : autoBackup.folderPermission === 'prompt' && autoBackup.linkedFolderName
      ? { label: 'Re-Approval Needed', color: 'var(--warning)', bg: 'var(--warning-soft)' }
      : autoBackup.folderPermission === 'denied'
      ? { label: 'Denied', color: 'var(--negative)', bg: 'var(--negative-soft)' }
      : { label: 'Not Granted', color: 'var(--text-muted)', bg: 'var(--bg-elevated)' };

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-4 space-y-4">
      {/* Header + Master Toggle */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{
              backgroundColor: settings.autoBackupEnabled
                ? 'var(--positive-soft)'
                : 'var(--bg-elevated)',
              color: settings.autoBackupEnabled ? 'var(--positive)' : 'var(--text-muted)',
            }}
          >
            <HardDrive className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                Auto-Backup JSON (Overwrite)
              </h4>
              {settings.autoBackupEnabled && (
                <span
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{
                    backgroundColor: 'var(--positive-soft)',
                    color: 'var(--positive)',
                  }}
                >
                  <Check className="w-2.5 h-2.5" />
                  Active
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-snug">
              Automatically overwrites your JSON backup file whenever any account, trade,
              checklist, ROI entry, chart, or setting changes.
            </p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-label="Enable Auto-Backup JSON"
          aria-checked={settings.autoBackupEnabled}
          onClick={() => onUpdateSettings({ autoBackupEnabled: !settings.autoBackupEnabled })}
          className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 cursor-pointer"
          style={{
            backgroundColor: settings.autoBackupEnabled
              ? 'var(--btn-primary-bg)'
              : 'var(--border-strong)',
          }}
        >
          <span
            className="inline-block h-4 w-4 rounded-full transition-transform duration-200"
            style={{
              transform: settings.autoBackupEnabled ? 'translateX(24px)' : 'translateX(4px)',
              backgroundColor: settings.autoBackupEnabled ? 'var(--btn-primary-text)' : '#ffffff',
            }}
          />
        </button>
      </div>

      {/* Device Files & Folder Storage Permissions */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card-solid)] p-3.5 space-y-3">
        <div className="flex items-center gap-2">
          {autoBackup.folderPermission === 'granted' && autoBackup.persistentStorageGranted ? (
            <ShieldCheck className="w-4 h-4 text-[var(--positive)] shrink-0" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
          )}
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            Files &amp; Folder Storage Permissions
          </span>
        </div>

        {/* Permission Row 1: Local Device Folder Access (Read/Write) */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] p-3">
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                Device Folder Access
              </span>
              <span
                className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                style={{
                  backgroundColor: folderPermBadge.bg,
                  color: folderPermBadge.color,
                }}
              >
                {folderPermBadge.label}
              </span>
            </div>
            <p className="font-mono-num text-[11px] text-[var(--accent-text)] truncate">
              {autoBackup.linkedFolderName
                ? activeDestinationLabel
                : `Local Vault: /${vaultPreviewPath}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={handlePickFolder}
              className="tb-btn-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              {autoBackup.linkedFolderName ? 'Change Folder' : 'Grant & Create Folder'}
            </button>

            {autoBackup.linkedFolderName && (
              <button
                type="button"
                disabled={busy}
                onClick={handleClearFolder}
                title="Revoke linked device folder and use zero-permission local vault"
                className="tb-btn-ghost inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium cursor-pointer disabled:opacity-50"
              >
                <Unlink className="w-3.5 h-3.5" />
                Unlink
              </button>
            )}
          </div>
        </div>

        {/* Re-approve banner if browser restart needs 1-click re-grant */}
        {autoBackup.linkedFolderName && autoBackup.needsFolderPermission && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2">
            <p className="text-[11px] text-amber-200 leading-snug">
              Browser restarted: re-approve write permission for{' '}
              <span className="font-mono-num font-semibold">{autoBackup.linkedFolderName}</span>{' '}
              (local vault auto-backup is still saving silently).
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={handleResumeFolder}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-[11px] font-semibold text-slate-950 hover:bg-amber-400 cursor-pointer whitespace-nowrap"
            >
              Re-Grant Permission
            </button>
          </div>
        )}

        {/* Permission Row 2: Persistent Device Storage */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] p-3">
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                Persistent Device Storage
              </span>
              <span
                className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                style={{
                  backgroundColor: autoBackup.persistentStorageGranted
                    ? 'var(--positive-soft)'
                    : 'var(--bg-elevated)',
                  color: autoBackup.persistentStorageGranted
                    ? 'var(--positive)'
                    : 'var(--text-muted)',
                }}
              >
                {autoBackup.persistentStorageGranted ? 'Granted & Protected' : 'Standard Mode'}
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Prevents the device from clearing your offline backup folder &amp; charts.
              {autoBackup.storageUsageBytes > 0 && (
                <span className="font-mono-num ml-1 text-[var(--text-secondary)]">
                  ({formatBytes(autoBackup.storageUsageBytes)} used)
                </span>
              )}
            </p>
          </div>

          {!autoBackup.persistentStorageGranted && (
            <button
              type="button"
              disabled={busy}
              onClick={handleRequestPersistent}
              className="tb-btn-ghost inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent-text)]" />
              Allow Storage
            </button>
          )}
        </div>
      </div>

      {/* Folder Name, Subfolder Toggle & Overwrite Filename */}
      <div className="space-y-3 pt-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
              Backup Folder Name
            </label>
            <div className="relative">
              <FolderCog className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
              <input
                type="text"
                value={settings.autoBackupFolder}
                onChange={(e) => onUpdateSettings({ autoBackupFolder: e.target.value })}
                placeholder="tradebook-backups"
                className="tb-input font-mono-num w-full rounded-lg pl-8 pr-3 py-2 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
              Backup JSON Filename (Overwritten)
            </label>
            <input
              type="text"
              value={settings.autoBackupFileName}
              onChange={(e) => onUpdateSettings({ autoBackupFileName: e.target.value })}
              placeholder="tradebook-autobackup.json"
              className="tb-input font-mono-num w-full rounded-lg px-3 py-2 text-xs"
            />
          </div>
        </div>

        <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2 cursor-pointer">
          <span className="text-[11px] text-[var(--text-secondary)]">
            Automatically create{' '}
            <span className="font-mono-num font-semibold text-[var(--text-primary)]">
              /{subfolderPath || 'tradebook-backups'}
            </span>{' '}
            folder inside selected device directory
          </span>
          <input
            type="checkbox"
            checked={settings.autoBackupCreateSubfolder}
            onChange={(e) => onUpdateSettings({ autoBackupCreateSubfolder: e.target.checked })}
            className="h-4 w-4 rounded accent-blue-500 cursor-pointer shrink-0"
          />
        </label>
      </div>

      {/* Snapshot Summary & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--border-subtle)]">
        <div className="text-[11px] text-[var(--text-muted)] space-y-0.5">
          <p>
            Last Overwrite:{' '}
            <span className="font-mono-num font-semibold text-[var(--text-primary)]">
              {autoBackup.status === 'saving'
                ? 'Saving...'
                : formatSavedTime(autoBackup.lastSavedAt)}
            </span>
          </p>
          <p className="font-mono-num">
            {autoBackup.fileSizeBytes > 0
              ? `${formatBytes(autoBackup.fileSizeBytes)} · ${
                  autoBackup.targetType === 'folder'
                    ? 'Synced to Device Folder & Local Vault'
                    : 'Saved in Local Device Vault'
                }`
              : 'Waiting for first backup write'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={handleRunNow}
            className="tb-btn-ghost inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                busy || autoBackup.status === 'saving' ? 'animate-spin' : ''
              }`}
            />
            Overwrite Now
          </button>

          <button
            type="button"
            disabled={busy || !autoBackup.lastSavedAt}
            onClick={handleDownloadLatest}
            className="tb-btn-ghost inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Download Latest
          </button>

          <button
            type="button"
            disabled={busy || !autoBackup.lastSavedAt}
            onClick={() => setConfirmRestore(true)}
            className="tb-btn-ghost inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restore Latest
          </button>
        </div>
      </div>

      {/* Feedback Message */}
      {(feedback || autoBackup.errorMessage) && (
        <p
          className="text-xs font-medium leading-snug"
          style={{
            color:
              feedback?.type === 'ok' && !autoBackup.errorMessage
                ? 'var(--positive)'
                : 'var(--negative)',
          }}
        >
          {feedback?.text ?? autoBackup.errorMessage}
        </p>
      )}

      {/* Inline Restore Confirmation (never window.confirm) */}
      {confirmRestore && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="text-xs font-semibold text-[var(--text-primary)]">
                Restore from latest auto-backup ({formatSavedTime(autoBackup.lastSavedAt)})?
              </p>
              <p className="text-[11px] text-[var(--text-secondary)]">
                This will replace your current accounts, trades, charts, and ROI entries with the
                saved JSON file at <span className="font-mono-num">{activeDestinationLabel}</span>.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleConfirmRestore}
                  className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400 cursor-pointer disabled:opacity-50"
                >
                  Yes, Restore Backup
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRestore(false)}
                  className="tb-btn-ghost rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
