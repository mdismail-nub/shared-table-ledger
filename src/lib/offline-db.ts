// IndexedDB Local Storage & Sync Queue Engine for Mess Manager
const DB_NAME = "MessManagerOfflineDB";
const DB_VERSION = 1;

export interface QueuedSyncOperation {
  id?: number;
  uuid: string; // Idempotency key
  messId: string;
  table: string;
  action: "insert" | "update" | "upsert" | "delete";
  payload?: unknown;
  col?: string;
  val?: unknown;
  timestamp: number;
  status: "pending" | "syncing" | "failed";
  retryCount: number;
  error?: string;
}

export interface CachedWorkspaceRecord {
  key: string; // e.g. `${messId}_${month}`
  messId: string;
  month: string;
  data: unknown;
  savedAt: number;
}

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.reject(new Error("IndexedDB not available in this environment."));
  }

  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Store: Cached Workspaces
      if (!db.objectStoreNames.contains("workspaces")) {
        const wsStore = db.createObjectStore("workspaces", { keyPath: "key" });
        wsStore.createIndex("messId", "messId", { unique: false });
        wsStore.createIndex("month", "month", { unique: false });
      }

      // 2. Store: Pending Synchronization Queue
      if (!db.objectStoreNames.contains("sync_queue")) {
        const queueStore = db.createObjectStore("sync_queue", {
          keyPath: "id",
          autoIncrement: true,
        });
        queueStore.createIndex("status", "status", { unique: false });
        queueStore.createIndex("uuid", "uuid", { unique: true });
        queueStore.createIndex("messId", "messId", { unique: false });
      }

      // 3. Store: Offline Created Entity IDs (for pending UI indicators)
      if (!db.objectStoreNames.contains("offline_entities")) {
        db.createObjectStore("offline_entities", { keyPath: "id" });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
        dbPromise = null;
      };
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });

  return dbPromise;
}

// ----------------- WORKSPACE CACHING -----------------

export async function cacheWorkspaceToIndexedDB(
  messId: string,
  month: string,
  data: unknown,
): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("workspaces", "readwrite");
      const store = tx.objectStore("workspaces");
      const record: CachedWorkspaceRecord = {
        key: `${messId}_${month}`,
        messId,
        month,
        data,
        savedAt: Date.now(),
      };
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Non-fatal if IndexedDB fails
  }
}

export async function getCachedWorkspaceFromIndexedDB<T = unknown>(
  messId: string,
  month: string,
): Promise<T | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction("workspaces", "readonly");
      const store = tx.objectStore("workspaces");
      const req = store.get(`${messId}_${month}`);
      req.onsuccess = () => {
        const res = req.result as CachedWorkspaceRecord | undefined;
        resolve((res?.data as T) || null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// ----------------- SYNC QUEUE OPERATIONS -----------------

export async function enqueueSyncOperation(
  op: Omit<QueuedSyncOperation, "id" | "timestamp" | "status" | "retryCount">,
): Promise<number | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["sync_queue", "offline_entities"], "readwrite");
      const queueStore = tx.objectStore("sync_queue");
      const entityStore = tx.objectStore("offline_entities");

      const item: QueuedSyncOperation = {
        ...op,
        timestamp: Date.now(),
        status: "pending",
        retryCount: 0,
      };

      const req = queueStore.add(item);
      req.onsuccess = () => {
        const insertedId = req.result as number;

        // If this operation created or deleted an entity, mark it in offline_entities
        const entityId =
          (op.payload as { id?: string })?.id || (typeof op.val === "string" ? op.val : null);
        if (entityId) {
          entityStore.put({
            id: entityId,
            queueId: insertedId,
            action: op.action,
            table: op.table,
            createdAt: Date.now(),
          });
        }

        resolve(insertedId);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("[IndexedDB] Failed to enqueue operation:", err);
    return null;
  }
}

export async function getPendingSyncQueue(messId?: string): Promise<QueuedSyncOperation[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction("sync_queue", "readonly");
      const store = tx.objectStore("sync_queue");
      const req = store.getAll();

      req.onsuccess = () => {
        let results = (req.result || []) as QueuedSyncOperation[];
        if (messId) {
          results = results.filter((item) => item.messId === messId);
        }
        // FIFO order by timestamp/id
        results.sort((a, b) => (a.id || 0) - (b.id || 0));
        resolve(results);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function removeSyncQueueItem(id: number): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(["sync_queue", "offline_entities"], "readwrite");
      const queueStore = tx.objectStore("sync_queue");
      const entityStore = tx.objectStore("offline_entities");

      queueStore.delete(id);

      // Clean up offline entity matching this queueId
      const cursorReq = entityStore.openCursor();
      cursorReq.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          if (cursor.value.queueId === id) {
            cursor.delete();
          }
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}

export async function updateSyncQueueItemStatus(
  id: number,
  status: "pending" | "syncing" | "failed",
  error?: string,
): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction("sync_queue", "readwrite");
      const store = tx.objectStore("sync_queue");
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const item = getReq.result as QueuedSyncOperation | undefined;
        if (item) {
          item.status = status;
          if (status === "failed") {
            item.retryCount = (item.retryCount || 0) + 1;
            item.error = error || "Sync failed";
          }
          store.put(item);
        }
        resolve();
      };
      getReq.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}

export async function countPendingOperations(messId?: string): Promise<number> {
  const queue = await getPendingSyncQueue(messId);
  return queue.filter((i) => i.status !== "syncing").length;
}

export async function isEntityPendingSync(entityId: string): Promise<boolean> {
  if (!entityId) return false;
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction("offline_entities", "readonly");
      const store = tx.objectStore("offline_entities");
      const req = store.get(entityId);
      req.onsuccess = () => resolve(!!req.result);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

export async function getPendingEntityIds(): Promise<Set<string>> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction("offline_entities", "readonly");
      const store = tx.objectStore("offline_entities");
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result || []) as Array<{ id: string }>;
        resolve(new Set(items.map((i) => i.id)));
      };
      req.onerror = () => resolve(new Set());
    });
  } catch {
    return new Set();
  }
}
