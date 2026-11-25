import { AutoBackupMeta, AutoBackupTargetType, BackupPayload } from '../types';
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
  permission: PermissionStateMode | 'none';
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

export async function pickCustomBackupFolder(): Promise<
  | { ok: true; name: string }
  | { ok: false; reason: 'cancelled' | 'iframe-blocked' | 'unsupported' | 'error'; message: string }
> {
  if (!isFolderPickerSupported()) {
    return {
      ok: false,
      reason: 'unsupported',
      message:
        'Your browser does not support direct disk folder picking. Zero-permission local OPFS auto-backup remains active.',
    };
  }

  try {
    const picker = (window as WindowWithDirPicker).showDirectoryPicker!;
    const handle = await picker({
      id: 'tradebook-autobackup',
      mode: 'readwrite',
      startIn: 'documents',
    });

    await idbSetRaw(DIR_HANDLE_KEY, handle);
    return { ok: true, name: handle.name || 'Selected Folder' };
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
            'Direct PC folder picker is blocked inside embedded preview iframes. Open the app in its own browser tab or installed PWA to pick a PC disk folder — zero-permission auto-backup is already active here.',
        };
      }
    }
    return {
      ok: false,
      reason: 'error',
      message:
        err instanceof Error ? err.message : 'Unable to link custom folder. Local auto-backup remains active.',
    };
  }
}

export async function resumeSavedFolderPermission(): Promise<{ ok: boolean; message: string }> {
  const { handle, name } = await getSavedFolderInfo();
  if (!handle) {
    return { ok: false, message: 'No custom folder is linked.' };
  }
  try {
    if (handle.requestPermission) {
      const perm = await handle.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        return { ok: true, message: `Folder "${name}" reconnected for silent auto-overwrite.` };
      }
      return { ok: false, message: 'Write access was not granted for the selected folder.' };
    }
    return { ok: true, message: `Folder "${name}" is ready.` };
  } catch {
    return { ok: false, message: 'Could not request access to the saved folder. Try choosing it again.' };
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
 * Overwrites the single auto-backup JSON file silently with zero permission prompts.
 * - Always writes to zero-permission OPFS (and IndexedDB mirror if OPFS unavailable).
 * - Also overwrites directly into the user's chosen PC folder whenever linked & granted.
 */
export async function performAutoBackupOverwrite(
  payload: BackupPayload,
  folderPath: string,
  rawFileName: string
): Promise<{
  meta: AutoBackupMeta;
  linkedFolderName: string | null;
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

  // 1. Always write zero-permission OPFS file (overwrites every time)
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

  // 2. If user linked a local PC folder and permission is already granted, silently overwrite there too
  const folderInfo = await getSavedFolderInfo();
  let needsFolderPermission = false;

  if (folderInfo.handle) {
    if (folderInfo.permission === 'granted') {
      try {
        await writeTextOverwrite(folderInfo.handle, fileName, jsonString);
        targetType = 'folder';
        displayPath = `${folderInfo.name}/${fileName}`;
      } catch {
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
    needsFolderPermission,
  };
}

/**
 * Reads the latest overwritten auto-backup JSON text from the linked PC folder, OPFS, or IndexedDB mirror.
 */
export async function readLatestAutoBackupText(
  folderPath: string,
  rawFileName: string
): Promise<{ text: string; fileName: string } | null> {
  const fileName = sanitizeFileName(rawFileName);
  const segments = sanitizeFolderSegments(folderPath);

  // Try linked PC folder first if granted
  const folderInfo = await getSavedFolderInfo();
  if (folderInfo.handle && folderInfo.permission === 'granted') {
    const folderText = await readTextIfExists(folderInfo.handle, fileName);
    if (folderText) return { text: folderText, fileName };
  }

  // Try OPFS zero-permission folder
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
