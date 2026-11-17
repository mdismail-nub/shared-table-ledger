import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  getPendingSyncQueue,
  removeSyncQueueItem,
  updateSyncQueueItemStatus,
  countPendingOperations,
  getPendingEntityIds,
  type QueuedSyncOperation,
} from "./offline-db";
import { saveRecordFn } from "./mess.functions";
import { cppApi } from "./api-client";

type SyncListener = () => void;

let isSyncInProgress = false;
let lastSyncTimestamp: number | null = null;
const syncListeners = new Set<SyncListener>();

function notifySyncListeners() {
  syncListeners.forEach((l) => {
    try {
      l();
    } catch {
      // ignore
    }
  });
}

/**
 * Check if the browser can actually reach the internet.
 */
export async function checkActualConnectivity(): Promise<boolean> {
  if (typeof window === "undefined") return true;
  if (!navigator.onLine) return false;

  try {
    const res = await fetch("/favicon.png?_ping=" + Date.now(), {
      method: "HEAD",
      cache: "no-store",
    });
    return res.ok || res.status === 304;
  } catch {
    return false;
  }
}

/**
 * Process all pending offline operations and synchronize with server.
 */
export async function executePendingSync(
  messId?: string,
  onProgress?: (synced: number, total: number) => void,
): Promise<{ success: number; failed: number }> {
  if (isSyncInProgress) {
    return { success: 0, failed: 0 };
  }

  const isOnline = await checkActualConnectivity();
  if (!isOnline) {
    return { success: 0, failed: 0 };
  }

  isSyncInProgress = true;
  notifySyncListeners();

  let successCount = 0;
  let failCount = 0;

  try {
    const queue = await getPendingSyncQueue(messId);
    if (queue.length === 0) {
      isSyncInProgress = false;
      notifySyncListeners();
      return { success: 0, failed: 0 };
    }

    for (const item of queue) {
      if (!item.id) continue;

      try {
        await updateSyncQueueItemStatus(item.id, "syncing");

        // Primary: execute directly against C++ backend if available
        if (cppApi.isAvailable()) {
          let cppError: string | null = null;
          if (item.action === "insert") {
            if (item.table === "mess_expenses") {
              const res = await cppApi.expenses.add(item.payload as any);
              if (res.error) cppError = res.error;
            } else if (item.table === "payments") {
              const res = await cppApi.payments.record(item.payload as any);
              if (res.error) cppError = res.error;
            } else if (item.table === "mess_members") {
              const res = await cppApi.members.add(item.payload as any);
              if (res.error) cppError = res.error;
            } else if (item.table === "mess_notifications") {
              const res = await cppApi.notifications.send(item.payload as any);
              if (res.error) cppError = res.error;
            }
          } else if (item.action === "upsert") {
            if (item.table === "mess_meals") {
              const meals = Array.isArray(item.payload) ? item.payload : [item.payload];
              const res = await cppApi.meals.upsertDaily(meals as any);
              if (res.error) cppError = res.error;
            }
          } else if (item.action === "update") {
            if (item.table === "mess_members" && item.col === "id") {
              const res = await cppApi.members.updateStatus(String(item.val), (item.payload as any)?.status);
              if (res.error) cppError = res.error;
            } else if (item.table === "messes") {
              const res = await cppApi.settings.update(item.payload as any);
              if (res.error) cppError = res.error;
            }
          } else if (item.action === "delete") {
            const targetId = String(item.val || (item.payload as any)?.id);
            if (item.table === "mess_members") {
              const res = await cppApi.members.delete(targetId);
              if (res.error) cppError = res.error;
            } else if (item.table === "mess_expenses") {
              const res = await cppApi.expenses.delete(targetId);
              if (res.error) cppError = res.error;
            } else if (item.table === "payments") {
              const res = await cppApi.payments.delete(targetId);
              if (res.error) cppError = res.error;
            } else if (item.table === "mess_notifications") {
              const res = await cppApi.notifications.delete(targetId);
              if (res.error) cppError = res.error;
            }
          }

          if (cppError) {
            throw new Error(cppError);
          }
        } else {
          const reqData: {
            messId: string;
            table: string;
            action: "insert" | "update" | "upsert" | "delete";
            payload?: unknown;
            col?: string;
            val?: unknown;
          } = {
            messId: item.messId,
            table: item.table,
            action: item.action,
          };
          if (item.payload !== undefined) reqData.payload = item.payload;
          if (item.col !== undefined) reqData.col = item.col;
          if (item.val !== undefined) reqData.val = item.val;

          const res = await saveRecordFn({
            data: reqData,
          });

          if (res && (res as { error?: string }).error) {
            throw new Error((res as { error?: string }).error);
          }
        }

        // Successfully synced
        await removeSyncQueueItem(item.id);
        successCount++;
        if (onProgress) onProgress(successCount, queue.length);
      } catch (err) {
        failCount++;
        const errMsg = err instanceof Error ? err.message : "Sync error";
        await updateSyncQueueItemStatus(item.id, "failed", errMsg);

        // If network dropped mid-sync, abort early
        const stillOnline = await checkActualConnectivity();
        if (!stillOnline) break;
      }
    }

    lastSyncTimestamp = Date.now();

    if (successCount > 0) {
      toast.success(
        successCount === 1
          ? "1 offline change synced successfully! 🎉"
          : `${successCount} offline changes synced successfully! 🎉`,
      );
    }

    if (failCount > 0) {
      toast.error(`${failCount} change(s) could not be synced. Will retry automatically.`);
    }
  } finally {
    isSyncInProgress = false;
    notifySyncListeners();
  }

  return { success: successCount, failed: failCount };
}

/**
 * Register Background Sync event with the Service Worker.
 */
export function registerBackgroundSync() {
  if (typeof window !== "undefined" && "serviceWorker" in navigator && "SyncManager" in window) {
    navigator.serviceWorker.ready
      .then((reg) => {
        // @ts-expect-error SyncManager is standard in modern Chromium
        return reg.sync.register("sync-mess-data");
      })
      .catch(() => {
        // Fallback to foreground sync
      });
  }
}

/**
 * React hook to observe online/offline status and pending sync count.
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  });
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(() => isSyncInProgress);
  const [lastSync, setLastSync] = useState<number | null>(() => lastSyncTimestamp);

  const refreshCount = useCallback(async () => {
    const c = await countPendingOperations();
    setPendingCount(c);
    setIsSyncing(isSyncInProgress);
    setLastSync(lastSyncTimestamp);
  }, []);

  const triggerSyncNow = useCallback(async () => {
    const res = await executePendingSync();
    await refreshCount();
    return res;
  }, [refreshCount]);

  useEffect(() => {
    const updateOnline = () => {
      setIsOnline(true);
      executePendingSync().then(() => refreshCount());
    };

    const updateOffline = () => {
      setIsOnline(false);
      refreshCount();
    };

    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOffline);

    // SW message listener for Background Sync trigger
    const messageHandler = (e: MessageEvent) => {
      if (e.data?.type === "BACKGROUND_SYNC_TRIGGER") {
        executePendingSync().then(() => refreshCount());
      }
    };
    navigator.serviceWorker?.addEventListener("message", messageHandler);

    syncListeners.add(refreshCount);
    refreshCount();

    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOffline);
      navigator.serviceWorker?.removeEventListener("message", messageHandler);
      syncListeners.delete(refreshCount);
    };
  }, [refreshCount]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    lastSync,
    syncNow: triggerSyncNow,
  };
}

/**
 * React hook to get the set of entity IDs currently pending synchronization.
 */
export function usePendingEntities() {
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;
    const update = async () => {
      const ids = await getPendingEntityIds();
      if (mounted) setPendingIds(ids);
    };

    update();
    syncListeners.add(update);
    return () => {
      mounted = false;
      syncListeners.delete(update);
    };
  }, []);

  return pendingIds;
}
