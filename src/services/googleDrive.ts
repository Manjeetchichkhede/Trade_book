import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { BackupPayload } from '../types';

export const SCOPES = ['https://www.googleapis.com/auth/drive.file'] as const;

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

let isSigningIn = false;
// In-memory only: never persisted to localStorage or sessionStorage
let cachedAccessToken: string | null = null;

export interface DriveBackupFile {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
}

export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: (user: User | null) => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure?.(user);
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure?.(null);
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Could not obtain Google Drive access token. Please try signing in again.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => cachedAccessToken;

export const clearAccessToken = (): void => {
  cachedAccessToken = null;
};

export const googleSignOut = async (): Promise<void> => {
  cachedAccessToken = null;
  await auth.signOut();
};

async function driveFetch(url: string, init: RequestInit): Promise<Response> {
  const token = cachedAccessToken;
  if (!token) {
    throw new Error('AUTH_REQUIRED');
  }
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.status === 401) {
    cachedAccessToken = null;
    throw new Error('AUTH_REQUIRED');
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Google Drive error (${res.status}): ${errText.slice(0, 180) || res.statusText}`);
  }
  return res;
}

export async function listDriveBackups(): Promise<DriveBackupFile[]> {
  const q = encodeURIComponent(
    "name contains 'tradebook-backup' and mimeType='application/json' and trashed=false"
  );
  const fields = encodeURIComponent('files(id,name,modifiedTime,size)');
  const orderBy = encodeURIComponent('modifiedTime desc');
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=${orderBy}&pageSize=15`;

  const res = await driveFetch(url, { method: 'GET' });
  const data = (await res.json()) as { files?: DriveBackupFile[] };
  return data.files ?? [];
}

export async function createDriveBackup(
  payload: BackupPayload,
  fileName: string
): Promise<DriveBackupFile> {
  const boundary = `tradebook_boundary_${Date.now().toString(36)}`;
  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    description: 'tradebook offline journal & prop-firm portfolio backup',
  };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(payload)}\r\n` +
    `--${boundary}--`;

  const url =
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size';
  const res = await driveFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  return (await res.json()) as DriveBackupFile;
}

export async function updateDriveBackup(
  fileId: string,
  payload: BackupPayload
): Promise<DriveBackupFile> {
  const url = `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(
    fileId
  )}?uploadType=media&fields=id,name,modifiedTime,size`;
  const res = await driveFetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(payload),
  });
  return (await res.json()) as DriveBackupFile;
}

export async function downloadDriveBackup(fileId: string): Promise<BackupPayload> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
  const res = await driveFetch(url, { method: 'GET' });
  return (await res.json()) as BackupPayload;
}

export async function deleteDriveBackup(fileId: string): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`;
  await driveFetch(url, { method: 'DELETE' });
}
