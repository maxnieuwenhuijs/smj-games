// Opslaan in de browser: IndexedDB, met localStorage als vangnet.
const DB_NAME = 'smj-games';
const STORE = 'saves';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveGet<T>(key: string): Promise<T | undefined> {
  try {
    return (await tx<T | undefined>('readonly', s => s.get(key))) ?? undefined;
  } catch {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : undefined;
    } catch {
      return undefined;
    }
  }
}

export async function saveSet(key: string, value: unknown): Promise<void> {
  try {
    await tx('readwrite', s => s.put(value, key));
  } catch {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* opslaan lukt niet; het spel speelt gewoon door */
    }
  }
}

export async function saveDel(key: string): Promise<void> {
  try {
    await tx('readwrite', s => s.delete(key));
  } catch {
    /* niets te wissen */
  }
  try {
    localStorage.removeItem(key);
  } catch {
    /* geen localStorage */
  }
}

/** Vraagt de browser de opslag niet zomaar op te ruimen. */
export function askPersistence(): void {
  try {
    void navigator.storage?.persist?.();
  } catch {
    /* niet ondersteund */
  }
}
