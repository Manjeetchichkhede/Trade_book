const DB_NAME = 'tradebook_offline_db';
const DB_VERSION = 1;
const KV_STORE = 'kv';
const IMG_STORE = 'images';
const LS_PREFIX = 'tradebook_v2_';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(KV_STORE)) {
            db.createObjectStore(KV_STORE);
          }
          if (!db.objectStoreNames.contains(IMG_STORE)) {
            db.createObjectStore(IMG_STORE);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

export async function kvGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    if (db) {
      const result = await new Promise<T | null>((resolve) => {
        try {
          const tx = db.transaction(KV_STORE, 'readonly');
          const store = tx.objectStore(KV_STORE);
          const req = store.get(key);
          req.onsuccess = () => resolve((req.result as T) ?? null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
      if (result !== null) return result;
    }
  } catch {
    // Fall back to localStorage
  }

  try {
    const raw = window.localStorage.getItem(LS_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDB();
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(KV_STORE, 'readwrite');
          tx.objectStore(KV_STORE).put(value, key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
  } catch {
    // Fallback below
  }

  try {
    window.localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  } catch {
    // Ignore quota errors on localStorage backup
  }
}

export async function saveImage(id: string, dataUrl: string): Promise<void> {
  try {
    const db = await openDB();
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(IMG_STORE, 'readwrite');
          tx.objectStore(IMG_STORE).put(dataUrl, id);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
      return;
    }
  } catch {
    // Fallback to localStorage
  }

  try {
    window.localStorage.setItem(LS_PREFIX + 'img_' + id, dataUrl);
  } catch {
    // Quota exceeded
  }
}

export async function getImage(id: string): Promise<string | null> {
  try {
    const db = await openDB();
    if (db) {
      const result = await new Promise<string | null>((resolve) => {
        try {
          const tx = db.transaction(IMG_STORE, 'readonly');
          const req = tx.objectStore(IMG_STORE).get(id);
          req.onsuccess = () => resolve((req.result as string) ?? null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
      if (result) return result;
    }
  } catch {
    // Fallback below
  }

  try {
    return window.localStorage.getItem(LS_PREFIX + 'img_' + id);
  } catch {
    return null;
  }
}

export async function deleteImage(id: string): Promise<void> {
  try {
    const db = await openDB();
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(IMG_STORE, 'readwrite');
          tx.objectStore(IMG_STORE).delete(id);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
  } catch {
    // Ignore
  }
  try {
    window.localStorage.removeItem(LS_PREFIX + 'img_' + id);
  } catch {
    // Ignore
  }
}

export async function getAllImages(): Promise<Record<string, string>> {
  const images: Record<string, string> = {};
  try {
    const db = await openDB();
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(IMG_STORE, 'readonly');
          const store = tx.objectStore(IMG_STORE);
          const cursorReq = store.openCursor();
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (cursor) {
              images[String(cursor.key)] = String(cursor.value);
              cursor.continue();
            } else {
              resolve();
            }
          };
          cursorReq.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
  } catch {
    // Ignore
  }

  // Merge any localStorage fallback images
  try {
    const imgPrefix = LS_PREFIX + 'img_';
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(imgPrefix)) {
        const id = k.slice(imgPrefix.length);
        if (!images[id]) {
          const val = window.localStorage.getItem(k);
          if (val) images[id] = val;
        }
      }
    }
  } catch {
    // Ignore
  }

  return images;
}

export async function clearAllImages(): Promise<void> {
  try {
    const db = await openDB();
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(IMG_STORE, 'readwrite');
          tx.objectStore(IMG_STORE).clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
  } catch {
    // Ignore
  }
  try {
    const imgPrefix = LS_PREFIX + 'img_';
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(imgPrefix)) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // Ignore
  }
}

export function compressImageFile(file: File, maxDim = 1400, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const src = String(reader.result || '');
      const img = new Image();
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            const ratio = Math.min(maxDim / width, maxDim / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(src);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const output = canvas.toDataURL('image/jpeg', quality);
          resolve(output);
        } catch {
          resolve(src);
        }
      };
      img.onerror = () => resolve(src);
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}
