// Call recordings live in this browser's IndexedDB, keyed by call id. Video files are too big
// for free serverless hosting, and keeping them local means they never leave the user's machine.
const DB_NAME = 'fathom-media';
const STORE = 'recordings';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(req.result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getRecording(id: string): Promise<File | null> {
  try { return (await run<File | undefined>('readonly', s => s.get(id))) ?? null; } catch { return null; }
}

export async function saveRecording(id: string, file: File): Promise<boolean> {
  try { await run('readwrite', s => s.put(file, id)); return true; } catch { return false; }
}

export async function deleteRecording(id: string) {
  try { await run('readwrite', s => s.delete(id)); } catch { /* storage unavailable */ }
}

export const isMedia = (f: File) => f.type.startsWith('video/') || f.type.startsWith('audio/');
