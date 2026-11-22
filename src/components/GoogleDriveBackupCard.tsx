import React, { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  AlertTriangle,
  Check,
  Cloud,
  CloudDownload,
  CloudUpload,
  Copy,
  LogOut,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { BackupPayload } from '../types';
import {
  createDriveBackup,
  deleteDriveBackup,
  downloadDriveBackup,
  DriveBackupFile,
  FIREBASE_PROJECT_ID,
  googleSignIn,
  googleSignOut,
  initGoogleAuth,
  listDriveBackups,
  parseGoogleAuthError,
  updateDriveBackup,
} from '../services/googleDrive';
import { getTodayISO } from '../utils/format';

interface GoogleDriveBackupCardProps {
  onBuildBackupPayload: () => Promise<BackupPayload>;
  onApplyBackupPayload: (payload: Partial<BackupPayload>) => Promise<{ ok: boolean; message: string }>;
}

type PendingAction =
  | { type: 'overwrite'; file: DriveBackupFile }
  | { type: 'restore'; file: DriveBackupFile }
  | { type: 'delete'; file: DriveBackupFile }
  | null;

function formatBytes(sizeStr?: string): string {
  const bytes = Number(sizeStr);
  if (!bytes || Number.isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatModified(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const GoogleDriveBackupCard: React.FC<GoogleDriveBackupCardProps> = ({
  onBuildBackupPayload,
  onApplyBackupPayload,
}) => {
  const [needsAuth, setNeedsAuth] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [files, setFiles] = useState<DriveBackupFile[]>([]);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [status, setStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [unauthorizedHost, setUnauthorizedHost] = useState<string | null>(null);
  const [copiedHost, setCopiedHost] = useState(false);

  const refreshFiles = useCallback(async () => {
    setIsBusy(true);
    try {
      const list = await listDriveBackups();
      setFiles(list);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to load Drive backups.';
      if (msg === 'AUTH_REQUIRED') {
        setNeedsAuth(true);
        setStatus({ type: 'err', text: 'Google Drive session expired. Please sign in again.' });
      } else {
        setStatus({ type: 'err', text: msg });
      }
    } finally {
      setIsBusy(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (authedUser) => {
        setUser(authedUser);
        setNeedsAuth(false);
        void refreshFiles();
      },
      (maybeUser) => {
        setUser(maybeUser);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, [refreshFiles]);

  const handleSignIn = async () => {
    setIsLoggingIn(true);
    setStatus(null);
    setUnauthorizedHost(null);
    try {
      const res = await googleSignIn();
      setUser(res.user);
      setNeedsAuth(false);
      await refreshFiles();
      setStatus({ type: 'ok', text: `Connected Google Drive as ${res.user.email ?? 'Google User'}.` });
    } catch (err) {
      const info = parseGoogleAuthError(err);
      if (info.isUnauthorizedDomain) {
        setUnauthorizedHost(info.hostname || window.location.hostname || 'this domain');
        setStatus(null);
      } else {
        setStatus({ type: 'err', text: info.message });
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleCopyHost = async () => {
    if (!unauthorizedHost) return;
    try {
      await navigator.clipboard.writeText(unauthorizedHost);
      setCopiedHost(true);
      window.setTimeout(() => setCopiedHost(false), 2000);
    } catch {
      // Clipboard API unavailable
    }
  };

  const handleSignOut = async () => {
    await googleSignOut();
    setUser(null);
    setFiles([]);
    setNeedsAuth(true);
    setPendingAction(null);
    setStatus({ type: 'ok', text: 'Disconnected from Google Drive.' });
  };

  const handleCreateNewBackup = async () => {
    setIsBusy(true);
    setStatus(null);
    try {
      const payload = await onBuildBackupPayload();
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const fileName = `tradebook-backup-${getTodayISO()}-${hh}${mm}.json`;
      const created = await createDriveBackup(payload, fileName);
      setFiles((prev) => [created, ...prev]);
      setStatus({ type: 'ok', text: `Saved "${created.name}" to Google Drive.` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Backup upload failed.';
      if (msg === 'AUTH_REQUIRED') {
        setNeedsAuth(true);
        setStatus({ type: 'err', text: 'Session expired. Sign in with Google to back up.' });
      } else {
        setStatus({ type: 'err', text: msg });
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleConfirmPendingAction = async () => {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    setIsBusy(true);
    setStatus(null);

    try {
      if (action.type === 'overwrite') {
        const payload = await onBuildBackupPayload();
        const updated = await updateDriveBackup(action.file.id, payload);
        setFiles((prev) => [updated, ...prev.filter((f) => f.id !== updated.id)]);
        setStatus({ type: 'ok', text: `Updated "${updated.name}" in Google Drive.` });
      } else if (action.type === 'restore') {
        const payload = await downloadDriveBackup(action.file.id);
        const result = await onApplyBackupPayload(payload);
        setStatus({ type: result.ok ? 'ok' : 'err', text: result.message });
      } else if (action.type === 'delete') {
        await deleteDriveBackup(action.file.id);
        setFiles((prev) => prev.filter((f) => f.id !== action.file.id));
        setStatus({ type: 'ok', text: `Deleted "${action.file.name}" from Google Drive.` });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google Drive action failed.';
      if (msg === 'AUTH_REQUIRED') {
        setNeedsAuth(true);
        setStatus({ type: 'err', text: 'Session expired. Please sign in with Google again.' });
      } else {
        setStatus({ type: 'err', text: msg });
      }
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-4 space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Cloud className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
          <div>
            <p className="text-xs font-semibold text-[var(--text-primary)]">
              Google Drive Cloud Backup
            </p>
            <p className="text-[11px] text-[var(--text-muted)]">
              Back up and restore your accounts, trades, charts, and ROI ledger in your Google Drive.
            </p>
          </div>
        </div>

        {!needsAuth && user && (
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            Sign out
          </button>
        )}
      </div>

      {needsAuth ? (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-xs text-[var(--text-secondary)]">
            {user?.email
              ? `Reconnect ${user.email} to access Google Drive backups.`
              : 'Sign in with Google to save or restore encrypted JSON backups on Google Drive.'}
          </p>

          <button
            type="button"
            onClick={handleSignIn}
            disabled={isLoggingIn}
            className="gsi-material-button"
          >
            <div className="gsi-material-button-state" />
            <div className="gsi-material-button-content-wrapper">
              <div className="gsi-material-button-icon">
                <svg
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 48 48"
                  style={{ display: 'block' }}
                >
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                  <path fill="none" d="M0 0h48v48H0z" />
                </svg>
              </div>
              <span className="gsi-material-button-contents">
                {isLoggingIn ? 'Signing in...' : 'Sign in with Google'}
              </span>
            </div>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-[var(--text-secondary)] truncate">
              Signed in as <strong className="text-[var(--text-primary)]">{user?.email}</strong>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isBusy}
                onClick={handleCreateNewBackup}
                className="tb-btn-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                <CloudUpload className="w-3.5 h-3.5" />
                Save New Backup
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void refreshFiles()}
                aria-label="Refresh Google Drive backups"
                className="tb-btn-ghost p-1.5 rounded-lg cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Explicit Confirmation Dialog for Mutating/Destructive Drive & Restore Actions */}
          {pendingAction && (
            <div className="rounded-xl border border-amber-500/45 bg-amber-500/10 p-3.5 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-semibold text-[var(--text-primary)]">
                    {pendingAction.type === 'delete' &&
                      `Delete "${pendingAction.file.name}" from Google Drive?`}
                    {pendingAction.type === 'overwrite' &&
                      `Overwrite "${pendingAction.file.name}" in Google Drive?`}
                    {pendingAction.type === 'restore' &&
                      `Restore local data from "${pendingAction.file.name}"?`}
                  </p>
                  <p className="text-[var(--text-secondary)] mt-0.5">
                    {pendingAction.type === 'delete' &&
                      'This permanently removes the backup file from your Google Drive and cannot be undone.'}
                    {pendingAction.type === 'overwrite' &&
                      'The contents of this Google Drive file will be replaced with your current local tradebook data.'}
                    {pendingAction.type === 'restore' &&
                      'Your current local accounts, trades, charts, and ROI ledger will be replaced with this Google Drive snapshot.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pl-6">
                <button
                  type="button"
                  onClick={handleConfirmPendingAction}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white cursor-pointer ${
                    pendingAction.type === 'delete'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {pendingAction.type === 'delete'
                    ? 'Confirm Delete'
                    : pendingAction.type === 'overwrite'
                    ? 'Confirm Overwrite'
                    : 'Confirm Restore'}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingAction(null)}
                  className="tb-btn-ghost rounded-lg px-3 py-1.5 text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* List of Drive Backups */}
          {files.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-2">
              No tradebook backups found in Google Drive yet. Click &ldquo;Save New Backup&rdquo; to
              upload your first cloud snapshot.
            </p>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-solid)] max-h-48 overflow-y-auto">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-mono-num font-medium text-[var(--text-primary)] truncate">
                      {file.name}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {formatModified(file.modifiedTime)}
                      {file.size ? ` · ${formatBytes(file.size)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setPendingAction({ type: 'overwrite', file })}
                      title="Overwrite this Drive backup with current data"
                      className="tb-btn-ghost inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium cursor-pointer"
                    >
                      <CloudUpload className="w-3 h-3" />
                      Update
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setPendingAction({ type: 'restore', file })}
                      title="Restore this Drive backup"
                      className="tb-btn-ghost inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium cursor-pointer"
                    >
                      <CloudDownload className="w-3 h-3" />
                      Restore
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setPendingAction({ type: 'delete', file })}
                      aria-label={`Delete ${file.name}`}
                      className="p-1 rounded-md text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {unauthorizedHost && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 space-y-2.5 text-xs">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1 min-w-0">
              <p className="font-semibold text-rose-300">
                Domain Authorization Needed for Google Sign-In
              </p>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                Your live website domain must be added to Firebase Authentication&apos;s Authorized
                Domains list for project{' '}
                <span className="font-mono-num font-semibold text-[var(--text-primary)]">
                  {FIREBASE_PROJECT_ID}
                </span>
                .
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-solid)] px-3 py-2">
            <code className="font-mono-num text-xs font-semibold text-[var(--text-primary)] break-all">
              {unauthorizedHost}
            </code>
            <button
              type="button"
              onClick={handleCopyHost}
              className="tb-btn-ghost inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium cursor-pointer shrink-0"
            >
              {copiedHost ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  Copy Domain
                </>
              )}
            </button>
          </div>

          <ol className="list-decimal pl-4 space-y-1 text-[11px] text-[var(--text-secondary)]">
            <li>
              Open <strong className="text-[var(--text-primary)]">Firebase Console</strong> → select
              project <span className="font-mono-num">{FIREBASE_PROJECT_ID}</span>.
            </li>
            <li>
              Go to <strong className="text-[var(--text-primary)]">Authentication</strong> →{' '}
              <strong className="text-[var(--text-primary)]">Settings</strong> →{' '}
              <strong className="text-[var(--text-primary)]">Authorized domains</strong>.
            </li>
            <li>
              Click <strong className="text-[var(--text-primary)]">Add domain</strong>, paste{' '}
              <span className="font-mono-num text-[var(--text-primary)]">{unauthorizedHost}</span>,
              save, and click <strong className="text-[var(--text-primary)]">Sign in with Google</strong>{' '}
              again.
            </li>
          </ol>
        </div>
      )}

      {status && (
        <p
          className="text-xs font-medium"
          style={{ color: status.type === 'ok' ? 'var(--positive)' : 'var(--negative)' }}
        >
          {status.text}
        </p>
      )}
    </div>
  );
};
