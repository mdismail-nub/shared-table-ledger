import type { Tone } from "@/components/app/ui";
import type { Member, Meal, Expense, Payment, Mess, Summary, NotificationItem } from "./data";
import { MEMBER_SESSION_KEY } from "./data";
import { mealRate } from "./accounting";

export type AdminAccount = {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  messId: string;
  createdAt: string;
};

export type AdminSession = {
  userId: string;
  email: string;
  name: string;
  messId: string;
  token: string;
  inviteCode?: string | undefined;
  createdAt: string;
};

export type MessRecord = {
  mess: Mess;
  members: Member[];
  meals: Meal[];
  expenses: Expense[];
  payments: Payment[];
  notifications: NotificationItem[];
};

export const ADMIN_SESSION_KEY = "mm_admin_session";
export const ADMIN_ACCOUNTS_KEY = "mm_admin_accounts";
export const MESS_STORE_PREFIX = "mm_mess_store_";
export const MESS_INDEX_KEY = "mm_all_messes_index";

function safeGet(key: string): string | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function safeRemove(key: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export async function hashPassword(password: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    try {
      const msgBuffer = new TextEncoder().encode(password);
      const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      // fallback
    }
  }
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    hash = (hash << 5) - hash + password.charCodeAt(i);
    hash |= 0;
  }
  return "h_" + Math.abs(hash).toString(16);
}

function getStoredAccounts(): AdminAccount[] {
  const raw = safeGet(ADMIN_ACCOUNTS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveStoredAccounts(accounts: AdminAccount[]) {
  safeSet(ADMIN_ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function getAdminSession(): AdminSession | null {
  const raw = safeGet(ADMIN_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setAdminSession(session: AdminSession) {
  safeSet(ADMIN_SESSION_KEY, JSON.stringify(session));
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(MEMBER_SESSION_KEY);
      sessionStorage.removeItem(MEMBER_SESSION_KEY);
    } catch {
      // ignore
    }
  }
}

export function clearAdminSession() {
  safeRemove(ADMIN_SESSION_KEY);
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
    } catch {
      // ignore
    }
  }
}

export function getStoredMess(messId: string): MessRecord | null {
  const raw = safeGet(`${MESS_STORE_PREFIX}${messId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveStoredMess(messId: string, record: MessRecord) {
  safeSet(`${MESS_STORE_PREFIX}${messId}`, JSON.stringify(record));
  const rawIndex = safeGet(MESS_INDEX_KEY);
  let index: string[] = [];
  try {
    index = rawIndex ? JSON.parse(rawIndex) : [];
  } catch {
    index = [];
  }
  if (!index.includes(messId)) {
    index.push(messId);
    safeSet(MESS_INDEX_KEY, JSON.stringify(index));
  }

  // Also sync to server in background
  if (typeof window !== "undefined") {
    import("./mess.functions")
      .then(({ syncMessToServerFn }) => {
        syncMessToServerFn({ data: { record } }).catch(() => {});
      })
      .catch(() => {});
  }
}

function generateInviteCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonthStr() {
  return new Date().toISOString().slice(0, 7);
}

// Seed a default demo admin so fresh installs / previews have instant demo data
function ensureDefaultSeedData() {
  if (typeof window === "undefined") return;
  const accounts = getStoredAccounts();
  if (accounts.length > 0) return;

  const defaultAdminId = "usr_demo_admin_1";
  const defaultMessId = "mess_demo_central_1";
  const demoCode = "123456";

  const demoAccount: AdminAccount = {
    id: defaultAdminId,
    email: "admin@mess.com",
    // SHA-256 for "password123": ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f
    passwordHash: "ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f",
    name: "Mess Admin",
    messId: defaultMessId,
    createdAt: new Date().toISOString(),
  };

  const currentM = currentMonthStr();
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
      joined: todayDate(),
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
      joined: todayDate(),
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
      joined: todayDate(),
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
      joined: todayDate(),
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

  saveStoredAccounts([demoAccount]);
  saveStoredMess(defaultMessId, {
    mess: { ...demoMess, invite_code: demoCode } as Mess & { invite_code: string },
    members: demoMembers,
    meals: demoMeals,
    expenses: demoExpenses,
    payments: demoPayments,
    notifications: demoNotifs,
  });
}

// In development / test environments only, ensure test fixture baseline
if (
  typeof window !== "undefined" &&
  (process.env["NODE_ENV"] === "development" || process.env["TEST"] === "true")
) {
  ensureDefaultSeedData();
}

export async function signUpAdmin(params: {
  email: string;
  password: string;
  name: string;
  messName: string;
  currency?: string;
}): Promise<AdminSession> {
  const email = params.email.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Please enter a valid email address.");
  if (params.password.length < 6) throw new Error("Password must be at least 6 characters long.");
  if (!params.name.trim()) throw new Error("Please enter your name.");
  if (!params.messName.trim()) throw new Error("Please enter your mess name.");

  const accounts = getStoredAccounts();
  const existing = accounts.find((a) => a.email === email);
  if (existing) {
    throw new Error("An admin account with this email already exists. Please sign in instead.");
  }

  const passwordHash = await hashPassword(params.password);
  const userId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const messId = `mess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const inviteCode = generateInviteCode();

  const newAccount: AdminAccount = {
    id: userId,
    email,
    passwordHash,
    name: params.name.trim(),
    messId,
    createdAt: new Date().toISOString(),
  };

  const newMess: Mess & { invite_code: string } = {
    id: messId,
    owner_id: userId,
    name: params.messName.trim(),
    address: "Dhaka, Bangladesh",
    manager: params.name.trim(),
    start_day: 1,
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
    id: `mem_${userId.slice(0, 8)}`,
    user_id: userId,
    role: "admin",
    name: params.name.trim(),
    phone: "",
    room: "A-1",
    joined: todayDate(),
    status: "active",
    tone: "primary",
  };

  const initialNotif: NotificationItem = {
    id: `ntf_${Date.now()}`,
    mess_id: messId,
    sender_id: adminMember.id,
    recipient_id: null,
    title: "Mess Created Successfully 🎉",
    message: `Welcome to ${params.messName}! Share your 6-digit invitation code (${inviteCode}) with your housemates.`,
    type: "notice",
    created_at: new Date().toISOString(),
  };

  const newRecord: MessRecord = {
    mess: newMess,
    members: [adminMember],
    meals: [],
    expenses: [],
    payments: [],
    notifications: [initialNotif],
  };

  saveStoredMess(messId, newRecord);

  try {
    const { syncMessToServerFn } = await import("./mess.functions");
    await syncMessToServerFn({ data: { record: newRecord } });
  } catch (err) {
    console.warn("Failed to sync new mess to server:", err);
  }

  accounts.push(newAccount);
  saveStoredAccounts(accounts);

  const session: AdminSession = {
    userId,
    email,
    name: params.name.trim(),
    messId,
    token: `adm_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    inviteCode,
    createdAt: new Date().toISOString(),
  };

  setAdminSession(session);
  return session;
}

export async function signInAdmin(params: {
  email: string;
  password: string;
}): Promise<AdminSession> {
  const email = params.email.trim().toLowerCase();
  if (!email) throw new Error("Please enter your email.");
  if (!params.password) throw new Error("Please enter your password.");

  if (process.env["NODE_ENV"] === "development" || process.env["TEST"] === "true") {
    ensureDefaultSeedData();
  }
  const accounts = getStoredAccounts();
  const account = accounts.find((a) => a.email === email);
  if (!account) {
    throw new Error(
      "No account found with this email. Please check your credentials or create an account.",
    );
  }

  const hash = await hashPassword(params.password);
  if (hash !== account.passwordHash) {
    throw new Error("Incorrect password. Please try again.");
  }

  const existingRecord = getStoredMess(account.messId);
  if (existingRecord) {
    import("./mess.functions")
      .then(({ syncMessToServerFn }) => {
        syncMessToServerFn({ data: { record: existingRecord } }).catch(() => {});
      })
      .catch(() => {});
  }

  const inviteCode = (existingRecord?.mess as unknown as { invite_code?: string })?.invite_code;
  const session: AdminSession = {
    userId: account.id,
    email: account.email,
    name: account.name,
    messId: account.messId,
    token: `adm_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    inviteCode,
    createdAt: new Date().toISOString(),
  };

  setAdminSession(session);
  return session;
}

export function findMessByInviteCode(code: string): { mess: Mess; members: Member[] } | null {
  ensureDefaultSeedData();
  const cleanCode = code.trim();
  const rawIndex = safeGet(MESS_INDEX_KEY);
  let index: string[] = [];
  try {
    index = rawIndex ? JSON.parse(rawIndex) : [];
  } catch {
    index = [];
  }

  // Also check default demo mess
  if (!index.includes("mess_demo_central_1")) {
    index.push("mess_demo_central_1");
  }

  for (const messId of index) {
    const record = getStoredMess(messId);
    if (!record) continue;
    const invite =
      (record.mess as unknown as { invite_code?: string })?.invite_code ||
      ((record.mess as unknown as Record<string, unknown>)?.["invite_code"] as string);
    if (invite === cleanCode) {
      return {
        mess: record.mess,
        members: record.members.filter((m) => m.status !== "left"),
      };
    }
  }
  return null;
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

export function getMessDataById(messId: string, month: string) {
  ensureDefaultSeedData();
  const record = getStoredMess(messId);
  if (!record) return null;

  const [y, mo] = month.split("-").map(Number) as [number, number];
  const nextMo = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  const start = `${month}-01`;
  const end = `${nextMo}-01`;

  const monthMeals = record.meals.filter((m) => m.date >= start && m.date < end);
  const monthExpenses = record.expenses.filter((e) => e.date >= start && e.date < end);
  const monthPayments = record.payments.filter((p) => p.date >= start && p.date < end);
  const summary = calculateSummary(
    month,
    record.meals,
    record.expenses,
    record.payments,
    record.members,
  );

  return {
    mess: record.mess,
    members: record.members,
    meals: monthMeals,
    expenses: monthExpenses,
    payments: monthPayments,
    notifications: record.notifications,
    summary,
  };
}

export function getMessDataByCode(code: string, month: string, memberId?: string) {
  const found = findMessByInviteCode(code);
  if (!found) return null;
  const data = getMessDataById(found.mess.id, month);
  if (!data) return null;
  const filteredNotifs = (data.notifications || []).filter((n) => {
    if (!n.recipient_id || n.recipient_id === "" || n.recipient_id === "all") return true;
    if (memberId && n.recipient_id === memberId) return true;
    if (memberId && n.sender_id === memberId) return true;
    return false;
  });
  return {
    ...data,
    notifications: filteredNotifs,
  };
}

// ----------------- STORE MUTATION METHODS -----------------

export function addMemberToStore(messId: string, member: Partial<Member>): Member {
  const record = getStoredMess(messId);
  if (!record) throw new Error("Mess not found");

  const tones: Tone[] = ["primary", "mint", "peach", "lime", "cyan"];
  const newMember: Member = {
    id: member.id || `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    user_id: member.user_id ?? null,
    role: member.role || "member",
    name: member.name?.trim() || "Member",
    phone: member.phone?.trim() || "",
    room: member.room?.trim() || "",
    joined: member.joined || todayDate(),
    status: (member.status as "active" | "new" | "left") || "active",
    tone: (member.tone as Tone) || tones[Math.floor(Math.random() * tones.length)],
  };

  record.members.push(newMember);
  saveStoredMess(messId, record);
  return newMember;
}

export function updateMemberStatusInStore(
  messId: string,
  memberId: string,
  status: "active" | "new" | "left",
) {
  const record = getStoredMess(messId);
  if (!record) return;
  const target = record.members.find((m) => m.id === memberId);
  if (target) {
    target.status = status;
    saveStoredMess(messId, record);
  }
}

export function deleteMemberFromStore(messId: string, memberId: string) {
  const record = getStoredMess(messId);
  if (!record) return;
  const target = record.members.find((m) => m.id === memberId);
  if (target?.role === "admin") throw new Error("Cannot delete mess administrator.");
  record.members = record.members.filter((m) => m.id !== memberId);
  record.meals = record.meals.filter((m) => m.member_id !== memberId);
  record.payments = record.payments.filter((p) => p.member_id !== memberId);
  saveStoredMess(messId, record);
}

export function upsertMealInStore(messId: string, meal: Partial<Meal>): Meal {
  const record = getStoredMess(messId);
  if (!record) throw new Error("Mess not found");

  const existingIndex = record.meals.findIndex(
    (m) => m.member_id === meal.member_id && m.date === meal.date,
  );

  const updatedMeal: Meal = {
    id:
      meal.id ||
      (existingIndex >= 0 && record.meals[existingIndex]
        ? record.meals[existingIndex].id
        : `ml_${Date.now()}`),
    member_id: meal.member_id!,
    date: meal.date!,
    breakfast: Number(meal.breakfast ?? 0),
    lunch: Number(meal.lunch ?? 0),
    dinner: Number(meal.dinner ?? 0),
  };

  if (existingIndex >= 0) {
    record.meals[existingIndex] = updatedMeal;
  } else {
    record.meals.push(updatedMeal);
  }

  saveStoredMess(messId, record);
  return updatedMeal;
}

export function addExpenseToStore(messId: string, expense: Partial<Expense>): Expense {
  const record = getStoredMess(messId);
  if (!record) throw new Error("Mess not found");

  const newExpense: Expense = {
    id: expense.id || `exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    date: expense.date || todayDate(),
    type: expense.type || "meal",
    category: expense.category || "General",
    description: expense.description || "",
    amount: Number(expense.amount || 0),
    member_id: expense.member_id || null,
    method: expense.method || "Cash",
    created_at: expense.created_at || new Date().toISOString(),
  };

  record.expenses.unshift(newExpense);
  saveStoredMess(messId, record);
  return newExpense;
}

export function deleteExpenseFromStore(messId: string, expenseId: string) {
  const record = getStoredMess(messId);
  if (!record) return;
  record.expenses = record.expenses.filter((e) => e.id !== expenseId);
  saveStoredMess(messId, record);
}

export function addPaymentToStore(messId: string, payment: Partial<Payment>): Payment {
  const record = getStoredMess(messId);
  if (!record) throw new Error("Mess not found");

  const newPayment: Payment = {
    id: payment.id || `pay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    date: payment.date || todayDate(),
    member_id: payment.member_id!,
    amount: Number(payment.amount || 0),
    method: payment.method || "Cash",
    kind: payment.kind || "Deposit",
    reference: payment.reference || "",
    created_at: payment.created_at || new Date().toISOString(),
  };

  record.payments.unshift(newPayment);
  saveStoredMess(messId, record);
  return newPayment;
}

export function deletePaymentFromStore(messId: string, paymentId: string) {
  const record = getStoredMess(messId);
  if (!record) return;
  record.payments = record.payments.filter((p) => p.id !== paymentId);
  saveStoredMess(messId, record);
}

export function addNotificationToStore(
  messId: string,
  notif: Partial<NotificationItem>,
): NotificationItem {
  let record = getStoredMess(messId);
  if (!record) {
    const rawIndex = safeGet(MESS_INDEX_KEY);
    let index: string[] = [];
    try {
      index = rawIndex ? JSON.parse(rawIndex) : [];
    } catch {
      index = [];
    }
    for (const id of index) {
      const r = getStoredMess(id);
      const inv = (r?.mess as unknown as { invite_code?: string })?.invite_code;
      if (inv === messId || id === messId) {
        record = r;
        break;
      }
    }
  }

  const newNotif: NotificationItem = {
    id: notif.id || `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    mess_id: messId,
    sender_id: notif.sender_id ?? null,
    recipient_id: notif.recipient_id ?? null,
    title: notif.title || "Notice",
    message: notif.message || "",
    type: notif.type || "notice",
    created_at: notif.created_at || new Date().toISOString(),
  };

  if (record) {
    if (!record.notifications.some((n) => n.id === newNotif.id)) {
      record.notifications.unshift(newNotif);
      saveStoredMess(record.mess.id, record);
    }
  }

  return newNotif;
}

export function deleteNotificationFromStore(messId: string, notifId: string) {
  const record = getStoredMess(messId);
  if (!record) return;
  record.notifications = record.notifications.filter((n) => n.id !== notifId);
  saveStoredMess(messId, record);
}

export function updateMessSettingsInStore(messId: string, updates: Partial<Mess>): Mess {
  const record = getStoredMess(messId);
  if (!record) throw new Error("Mess not found");

  record.mess = {
    ...record.mess,
    ...updates,
  };

  saveStoredMess(messId, record);
  return record.mess;
}

export function regenerateInviteCodeInStore(messId: string): string {
  const record = getStoredMess(messId);
  if (!record) throw new Error("Mess not found");

  const newCode = generateInviteCode();
  (record.mess as unknown as { invite_code: string }).invite_code = newCode;
  saveStoredMess(messId, record);
  return newCode;
}
