import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { MessRecord } from "./mess-store";

function extractRequestToken(): string | undefined {
  try {
    const request = getRequest();
    if (!request?.headers) return undefined;
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.slice(7).trim();
    }
    const guestHeader = request.headers.get("x-guest-token");
    if (guestHeader) {
      return guestHeader.trim();
    }
  } catch {
    // In environments where getRequest is unavailable
  }
  return undefined;
}

export const lookupMessByCodeFn = createServerFn({ method: "POST" })
  .validator((d: { code: string }) => {
    if (!/^\d{6}$/.test((d?.code || "").trim())) {
      throw new Error("Invalid 6-digit invitation code.");
    }
    return d;
  })
  .handler(async ({ data }) => {
    const { serverLookupMessByCode } = await import("./server-storage.server");
    return serverLookupMessByCode(data.code);
  });

export const createGuestSessionFn = createServerFn({ method: "POST" })
  .validator((d: { code: string; memberId?: string }) => {
    if (!/^\d{6}$/.test((d?.code || "").trim())) {
      throw new Error("Invalid 6-digit invitation code.");
    }
    return d;
  })
  .handler(async ({ data }) => {
    const { serverLookupMessByCode, createGuestToken } = await import(
      "./server-storage.server"
    );
    const lookup = await serverLookupMessByCode(data.code);
    if (!lookup) {
      throw new Error("Mess not found with that code.");
    }
    const role = data.memberId ? "member" : "guest";
    const token = createGuestToken(lookup.id, data.memberId, role);
    return { token, messId: lookup.id, role };
  });

export const createMessFn = createServerFn({ method: "POST" })
  .validator(
    (d: {
      name: string;
      manager: string;
      address?: string | undefined;
      currency?: string | undefined;
      owner_id?: string | undefined;
      token?: string | undefined;
    }) => d,
  )
  .handler(async ({ data }) => {
    const { serverCreateMess } = await import("./server-storage.server");
    const token = data.token || extractRequestToken();
    return serverCreateMess({
      ...data,
      auth: token ? { userId: token, role: "admin" } : undefined,
    });
  });

export const loadWorkspaceByCodeFn = createServerFn({ method: "POST" })
  .validator(
    (d: {
      code: string;
      month: string;
      memberId?: string | undefined;
      token?: string | undefined;
    }) => d,
  )
  .handler(async ({ data }) => {
    const { serverGetWorkspace } = await import("./server-storage.server");
    const token = data.token || extractRequestToken();
    return serverGetWorkspace({
      code: data.code,
      month: data.month,
      memberId: data.memberId,
      token,
    });
  });

export const loadWorkspaceByIdFn = createServerFn({ method: "POST" })
  .validator((d: { messId: string; month: string; token?: string | undefined }) => d)
  .handler(async ({ data }) => {
    const { serverGetWorkspace } = await import("./server-storage.server");
    const token = data.token || extractRequestToken();
    return serverGetWorkspace({
      messId: data.messId,
      month: data.month,
      token,
    });
  });

export const saveRecordFn = createServerFn({ method: "POST" })
  .validator(
    (d: {
      messId: string;
      table: string;
      action: "insert" | "update" | "upsert" | "delete";
      payload?: unknown;
      col?: string | undefined;
      val?: unknown;
      token?: string | undefined;
    }) => d,
  )
  .handler(async ({ data }) => {
    const { serverSaveRecord } = await import("./server-storage.server");
    const token = data.token || extractRequestToken();
    return serverSaveRecord({
      ...data,
      token,
    });
  });

export const syncMessToServerFn = createServerFn({ method: "POST" })
  .validator((d: { record: MessRecord; token?: string | undefined }) => d)
  .handler(async ({ data }) => {
    const { serverSyncMessRecord, verifyGuestToken } = await import("./server-storage.server");
    const token = data.token || extractRequestToken();
    const verified = token ? verifyGuestToken(token) : null;
    return serverSyncMessRecord(
      data.record,
      verified ? { userId: verified.token, role: verified.role, messId: verified.messId } : undefined,
    );
  });
