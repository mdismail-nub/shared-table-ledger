import fs from "node:fs";
import path from "node:path";
import type { Member, Meal, Expense, Payment, Mess, Summary, NotificationItem } from "./data";
import type { MessRecord, AdminAccount } from "./mess-store";
import { publishMessToCloud, fetchMessFromCloudByCode, fetchMessFromCloudById } from "./cloud-sync";

interface ServerDatabase {
  messes: Record<string, MessRecord>;
  accounts: AdminAccount[];
  inviteIndex: Record<string, string>; // code -> messId
}

const DATA_DIR = path.resolve(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "mess_store.json");

function ensureDirectoryExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getInitialDatabase(): ServerDatabase {
  const defaultAdminId = "usr_demo_admin_1";
  const defaultMessId = "mess_demo_central_1";
  const demoCode = "123456";
  const currentM = new Date().toISOString().slice(0, 7);
  const todayDate = new Date().toISOString().slice(0, 10);

  const demoAccount: AdminAccount = {
    id: defaultAdminId,
    email: "admin@mess.com",
    passwordHash: "ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f", // password123
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
    {
      id: "mem_tanvir",
      user_id: null,
      role: "member",
      name: "Tanvir Hasan",
      phone: "01933-456789",
      room: "B-1",
      joined: todayDate,
      status: "active",
      tone: "peach",
    },
    {
      id: "mem_ayesha",
      user_id: null,
      role: "member",
      name: "Ayesha Khan",
      phone: "01822-345678",
      room: "B-2",
      joined: todayDate,
      status: "active",
      tone: "lime",
    },
  ];

  const demoMeals: Meal[] = [
    {
      id: "ml_1",
      member_id: "mem_admin",
      date: `${currentM}-02`,
      breakfast: 1,
      lunch: 1,
      dinner: 1,
    },
    {
      id: "ml_2",
      member_id: "mem_rahim",
      date: `${currentM}-02`,
      breakfast: 1,
      lunch: 1,
      dinner: 1,
    },
    {
      id: "ml_3",
      member_id: "mem_tanvir",
      date: `${currentM}-02`,
      breakfast: 0,
      lunch: 1,
      dinner: 1,
    },
    {
      id: "ml_4",
      member_id: "mem_ayesha",
      date: `${currentM}-02`,
      breakfast: 1,
      lunch: 0,
      dinner: 1,
    },
  ];

  const demoExpenses: Expense[] = [
    {
      id: "exp_1",
      date: `${currentM}-01`,
      type: "meal",
      category: "Rice",
      description: "25kg Miniket rice",
      amount: 1950,
      member_id: "mem_admin",
      method: "Cash",
      created_at: new Date().toISOString(),
    },
    {
      id: "exp_2",
      date: `${currentM}-02`,
      type: "meal",
      category: "Fish & meat",
      description: "Weekly fish and chicken bazar",
      amount: 2400,
      member_id: "mem_rahim",
      method: "Cash",
      created_at: new Date().toISOString(),
    },
    {
      id: "exp_3",
      date: `${currentM}-03`,
      type: "household",
      category: "Wi-Fi",
      description: "Monthly broadband internet",
      amount: 1200,
      member_id: "mem_admin",
      method: "bKash",
      created_at: new Date().toISOString(),
    },
  ];

  const demoPayments: Payment[] = [
    {
      id: "pay_1",
      date: `${currentM}-01`,
      member_id: "mem_admin",
      amount: 4000,
      method: "Cash",
      kind: "Deposit",
      reference: "Advance deposit",
      created_at: new Date().toISOString(),
    },
    {
      id: "pay_2",
      date: `${currentM}-01`,
      member_id: "mem_rahim",
      amount: 3500,
      method: "bKash",
      kind: "Deposit",
      reference: "Monthly deposit",
      created_at: new Date().toISOString(),
    },
    {
      id: "pay_3",
      date: `${currentM}-01`,
      member_id: "mem_tanvir",
      amount: 3500,
      method: "Nagad",
      kind: "Deposit",
      reference: "Monthly deposit",
      created_at: new Date().toISOString(),
    },
  ];

  const demoNotifs: NotificationItem[] = [
    {
      id: "ntf_1",
      mess_id: defaultMessId,
      sender_id: "mem_admin",
      recipient_id: null,
      title: "Welcome to Mess Manager!",
      message:
        "Welcome everyone! You can view meals, bazar records, and monthly balances here anytime.",
      type: "notice",
      created_at: new Date().toISOString(),
    },
    {
      id: "ntf_2",
      mess_id: defaultMessId,
      sender_id: "mem_admin",
      recipient_id: null,
      title: "Monthly Deposit Reminder",
      message:
        "Please submit your initial monthly deposits by the 5th of this month to ensure smooth bazar.",
      type: "reminder",
      created_at: new Date().toISOString(),
    },
  ];

  return {
    messes: {
      [defaultMessId]: {
        mess: { ...demoMess, invite_code: demoCode } as Mess & { invite_code: string },
        members: demoMembers,
        meals: demoMeals,
        expenses: demoExpenses,
        payments: demoPayments,
        notifications: demoNotifs,
      },
    },
    accounts: [demoAccount],
    inviteIndex: {
      [demoCode]: defaultMessId,
    },
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
  } catch (err) {
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
  const clean = code.trim();
  const db = readDatabase();
  let messId = db.inviteIndex[clean];
  if (!messId || !db.messes[messId]) {
    // Also scan all messes just in case
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
  return {
    id: record.mess.id,
    name: record.mess.name,
    manager: record.mess.manager,
    address: record.mess.address,
    currency: record.mess.currency,
    meal_categories: record.mess.meal_categories,
    household_categories: record.mess.household_categories,
    members: record.members.filter((m) => m.status !== "left"),
  };
}

export async function serverCreateMess(params: {
  name: string;
  address?: string;
  manager: string;
  start_day?: number;
  currency?: string;
  owner_id?: string;
}) {
  const db = readDatabase();
  const messId = `mess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const ownerId = params.owner_id || `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
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

  writeDatabase(db);
  void publishMessToCloud(newRecord).catch(() => {});

  return {
    id: messId,
    name: params.name.trim(),
    invite_code: inviteCode,
    owner_id: ownerId,
  };
}

export async function serverGetWorkspace(params: {
  code?: string | undefined;
  messId?: string | undefined;
  month: string;
  memberId?: string | undefined;
}) {
  const db = readDatabase();
  let messId = params.messId;
  if (!messId && params.code) {
    messId = db.inviteIndex[params.code.trim()];
  }
  if (!messId || !db.messes[messId]) {
    // Scan if needed
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

  if (!messId) return null;
  const record = db.messes[messId];
  if (!record) return null;

  const month = params.month;
  const [y, mo] = month.split("-").map(Number) as [number, number];
  const nextMo = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  const start = `${month}-01`;
  const end = `${nextMo}-01`;

  const meals = record.meals.filter((m) => m.date >= start && m.date < end);
  const expenses = record.expenses.filter((e) => e.date >= start && e.date < end);
  const payments = record.payments.filter((p) => p.date >= start && p.date < end);
  const summary = calculateSummary(
    month,
    record.meals,
    record.expenses,
    record.payments,
    record.members,
  );

  let notifications = record.notifications;
  // If accessed by a member session (via invite code or with memberId), filter out other members' private notices
  if (params.code || params.memberId) {
    const memId = params.memberId;
    notifications = record.notifications.filter((n) => {
      // Broadcast notice to everyone
      if (!n.recipient_id || n.recipient_id === "" || n.recipient_id === "all") return true;
      // Direct notice for this member
      if (memId && n.recipient_id === memId) return true;
      // Sent by this member to admin
      if (memId && n.sender_id === memId) return true;
      // Targeted to another member -> private
      return false;
    });
  }

  const seenIds = new Set<string>();
  const uniqueNotifications = notifications.filter((n) => {
    if (seenIds.has(n.id)) return false;
    seenIds.add(n.id);
    return true;
  });

  return {
    mess: record.mess,
    members: record.members,
    meals,
    expenses,
    payments,
    notifications: uniqueNotifications,
    summary,
  };
}

export function serverSaveRecord(params: {
  messId: string;
  table: string;
  action: "insert" | "update" | "upsert" | "delete";
  payload?: unknown;
  col?: string;
  val?: unknown;
}) {
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
      const exists = record.notifications.some(
        (n) =>
          n.id === payload.id ||
          (n.title === payload.title &&
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

  publishMessToCloud(record).catch(() => {});

  return { ok: true };
}

export async function serverSyncMessRecord(record: MessRecord) {
  const db = readDatabase();
  const messId = record.mess.id;
  const invite = (record.mess as unknown as { invite_code?: string })?.invite_code;

  if (db.messes[messId]) {
    const existing = db.messes[messId];
    // Merge members: add or update from record without deleting existing members on server
    for (const mem of record.members) {
      const idx = existing.members.findIndex((m) => m.id === mem.id);
      if (idx >= 0) {
        existing.members[idx] = mem;
      } else {
        existing.members.push(mem);
      }
    }
    // Merge meals
    for (const ml of record.meals) {
      const idx = existing.meals.findIndex(
        (m) => m.id === ml.id || (m.member_id === ml.member_id && m.date === ml.date),
      );
      if (idx >= 0) existing.meals[idx] = ml;
      else existing.meals.push(ml);
    }
    // Merge expenses
    for (const exp of record.expenses) {
      if (!existing.expenses.some((e) => e.id === exp.id)) {
        existing.expenses.push(exp);
      }
    }
    // Merge payments
    for (const pay of record.payments) {
      if (!existing.payments.some((p) => p.id === pay.id)) {
        existing.payments.push(pay);
      }
    }
    // Merge notifications
    for (const ntf of record.notifications) {
      if (!existing.notifications.some((n) => n.id === ntf.id)) {
        existing.notifications.unshift(ntf);
      }
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
  void publishMessToCloud(db.messes[messId] || record).catch(() => {});

  return { ok: true, record: db.messes[messId] || record };
}
