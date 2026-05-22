// IndexedDB-backed store for user-uploaded tabla samples.
// Stores one Blob per bol key (case-insensitive). Survives reloads.

const DB_NAME = "taalriya-samples";
const STORE = "samples";
const VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

const key = (bol: string) => bol.trim().toLowerCase();

export async function putSample(bol: string, blob: Blob) {
  await tx("readwrite", (s) => s.put(blob, key(bol)));
}

export async function getSample(bol: string): Promise<Blob | undefined> {
  return tx<Blob | undefined>("readonly", (s) => s.get(key(bol)) as IDBRequest<Blob | undefined>);
}

export async function deleteSample(bol: string) {
  await tx("readwrite", (s) => s.delete(key(bol)));
}

export async function listSampleKeys(): Promise<string[]> {
  return tx<IDBValidKey[]>("readonly", (s) => s.getAllKeys()).then((ks) =>
    (ks as string[]).map(String),
  );
}
