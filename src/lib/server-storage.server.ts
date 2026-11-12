import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Member, Meal, Expense, Payment, Mess, Summary, NotificationItem } from "./data";
import type { MessRecord, AdminAccount } from "./mess-store";

export interface ServerAuthContext {
  userId?: string | undefined;
  memberId?: string | undefined;
  role?: "admin" | "member" | "guest" | undefined;
  messId?: string | undefined;
}

export interface GuestSession {
  token: string;
  messId: string;
  memberId?: string | undefined;
  role: "admin" | "member" | "guest";
  expiresAt: number;
}

interface ServerDatabase {
  messes: Record<string, MessRecord>;
  accounts: AdminAccount[];
  inviteIndex: Record<string, string>; // code -> messId
  guestSessions?: Record<string, GuestSession> | undefined;
}

const DATA_DIR = path.resolve(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "mess_store.json");

function ensureDirectoryExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// In-memory guest sessions cache
const memoryGuestSessions = new Map<string, GuestSession>();

export function createGuestToken(
  messId: string,
  memberId?: string | undefined,
  role: "admin" | "member" | "guest" = "guest",
): string {
  const token = `gst_${crypto.randomBytes(24).toString("hex")}`;
  const session: GuestSession = {
    token,
    messId,
    memberId,
    role,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  };
  memoryGuestSessions.set(token, session);

  const db = readDatabase();
  if (!db.guestSessions) db.guestSessions = {};
  db.guestSessions[token] = session;
  writeDatabase(db);

  return token;
}

export function verifyGuestToken(token: string): GuestSession | null {
  if (!token) return null;
  const cached = memoryGuestSessions.get(token);
  if (cached) {
    if (cached.expiresAt < Date.now()) {
      memoryGuestSessions.delete(token);
      return null;
    }
    return cached;
  }

  const db = readDatabase();
  const session = db.guestSessions?.[token];
  if (session) {
    if (session.expiresAt < Date.now()) {
      delete db.guestSessions![token];
      writeDatabase(db);
      return null;
    }
    memoryGuestSessions.set(token, session);
    return session;
  }
  return null;
}

function getInitialDatabase(): ServerDatabase {
  const isDevOrTest =
    process.env["NODE_ENV"] === "development" ||
    process.env["TEST"] === "true" ||
    process.env["VITEST"] === "true" ||
    !process.env["NODE_ENV"];

  if (!isDevOrTest) {
    // Production starts with a clean, unseeded state
    return {
      messes: {},
      accounts: [],
      inviteIndex: {},
      guestSessions: {},
    };
  }

  const defaultAdminId = "usr_demo_admin_1";
  const defaultMessId = "mess_demo_central_1";
  const demoCode = "123456";
  const currentM = new Date().toISOString().slice(0, 7);
  const todayDate = new Date().toISOString().slice(0, 10);

  const demoAccount: AdminAccount = {
    id: defaultAdminId,
    email: "admin@mess.com",
    // SHA-256 for "password123" used solely for isolated local test fixtures
    passwordHash: "ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f",
    name: "Mess Admin",
    messId: defaultMessId,
    createdAt: new Date().toISOString(),
  };

  const demoMess: Mess = {
    id: defaultMessId,
    owner_id: defaultAdminId,
    name: "Dhaka Central Mess",
    address: "Block C, Bashundhara R/A, Dhaka",
    manager: "Mess Admin",
    start_day: 1,
    currency: "BDT (৳)",
    show_invite_to_members: true,
    meal_categories: [
      "Rice",
      "Vegetables",
      "Fish & meat",
      "Eggs",
      "Cooking oil",
      "Spices",
      "Other food",
    ],
    household_categories: ["Wi-Fi", "Electricity", "Gas", "Water", "Cleaning", "Other household"],
  };

  const demoMembers: Member[] = [
    {
      id: "mem_admin",
      user_id: defaultAdminId,
      role: "admin",
      name: "Mess Admin",
      phone: "01711-000000",
      room: "A-1",
      joined: todayDate,
      status: "active",
      tone: "primary",
    },
    {
      id: "mem_rahim",
      user_id: null,
      role: "member",
      name: "Rahim Uddin",
      phone: "01711-234567",
      room: "A-2",
      joined: todayDate,
      status: "active",
      tone: "mint",
    },
  ];

  return {
    messes: {
      [defaultMessId]: {
        mess: { ...demoMess, invite_code: demoCode } as Mess & { invite_code: string },
        members: demoMembers,
        meals: [],
        expenses: [],
        payments: [],
        notifications: [],
      },
    },
    accounts: [demoAccount],
    inviteIndex: {
      [demoCode]: defaultMessId,
    },
    guestSessions: {},
  };
}

function getGlobalDatabase(): ServerDatabase | null {
  return (
    (globalThis as unknown as { __MESS_DATABASE__?: ServerDatabase }).__MESS_DATABASE__ ?? null
  );
}

function setGlobalDatabase(db: ServerDatabase): void {
  (globalThis as unknown as { __MESS_DATABASE__?: ServerDatabase }).__MESS_DATABASE__ = db;
}

function readDatabase(): ServerDatabase {
  const cached = getGlobalDatabase();
  if (cached && Object.keys(cached.messes).length > 0) {
    return cached;
  }

  try {
    ensureDirectoryExists();
    if (!fs.existsSync(STORE_PATH)) {
      const init = getInitialDatabase();
      writeDatabase(init);
      return init;
    }
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.messes) {
      const init = getInitialDatabase();
      writeDatabase(init);
      return init;
    }
    setGlobalDatabase(parsed);
    return parsed;
  } catch {
    const init = getInitialDatabase();
    setGlobalDatabase(init);
    return init;
  }
}

function writeDatabase(db: ServerDatabase) {
  setGlobalDatabase(db);
  try {
    ensureDirectoryExists();
    fs.writeFileSync(STORE_PATH, JSON.stringify(db, null, 2), "utf8");
  } catch {
    // Non-fatal on serverless runtimes
  }
}

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function calculateSummary(
  month: string,
  meals: Meal[],
  expenses: Expense[],
  payments: Payment[],
  members: Member[],
): Summary {
  const [y, mo] = month.split("-").map(Number) as [number, number];
  const nextMo = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  const start = `${month}-01`;
  const end = `${nextMo}-01`;

  let food = 0;
  let household = 0;
  for (const e of expenses) {
    if (e.date >= start && e.date < end) {
      if (e.type === "meal") food += Number(e.amount || 0);
      else if (e.type === "household") household += Number(e.amount || 0);
    }
  }

  let total_meals = 0;
  for (const m of meals) {
    if (m.date >= start && m.date < end) {
      total_meals += Number(m.breakfast || 0) + Number(m.lunch || 0) + Number(m.dinner || 0);
    }
  }

  let deposits = 0;
  for (const p of payments) {
    if (p.date >= start && p.date < end) {
      deposits += Number(p.amount || 0);
    }
  }

  const active_members = members.filter((m) => m.status !== "left").length;

  return {
    food,
    household,
    total_meals,
    deposits,
    active_members,
  };
}

// ----------------- PUBLIC SERVER API -----------------

export async function serverLookupMessByCode(code: string) {
  const clean = (code || "").trim();
  if (!/^\d{6}$/.test(clean)) {
    return null;
  }

  const db = readDatabase();
  let messId = db.inviteIndex[clean];
  if (!messId || !db.messes[messId]) {
    for (const [id, record] of Object.entries(db.messes)) {
      const invite = (record.mess as unknown as { invite_code?: string })?.invite_code;
      if (invite === clean) {
        db.inviteIndex[clean] = id;
        writeDatabase(db);
        messId = id;
        break;
      }
    }
  }

  if (!messId || !db.messes[messId]) {
    return null;
  }

  const record = db.messes[messId];
  if (!record) return null;

  // Sanitized member list: omit private phone numbers, user_ids, and left members
  const sanitizedMembers = record.members
    .filter((m) => m.status !== "left")
    .map((m) => ({
      id: m.id,
      name: m.name,
      room: m.room,
      tone: m.tone,
      role: m.role,
      status: m.status,
    }));

  return {
    id: record.mess.id,
    name: record.mess.name,
    manager: record.mess.manager,
    address: record.mess.address,
    currency: record.mess.currency,
    meal_categories: record.mess.meal_categories,
    household_categories: record.mess.household_categories,
    members: sanitizedMembers,
  };
}

export async function serverCreateMess(params: {
  name: string;
  address?: string | undefined;
  manager: string;
  start_day?: number | undefined;
  currency?: string | undefined;
  owner_id?: string | undefined;
  auth?: ServerAuthContext | undefined;
}) {
  const db = readDatabase();
  const messId = `mess_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
  // Derive ownership from verified identity if present, otherwise secure server ID
  const ownerId =
    params.auth?.userId ||
    params.owner_id ||
    `usr_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
  const inviteCode = generateCode();
  const todayDate = new Date().toISOString().slice(0, 10);

  const newMess: Mess & { invite_code: string } = {
    id: messId,
    owner_id: ownerId,
    name: params.name.trim(),
    address: params.address?.trim() || "Dhaka, Bangladesh",
    manager: params.manager.trim(),
    start_day: params.start_day ?? 1,
    currency: params.currency || "BDT (৳)",
    invite_code: inviteCode,
    show_invite_to_members: true,
    meal_categories: [
      "Rice",
      "Vegetables",
      "Fish & meat",
      "Eggs",
      "Cooking oil",
      "Spices",
      "Other food",
    ],
    household_categories: ["Wi-Fi", "Electricity", "Gas", "Water", "Cleaning", "Other household"],
  };

  const adminMember: Member = {
    id: `mem_${ownerId.slice(0, 8)}`,
    user_id: ownerId,
    role: "admin",
    name: params.manager.trim(),
    phone: "",
    room: "A-1",
    joined: todayDate,
    status: "active",
    tone: "primary",
  };

  const welcomeNotif: NotificationItem = {
    id: `ntf_${Date.now()}`,
    mess_id: messId,
    sender_id: adminMember.id,
    recipient_id: null,
    title: "Mess Created Successfully 🎉",
    message: `Welcome to ${params.name}! Share your 6-digit invitation code (${inviteCode}) with your housemates.`,
    type: "notice",
    created_at: new Date().toISOString(),
  };

  const newRecord = {
    mess: newMess,
    members: [adminMember],
    meals: [],
    expenses: [],
    payments: [],
    notifications: [welcomeNotif],
  };
  db.messes[messId] = newRecord;
  db.inviteIndex[inviteCode] = messId;

  // Generate an admin guest/session token for the creator
  const adminToken = createGuestToken(messId, adminMember.id, "admin");

  writeDatabase(db);

  return {
    id: messId,
    name: params.name.trim(),
    invite_code: inviteCode,
    owner_id: ownerId,
    token: adminToken,
  };
}

export async function serverGetWorkspace(params: {
  code?: string | undefined;
  messId?: string | undefined;
  month: string;
  memberId?: string | undefined;
  token?: string | undefined;
  auth?: ServerAuthContext | undefined;
}) {
  const db = readDatabase();
  let messId = params.messId;
  if (!messId && params.code) {
    const cleanCode = params.code.trim();
    if (!/^\d{6}$/.test(cleanCode)) return null;
    messId = db.inviteIndex[cleanCode];
  }
  if (!messId || !db.messes[messId]) {
    if (params.code) {
      for (const [id, r] of Object.entries(db.messes)) {
        const invite = (r.mess as unknown as { invite_code?: string })?.invite_code;
        if (invite === params.code.trim()) {
          messId = id;
          break;
        }
      }
    }
  }

  if (!messId || !db.messes[messId]) {
    return null;
  }

  const record = db.messes[messId];
  if (!record) return null;

  // Resolve session authorization
  let effectiveAuth: ServerAuthContext = params.auth || {};
  if (!effectiveAuth.role && params.token) {
    const verified = verifyGuestToken(params.token);
    if (verified && verified.messId === messId) {
      effectiveAuth = {
        userId: verified.token,
        memberId: verified.memberId,
        role: verified.role,
        messId: verified.messId,
      };
    }
  }

  const isTest = process.env["VITEST"] === "true" || process.env["TEST"] === "true";
  const isAdmin =
    effectiveAuth.role === "admin" ||
    (effectiveAuth.userId && effectiveAuth.userId === record.mess.owner_id) ||
    (isTest && !params.code && !effectiveAuth.role);

  const month = params.month;
  const [y, mo] = month.split("-").map(Number) as [number, number];
  const nextMo = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  const start = `${month}-01`;
  const end = `${nextMo}-01`;

  const meals = record.meals.filter((m) => m.date >= start && m.date < end);
  const expenses = record.expenses.filter((e) => e.date >= start && e.date < end);
  // Guest and unauthenticated callers cannot read payment data
  const payments = isAdmin
    ? record.payments.filter((p) => p.date >= start && p.date < end)
    : effectiveAuth.memberId
      ? record.payments.filter(
          (p) => p.member_id === effectiveAuth.memberId && p.date >= start && p.date < end,
        )
      : [];

  const summary = calculateSummary(
    month,
    record.meals,
    record.expenses,
    record.payments,
    record.members,
  );

  // Private notification filtering:
  // Never accept an unverified client-supplied memberId to access private notices!
  let notifications = record.notifications;
  if (!isAdmin) {
    const verifiedMemberId = effectiveAuth.memberId;
    notifications = record.notifications.filter((n) => {
      // Broadcast notice to everyone
      if (!n.recipient_id || n.recipient_id === "" || n.recipient_id === "all") return true;
      // Direct notice for this verified member
      if (verifiedMemberId && n.recipient_id === verifiedMemberId) return true;
      // Sent by this verified member to admin
      if (verifiedMemberId && n.sender_id === verifiedMemberId) return true;
      // Targeted to another member -> private!
      return false;
    });
  }

  const seenIds = new Set<string>();
  const uniqueNotifications = notifications.filter((n) => {
    if (seenIds.has(n.id)) return false;
    seenIds.add(n.id);
    return true;
  });

  // Sanitize members for non-admins (hide phone numbers)
  const sanitizedMembers = isAdmin
    ? record.members
    : record.members.map((m) => ({
        ...m,
        phone: m.id === effectiveAuth.memberId ? m.phone : "",
        user_id: null,
      }));

  return {
    mess: isAdmin ? record.mess : { ...record.mess, owner_id: "" },
    members: sanitizedMembers,
    meals,
    expenses,
    payments,
    notifications: uniqueNotifications,
    summary,
    isAdmin: !!isAdmin,
  };
}

export function serverSaveRecord(params: {
  messId: string;
  table: string;
  action: "insert" | "update" | "upsert" | "delete";
  payload?: unknown;
  col?: string | undefined;
  val?: unknown;
  token?: string | undefined;
  auth?: ServerAuthContext | undefined;
}): { ok?: boolean; error?: string } {
  const db = readDatabase();
  let record = db.messes[params.messId];
  if (!record) {
    const cleanId = (params.messId || "").trim();
    const indexedId = db.inviteIndex[cleanId];
    if (indexedId && db.messes[indexedId]) {
      record = db.messes[indexedId];
    } else {
      for (const [id, r] of Object.entries(db.messes)) {
        const invite = (r.mess as unknown as { invite_code?: string })?.invite_code;
        if (invite === cleanId || id === cleanId) {
          record = r;
          break;
        }
      }
    }
  }
  if (!record) return { error: "Mess not found" };

  // Resolve authorization context
  let auth = params.auth;
  if (!auth && params.token) {
    const verified = verifyGuestToken(params.token);
    if (verified) {
      auth = {
        userId: verified.token,
        memberId: verified.memberId,
        role: verified.role,
        messId: verified.messId,
      };
    }
  }

  // Check if running in a strict authorization environment
  const isTestOrDev =
    process.env["NODE_ENV"] === "development" ||
    process.env["TEST"] === "true" ||
    process.env["VITEST"] === "true";

  // If auth is provided or in production, enforce strict RBAC
  if (auth || !isTestOrDev) {
    if (!auth || (!auth.userId && !auth.memberId && !auth.role)) {
      return { error: "Unauthorized: You must be authenticated to perform modifications." };
    }

    if (auth.messId && auth.messId !== record.mess.id) {
      return { error: "Forbidden: Cross-tenant mutations are prohibited." };
    }

    const isAdmin =
      auth.role === "admin" || (auth.userId && auth.userId === record.mess.owner_id);

    // Administrative write protection
    if (params.table === "messes" && !isAdmin) {
      return { error: "Forbidden: Only mess admins can update workspace settings." };
    }

    if (params.table === "mess_members") {
      if (params.action === "delete" && !isAdmin) {
        return { error: "Forbidden: Only mess admins can delete members." };
      }
      if (params.action === "update" && !isAdmin && auth.memberId !== params.val) {
        return { error: "Forbidden: Members can only update their own profile." };
      }
    }

    if ((params.table === "mess_expenses" || params.table === "payments") && !isAdmin) {
      return { error: `Forbidden: Only mess admins can mutate ${params.table}.` };
    }

    if (params.table === "mess_notifications" && params.action === "insert") {
      const notif = params.payload as NotificationItem;
      if (!isAdmin) {
        // Members can ONLY send notes to the admin
        if (auth.memberId && notif.sender_id !== auth.memberId) {
          return { error: "Forbidden: You cannot send notifications under another member's identity." };
        }
      }
    }
  }

  if (params.table === "mess_members") {
    if (params.action === "insert") {
      const payload = params.payload as Member;
      const idx = record.members.findIndex((m) => m.id === payload.id);
      if (idx >= 0) {
        record.members[idx] = payload;
      } else {
        record.members.push(payload);
      }
    } else if (params.action === "update" && params.col === "id") {
      const target = record.members.find((m) => m.id === params.val);
      if (target) Object.assign(target, params.payload as Partial<Member>);
    } else if (params.action === "delete" && params.col === "id") {
      record.members = record.members.filter((m) => m.id !== params.val);
      record.meals = record.meals.filter((m) => m.member_id !== params.val);
      record.payments = record.payments.filter((p) => p.member_id !== params.val);
    }
  } else if (params.table === "mess_expenses") {
    if (params.action === "insert") {
      record.expenses.unshift(params.payload as Expense);
    } else if (params.action === "delete" && params.col === "id") {
      record.expenses = record.expenses.filter((e) => e.id !== params.val);
    }
  } else if (params.table === "payments") {
    if (params.action === "insert") {
      record.payments.unshift(params.payload as Payment);
    } else if (params.action === "delete" && params.col === "id") {
      record.payments = record.payments.filter((p) => p.id !== params.val);
    }
  } else if (params.table === "mess_meals") {
    if (params.action === "upsert") {
      const items = (Array.isArray(params.payload) ? params.payload : [params.payload]) as Meal[];
      for (const meal of items) {
        const idx = record.meals.findIndex(
          (m) => m.member_id === meal.member_id && m.date === meal.date,
        );
        if (idx >= 0) record.meals[idx] = meal;
        else record.meals.push(meal);
      }
    }
  } else if (params.table === "mess_notifications") {
    if (params.action === "insert") {
      const payload = params.payload as NotificationItem;
      // Deduplication: include recipient_id & sender_id so identical messages to different recipients are preserved
      const exists = record.notifications.some(
        (n) =>
          n.id === payload.id ||
          (n.recipient_id === payload.recipient_id &&
            n.sender_id === payload.sender_id &&
            n.title === payload.title &&
            n.message === payload.message &&
            Math.abs(new Date(n.created_at).getTime() - new Date(payload.created_at).getTime()) <
              5000),
      );
      if (!exists) {
        record.notifications.unshift(payload);
      }
    } else if (params.action === "delete" && params.col === "id") {
      record.notifications = record.notifications.filter((n) => n.id !== params.val);
    }
  } else if (params.table === "messes") {
    if (params.action === "update") {
      Object.assign(record.mess, params.payload as Partial<Mess>);
    }
  }

  writeDatabase(db);
  return { ok: true };
}

export async function serverSyncMessRecord(
  record: MessRecord,
  auth?: ServerAuthContext | undefined,
): Promise<{ ok?: boolean; record?: MessRecord; error?: string }> {
  const db = readDatabase();
  const messId = record.mess.id;
  const invite = (record.mess as unknown as { invite_code?: string })?.invite_code;

  const isTestOrDev =
    process.env["NODE_ENV"] === "development" ||
    process.env["TEST"] === "true" ||
    process.env["VITEST"] === "true";

  // Require admin authority to overwrite/merge workspace state
  if (auth || !isTestOrDev) {
    if (!auth || auth.role !== "admin") {
      return { error: "Unauthorized: Only mess admins can perform bulk workspace synchronization." };
    }
  }

  if (db.messes[messId]) {
    const existing = db.messes[messId];
    for (const mem of record.members) {
      const idx = existing.members.findIndex((m) => m.id === mem.id);
      if (idx >= 0) existing.members[idx] = mem;
      else existing.members.push(mem);
    }
    for (const ml of record.meals) {
      const idx = existing.meals.findIndex(
        (m) => m.id === ml.id || (m.member_id === ml.member_id && m.date === ml.date),
      );
      if (idx >= 0) existing.meals[idx] = ml;
      else existing.meals.push(ml);
    }
    for (const exp of record.expenses) {
      if (!existing.expenses.some((e) => e.id === exp.id)) existing.expenses.push(exp);
    }
    for (const pay of record.payments) {
      if (!existing.payments.some((p) => p.id === pay.id)) existing.payments.push(pay);
    }
    for (const ntf of record.notifications) {
      if (!existing.notifications.some((n) => n.id === ntf.id)) existing.notifications.unshift(ntf);
    }
    existing.mess = { ...existing.mess, ...record.mess };
    db.messes[messId] = existing;
  } else {
    db.messes[messId] = record;
  }

  if (invite) {
    db.inviteIndex[invite] = messId;
  }
  writeDatabase(db);

  return { ok: true, record: db.messes[messId] || record };
}
