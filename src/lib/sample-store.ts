// IndexedDB store for user-defined bols.
// Two stores: blobs (id -> Blob) and meta (id -> {id, name, createdAt}).

const DB_NAME = "taalriya-library";
const BLOBS = "blobs";
const META = "meta";
const VERSION = 1;

export interface BolMeta {
  id: string;
  name: string;
  createdAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BLOBS)) db.createObjectStore(BLOBS);
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const r = fn(t.objectStore(storeName));
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      }),
  );
}

export async function listMeta(): Promise<BolMeta[]> {
  const vals = await run<BolMeta[]>(META, "readonly", (s) => s.getAll() as IDBRequest<BolMeta[]>);
  return vals.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getBlob(id: string): Promise<Blob | undefined> {
  return run<Blob | undefined>(BLOBS, "readonly", (s) => s.get(id) as IDBRequest<Blob | undefined>);
}

export async function putBol(meta: BolMeta, blob: Blob) {
  await run(BLOBS, "readwrite", (s) => s.put(blob, meta.id));
  await run(META, "readwrite", (s) => s.put(meta, meta.id));
}

export async function renameBol(id: string, name: string) {
  const m = await run<BolMeta | undefined>(
    META,
    "readonly",
    (s) => s.get(id) as IDBRequest<BolMeta | undefined>,
  );
  if (!m) return;
  m.name = name;
  await run(META, "readwrite", (s) => s.put(m, id));
}

export async function removeBol(id: string) {
  await run(BLOBS, "readwrite", (s) => s.delete(id));
  await run(META, "readwrite", (s) => s.delete(id));
}
