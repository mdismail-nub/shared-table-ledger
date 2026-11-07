export interface InviteMemberSummary {
  id: string;
  name: string;
  role?: "admin" | "member";
  room?: string;
  phone?: string;
  status?: "active" | "new" | "left";
  tone?: string;
}

export interface InvitePayload {
  id: string;
  name: string;
  manager: string;
  code: string;
  currency?: string | undefined;
  memberCount?: number | undefined;
  members?: InviteMemberSummary[] | undefined;
  timestamp?: number | undefined;
}

/**
 * Encodes mess invite data into a URL-safe base64 token.
 */
export function encodeInviteToken(payload: InvitePayload): string {
  try {
    const json = JSON.stringify(payload);
    if (typeof window !== "undefined") {
      const utf8 = encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, p1) =>
        String.fromCharCode(parseInt(p1, 16)),
      );
      return btoa(utf8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }
    return Buffer.from(json).toString("base64url");
  } catch {
    return "";
  }
}

/**
 * Decodes a URL-safe base64 token into mess invite data.
 */
export function decodeInviteToken(token: string): InvitePayload | null {
  if (!token) return null;
  try {
    let base64 = token.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    let json = "";
    if (typeof window !== "undefined") {
      const binary = atob(base64);
      json = decodeURIComponent(
        Array.from(binary)
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join(""),
      );
    } else {
      json = Buffer.from(base64, "base64").toString("utf-8");
    }
    const data = JSON.parse(json);
    if (data && (data.id || data.name)) {
      if (Array.isArray(data.members) && (!data.memberCount || data.memberCount <= 0)) {
        data.memberCount = data.members.filter(
          (m: { status?: string }) => m.status !== "left",
        ).length;
      }
      return data as InvitePayload;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Generates a full shareable invite URL for a mess.
 */
export function createMessInviteLink(params: {
  id: string;
  name: string;
  manager: string;
  code: string;
  currency?: string | undefined;
  memberCount?: number | undefined;
  members?:
    | Array<{
        id: string;
        name: string;
        role?: "admin" | "member";
        room?: string;
        phone?: string;
        status?: "active" | "new" | "left";
        tone?: string;
      }>
    | undefined;
}): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const members: InviteMemberSummary[] | undefined = params.members?.map((m) => ({
    id: m.id,
    name: m.name,
    role: m.role || "member",
    room: m.room || "",
    phone: m.phone || "",
    status: m.status || "active",
    tone: m.tone || "mint",
  }));

  const activeCount =
    typeof params.memberCount === "number" && params.memberCount > 0
      ? params.memberCount
      : members && members.length > 0
        ? members.filter((m) => m.status !== "left").length
        : undefined;

  const token = encodeInviteToken({
    id: params.id,
    name: params.name,
    manager: params.manager,
    code: params.code,
    currency: params.currency || "BDT (৳)",
    memberCount: activeCount,
    members,
    timestamp: Date.now(),
  });

  const query = new URLSearchParams({
    join: "1",
    t: token,
    id: params.id,
    name: params.name,
    mgr: params.manager,
    code: params.code,
  });

  if (typeof activeCount === "number" && activeCount > 0) {
    query.set("mc", String(activeCount));
  }

  return `${origin}/join?${query.toString()}`;
}

/**
 * Parses invite parameters from any URL query string.
 */
export function parseInviteFromUrl(search: string): InvitePayload | null {
  if (!search) return null;
  try {
    const params = new URLSearchParams(search);
    const token = params.get("t") || params.get("token") || params.get("d");
    if (token) {
      const decoded = decodeInviteToken(token);
      if (decoded) return decoded;
    }

    const id = params.get("id");
    const name = params.get("name");
    const manager = params.get("mgr") || params.get("manager");
    const code = params.get("code");
    const currency = params.get("cur") || params.get("currency") || "BDT (৳)";
    const mc = params.get("mc");
    const memberCount = mc ? Number(mc) : undefined;

    if (id || name || code) {
      return {
        id: id || `mess_${Date.now()}`,
        name: name || "Shared Mess",
        manager: manager || "Admin",
        code: code || "123456",
        currency,
        memberCount:
          typeof memberCount === "number" && !isNaN(memberCount) ? memberCount : undefined,
        timestamp: Date.now(),
      };
    }
    return null;
  } catch {
    return null;
  }
}
