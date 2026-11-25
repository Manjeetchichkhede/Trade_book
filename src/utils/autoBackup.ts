import {
  AutoBackupMeta,
  AutoBackupTargetType,
  BackupPayload,
  FolderPermissionState,
} from '../types';
import { idbDeleteRaw, idbGetRaw, idbSetRaw, kvGet, kvSet } from '../db/storage';

const DIR_HANDLE_KEY = '__autobackup_dir_handle';
const IDB_MIRROR_KEY = '__autobackup_latest_json';
const META_KEY = 'autobackup_meta';

type PermissionStateMode = 'granted' | 'denied' | 'prompt';

interface DirectoryHandleWithPerms extends FileSystemDirectoryHandle {
  queryPermission?: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<PermissionStateMode>;
  requestPermission?: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<PermissionStateMode>;
}

interface WindowWithDirPicker extends Window {
  showDirectoryPicker?: (options?: {
    id?: string;
    mode?: 'read' | 'readwrite';
    startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
  }) => Promise<DirectoryHandleWithPerms>;
}

export function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function isFolderPickerSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof (window as WindowWithDirPicker).showDirectoryPicker === 'function';
}

export function isOpfsSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    Boolean(navigator.storage) &&
    typeof navigator.storage.getDirectory === 'function'
  );
}

/**
 * Checks persistent device storage permission & usage/quota via StorageManager API.
 */
export async function getStoragePermissionInfo(): Promise<{
  persisted: boolean;
  usageBytes: number;
  quotaBytes: number;
}> {
  let persisted = false;
  let usageBytes = 0;
  let quotaBytes = 0;

  if (typeof navigator !== 'undefined' && navigator.storage) {
    try {
      if (typeof navigator.storage.persisted === 'function') {
        persisted = await navigator.storage.persisted();
      }
    } catch {
      persisted = false;
    }
    try {
      if (typeof navigator.storage.estimate === 'function') {
        const est = await navigator.storage.estimate();
        usageBytes = est.usage ?? 0;
        quotaBytes = est.quota ?? 0;
      }
    } catch {
      // Ignore quota estimation errors
    }
  }

  return { persisted, usageBytes, quotaBytes };
}

/**
 * Requests Persistent Local Device Storage permission from the browser/OS so the
 * local backup folder & IndexedDB database are protected from automatic eviction.
 */
export async function requestPersistentStoragePermission(): Promise<{
  granted: boolean;
  usageBytes: number;
  quotaBytes: number;
  message: string;
}> {
  if (typeof navigator === 'undefined' || !navigator.storage) {
    return {
      granted: false,
      usageBytes: 0,
      quotaBytes: 0,
      message: 'StorageManager API is not available in this browser.',
    };
  }

  let granted = false;
  try {
    if (typeof navigator.storage.persist === 'function') {
      granted = await navigator.storage.persist();
    } else if (typeof navigator.storage.persisted === 'function') {
      granted = await navigator.storage.persisted();
    }
  } catch {
    granted = false;
  }

  const info = await getStoragePermissionInfo();
  const finalGranted = granted || info.persisted;

  return {
    granted: finalGranted,
    usageBytes: info.usageBytes,
    quotaBytes: info.quotaBytes,
    message: finalGranted
      ? 'Persistent device storage permission granted. Local backup files are protected from browser cleanup.'
      : 'Browser kept standard storage mode (installing the app as a PWA or bookmarking it automatically upgrades persistent storage permission).',
  };
}

/**
 * Sanitizes a user-provided folder path into safe nested directory segments.
 * Strips drive prefixes, leading/trailing slashes, and unsafe characters.
 */
export function sanitizeFolderSegments(folderPath: string): string[] {
  const cleaned = folderPath
    .trim()
    .replace(/^[a-zA-Z]:[\\/]+/, '')
    .replace(/\\/g, '/');

  return cleaned
    .split('/')
    .map((seg) => seg.trim().replace(/[<>:"|?*\x00-\x1f]/g, ''))
    .filter((seg) => seg.length > 0 && seg !== '.' && seg !== '..');
}

export function sanitizeFileName(rawName: string): string {
  const cleaned = rawName
    .trim()
    .replace(/[\\/]/g, '-')
    .replace(/[<>:"|?*\x00-\x1f]/g, '')
    .trim();

  if (!cleaned) return 'tradebook-autobackup.json';
  return cleaned.toLowerCase().endsWith('.json') ? cleaned : `${cleaned}.json`;
}

async function resolveNestedDir(
  root: FileSystemDirectoryHandle,
  segments: string[],
  create: boolean
): Promise<FileSystemDirectoryHandle> {
  let current = root;
  for (const segment of segments) {
    current = await current.getDirectoryHandle(segment, { create });
  }
  return current;
}

async function writeTextOverwrite(
  dir: FileSystemDirectoryHandle,
  fileName: string,
  content: string
): Promise<void> {
  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable({ keepExistingData: false });
  await writable.write(content);
  await writable.close();
}

async function readTextIfExists(
  dir: FileSystemDirectoryHandle,
  fileName: string
): Promise<string | null> {
  try {
    const fileHandle = await dir.getFileHandle(fileName, { create: false });
    const file = await fileHandle.getFile();
    return await file.text();
  } catch {
    return null;
  }
}

export async function getSavedFolderInfo(): Promise<{
  handle: DirectoryHandleWithPerms | null;
  name: string | null;
  permission: FolderPermissionState;
}> {
  const handle = await idbGetRaw<DirectoryHandleWithPerms>(DIR_HANDLE_KEY);
  if (!handle) {
    return { handle: null, name: null, permission: 'none' };
  }

  try {
    const perm = handle.queryPermission
      ? await handle.queryPermission({ mode: 'readwrite' })
      : 'granted';
    return { handle, name: handle.name || 'Selected Folder', permission: perm };
  } catch {
    return { handle, name: handle.name || 'Selected Folder', permission: 'prompt' };
  }
}

/**
 * Prompts the user for device Files & Folders Read/Write permission, saves the folder handle,
 * requests persistent storage, and immediately creates the configured backup subfolder on the device.
 */
export async function pickCustomBackupFolder(
  folderPath: string,
  createSubfolder: boolean
): Promise<
  | { ok: true; name: string; createdPath: string }
  | { ok: false; reason: 'cancelled' | 'iframe-blocked' | 'unsupported' | 'denied' | 'error'; message: string }
> {
  if (!isFolderPickerSupported()) {
    return {
      ok: false,
      reason: 'unsupported',
      message:
        'This browser does not expose direct device folder picking (supported on Chrome, Edge, Brave, Opera desktop/PWA). Local persistent OPFS auto-backup folder remains active.',
    };
  }

  try {
    // Also request persistent storage permission in the same user gesture
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      void navigator.storage.persist().catch(() => {});
    }

    const picker = (window as WindowWithDirPicker).showDirectoryPicker!;
    const handle = await picker({
      id: 'tradebook-autobackup',
      mode: 'readwrite',
      startIn: 'documents',
    });

    // Explicitly verify/request readwrite permission on the selected device folder
    let perm: PermissionStateMode = 'granted';
    if (handle.queryPermission) {
      perm = await handle.queryPermission({ mode: 'readwrite' });
    }
    if (perm !== 'granted' && handle.requestPermission) {
      perm = await handle.requestPermission({ mode: 'readwrite' });
    }
    if (perm !== 'granted') {
      return {
        ok: false,
        reason: 'denied',
        message: 'Read/Write folder storage permission was not granted.',
      };
    }

    // Create the local backup subfolder inside the chosen device directory right away
    const segments = createSubfolder ? sanitizeFolderSegments(folderPath) : [];
    if (segments.length > 0) {
      await resolveNestedDir(handle, segments, true);
    }

    await idbSetRaw(DIR_HANDLE_KEY, handle);
    const rootName = handle.name || 'Selected Folder';
    const createdPath =
      segments.length > 0 ? `${rootName}/${segments.join('/')}` : rootName;

    return { ok: true, name: rootName, createdPath };
  } catch (err) {
    if (err instanceof DOMException) {
      if (err.name === 'AbortError') {
        return { ok: false, reason: 'cancelled', message: 'Folder selection cancelled.' };
      }
      if (err.name === 'SecurityError') {
        return {
          ok: false,
          reason: 'iframe-blocked',
          message:
            'Browser security blocks device folder permission prompts inside embedded preview iframes. Open the app directly in its own browser tab or installed PWA to grant local folder permission and create the backup folder on your device.',
        };
      }
    }
    return {
      ok: false,
      reason: 'error',
      message:
        err instanceof Error
          ? err.message
          : 'Unable to grant folder permission. Local auto-backup remains active.',
    };
  }
}

export async function resumeSavedFolderPermission(
  folderPath: string,
  createSubfolder: boolean
): Promise<{ ok: boolean; permission: FolderPermissionState; message: string }> {
  const { handle, name } = await getSavedFolderInfo();
  if (!handle) {
    return { ok: false, permission: 'none', message: 'No device folder is linked.' };
  }
  try {
    if (handle.requestPermission) {
      const perm = await handle.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        const segments = createSubfolder ? sanitizeFolderSegments(folderPath) : [];
        if (segments.length > 0) {
          await resolveNestedDir(handle, segments, true);
        }
        return {
          ok: true,
          permission: 'granted',
          message: `Read/Write permission granted for "${name}". Local backup folder is ready.`,
        };
      }
      return {
        ok: false,
        permission: perm,
        message: 'Write permission was denied for the selected device folder.',
      };
    }
    return { ok: true, permission: 'granted', message: `Folder "${name}" is ready.` };
  } catch {
    return {
      ok: false,
      permission: 'prompt',
      message: 'Could not request permission for the saved folder. Try selecting the folder again.',
    };
  }
}

export async function clearSavedFolderHandle(): Promise<void> {
  await idbDeleteRaw(DIR_HANDLE_KEY);
}

export async function getAutoBackupMeta(): Promise<AutoBackupMeta> {
  const saved = await kvGet<AutoBackupMeta>(META_KEY);
  if (saved) return saved;
  return {
    lastSavedAt: null,
    fileSizeBytes: 0,
    targetType: isOpfsSupported() ? 'opfs' : 'idb',
    displayPath: 'tradebook-backups/tradebook-autobackup.json',
    writeCount: 0,
  };
}

/**
 * Overwrites the single auto-backup JSON file silently whenever anything changes.
 * - Always creates/overwrites inside zero-permission OPFS local device vault (or IndexedDB mirror).
 * - Whenever a local device folder handle is linked with granted readwrite permission,
 *   also creates the configured subfolder (if enabled) and overwrites the JSON directly on disk.
 */
export async function performAutoBackupOverwrite(
  payload: BackupPayload,
  folderPath: string,
  rawFileName: string,
  createSubfolder: boolean
): Promise<{
  meta: AutoBackupMeta;
  linkedFolderName: string | null;
  folderPermission: FolderPermissionState;
  needsFolderPermission: boolean;
}> {
  const fileName = sanitizeFileName(rawFileName);
  const segments = sanitizeFolderSegments(folderPath);
  const jsonString = JSON.stringify(payload, null, 2);
  const fileSizeBytes = new Blob([jsonString]).size;
  const nowIso = new Date().toISOString();

  const prevMeta = await getAutoBackupMeta();
  let targetType: AutoBackupTargetType = 'idb';
  let displayPath = segments.length > 0 ? `${segments.join('/')}/${fileName}` : fileName;

  // 1. Always write zero-permission OPFS local backup folder (overwrites every time)
  let wroteOpfs = false;
  if (isOpfsSupported()) {
    try {
      const opfsRoot = await navigator.storage.getDirectory();
      const targetDir = await resolveNestedDir(opfsRoot, segments, true);
      await writeTextOverwrite(targetDir, fileName, jsonString);
      wroteOpfs = true;
      targetType = 'opfs';
    } catch {
      wroteOpfs = false;
    }
  }

  // Fallback mirror in IndexedDB if OPFS is unavailable
  if (!wroteOpfs) {
    await idbSetRaw(IDB_MIRROR_KEY, jsonString);
    targetType = 'idb';
  }

  // 2. If user granted device folder access, create subfolder (optional) & overwrite directly on disk
  const folderInfo = await getSavedFolderInfo();
  let folderPermission: FolderPermissionState = folderInfo.permission;
  let needsFolderPermission = false;

  if (folderInfo.handle) {
    if (folderInfo.permission === 'granted') {
      try {
        const deviceTargetDir =
          createSubfolder && segments.length > 0
            ? await resolveNestedDir(folderInfo.handle, segments, true)
            : folderInfo.handle;
        await writeTextOverwrite(deviceTargetDir, fileName, jsonString);
        targetType = 'folder';
        displayPath =
          createSubfolder && segments.length > 0
            ? `${folderInfo.name}/${segments.join('/')}/${fileName}`
            : `${folderInfo.name}/${fileName}`;
      } catch {
        folderPermission = 'prompt';
        needsFolderPermission = true;
      }
    } else {
      needsFolderPermission = true;
    }
  }

  const meta: AutoBackupMeta = {
    lastSavedAt: nowIso,
    fileSizeBytes,
    targetType,
    displayPath,
    writeCount: (prevMeta.writeCount || 0) + 1,
  };

  await kvSet(META_KEY, meta);

  return {
    meta,
    linkedFolderName: folderInfo.name,
    folderPermission,
    needsFolderPermission,
  };
}

/**
 * Reads the latest overwritten auto-backup JSON text from the linked device folder, OPFS, or IndexedDB mirror.
 */
export async function readLatestAutoBackupText(
  folderPath: string,
  rawFileName: string,
  createSubfolder: boolean
): Promise<{ text: string; fileName: string } | null> {
  const fileName = sanitizeFileName(rawFileName);
  const segments = sanitizeFolderSegments(folderPath);

  // Try linked device folder first if granted
  const folderInfo = await getSavedFolderInfo();
  if (folderInfo.handle && folderInfo.permission === 'granted') {
    try {
      const deviceDir =
        createSubfolder && segments.length > 0
          ? await resolveNestedDir(folderInfo.handle, segments, false)
          : folderInfo.handle;
      const folderText = await readTextIfExists(deviceDir, fileName);
      if (folderText) return { text: folderText, fileName };
    } catch {
      // Fall through to root or OPFS
    }
    // Also check root of linked folder in case subfolder setting was toggled
    const rootText = await readTextIfExists(folderInfo.handle, fileName);
    if (rootText) return { text: rootText, fileName };
  }

  // Try OPFS zero-permission local backup folder
  if (isOpfsSupported()) {
    try {
      const opfsRoot = await navigator.storage.getDirectory();
      const targetDir = await resolveNestedDir(opfsRoot, segments, false);
      const opfsText = await readTextIfExists(targetDir, fileName);
      if (opfsText) return { text: opfsText, fileName };
    } catch {
      // Folder or file may not exist yet
    }
  }

  // Fallback IndexedDB mirror
  const idbText = await idbGetRaw<string>(IDB_MIRROR_KEY);
  if (idbText) return { text: idbText, fileName };

  return null;
}
