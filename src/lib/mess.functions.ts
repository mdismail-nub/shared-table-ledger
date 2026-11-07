import { createServerFn } from "@tanstack/react-start";
import type { MessRecord } from "./mess-store";

export const lookupMessByCodeFn = createServerFn({ method: "POST" })
  .validator((d: { code: string }) => d)
  .handler(async ({ data }) => {
    const { serverLookupMessByCode } = await import("./server-storage.server");
    return serverLookupMessByCode(data.code);
  });

export const createMessFn = createServerFn({ method: "POST" })
  .validator(
    (d: {
      name: string;
      manager: string;
      address?: string;
      currency?: string;
      owner_id?: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    const { serverCreateMess } = await import("./server-storage.server");
    return serverCreateMess(data);
  });

export const loadWorkspaceByCodeFn = createServerFn({ method: "POST" })
  .validator((d: { code: string; month: string }) => d)
  .handler(async ({ data }) => {
    const { serverGetWorkspace } = await import("./server-storage.server");
    return serverGetWorkspace({ code: data.code, month: data.month });
  });

export const loadWorkspaceByIdFn = createServerFn({ method: "POST" })
  .validator((d: { messId: string; month: string }) => d)
  .handler(async ({ data }) => {
    const { serverGetWorkspace } = await import("./server-storage.server");
    return serverGetWorkspace({ messId: data.messId, month: data.month });
  });

export const saveRecordFn = createServerFn({ method: "POST" })
  .validator(
    (d: {
      messId: string;
      table: string;
      action: "insert" | "update" | "upsert" | "delete";
      payload?: unknown;
      col?: string;
      val?: unknown;
    }) => d,
  )
  .handler(async ({ data }) => {
    const { serverSaveRecord } = await import("./server-storage.server");
    return serverSaveRecord(data);
  });

export const syncMessToServerFn = createServerFn({ method: "POST" })
  .validator((d: { record: MessRecord }) => d)
  .handler(async ({ data }) => {
    const { serverSyncMessRecord } = await import("./server-storage.server");
    return serverSyncMessRecord(data.record);
  });
