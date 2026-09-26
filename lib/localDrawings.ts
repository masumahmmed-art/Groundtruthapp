// Drawing PDFs are kept on each user's PC rather than uploaded (migration 004).
// This module fingerprints a file and keeps a private copy in the browser's
// own storage (IndexedDB) so a drawing reopens on the same PC without the
// user having to find the file again. The copy is per browser profile: a
// private window, another browser, or cleared site data just means opening
// the file once more.

const DB_NAME = "groundtruth-drawings";
const STORE = "files";

/** SHA-256 of the bytes, as lowercase hex — the drawing's fingerprint. */
export async function fingerprint(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = op(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Saves this PC's copy of a drawing, keyed by its fingerprint. Throws if the browser refuses (e.g. out of space). */
export async function saveLocalCopy(hash: string, bytes: ArrayBuffer): Promise<void> {
  await run("readwrite", (s) => s.put(bytes, hash));
}

/** This PC's copy of a drawing, or null if there isn't one (or the browser's storage isn't available). */
export async function getLocalCopy(hash: string): Promise<ArrayBuffer | null> {
  try {
    const bytes = await run<ArrayBuffer | undefined>("readonly", (s) => s.get(hash));
    return bytes ?? null;
  } catch {
    return null;
  }
}

/** Removes this PC's copy of a drawing. Never throws. */
export async function deleteLocalCopy(hash: string): Promise<void> {
  try {
    await run("readwrite", (s) => s.delete(hash));
  } catch {
    // Nothing to clean up, or storage unavailable — either way nothing to do.
  }
}
