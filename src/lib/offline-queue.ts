/**
 * A tiny persistent queue for mutations made while offline. IndexedDB when it
 * exists (survives a reload / app restart), an in-memory fallback otherwise
 * (SSR, tests, private mode).
 */
export interface PendingAction {
  id?: number;
  url: string;
  method: string;
  body: unknown;
  label: string;
  at: number;
}

const DB_NAME = "throughline";
const STORE = "pending";

const hasIDB = typeof indexedDB !== "undefined";
const memory: PendingAction[] = [];
let memSeq = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (fn: () => void) => {
      if (!settled) {
        settled = true;
        fn();
      }
    };
    // Never hang the UI if IndexedDB is unavailable / blocked.
    const timer = setTimeout(() => done(() => reject(new Error("indexedDB open timed out"))), 3000);
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => done(() => {
      clearTimeout(timer);
      resolve(req.result);
    });
    req.onerror = () => done(() => {
      clearTimeout(timer);
      reject(req.error);
    });
    req.onblocked = () => done(() => {
      clearTimeout(timer);
      reject(new Error("indexedDB blocked"));
    });
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const store = db.transaction(STORE, mode).objectStore(STORE);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function enqueue(action: Omit<PendingAction, "id">): Promise<void> {
  if (!hasIDB) {
    memory.push({ ...action, id: memSeq++ });
    return;
  }
  await tx("readwrite", (s) => s.add(action));
}

export async function listPending(): Promise<PendingAction[]> {
  if (!hasIDB) return [...memory];
  return (await tx<PendingAction[]>("readonly", (s) => s.getAll())) ?? [];
}

export async function removePending(id: number): Promise<void> {
  if (!hasIDB) {
    const i = memory.findIndex((a) => a.id === id);
    if (i >= 0) memory.splice(i, 1);
    return;
  }
  await tx("readwrite", (s) => s.delete(id));
}

export async function countPending(): Promise<number> {
  if (!hasIDB) return memory.length;
  return (await tx<number>("readonly", (s) => s.count())) ?? 0;
}

/** Replay every queued action oldest-first. Returns how many succeeded. */
export async function drainPending(): Promise<{ sent: number; remaining: number }> {
  const items = (await listPending()).sort((a, b) => a.at - b.at);
  let sent = 0;
  for (const item of items) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(item.body),
      });
      if (!res.ok && res.status < 500) {
        // A 4xx won't get better on retry — drop it so the queue can clear.
        if (item.id != null) await removePending(item.id);
        continue;
      }
      if (!res.ok) break; // 5xx / transient — stop and try again later
      if (item.id != null) await removePending(item.id);
      sent += 1;
    } catch {
      break; // still offline
    }
  }
  return { sent, remaining: await countPending() };
}
