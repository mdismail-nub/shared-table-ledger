import { createContext, useContext } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { buildLedger, mealRate } from "./accounting";
import type { Tone } from "@/components/app/ui";
import {
  getAdminSession,
  clearAdminSession,
  getMessDataById,
  getMessDataByCode,
  addMemberToStore,
  updateMemberStatusInStore,
  addExpenseToStore,
  deleteExpenseFromStore,
  addPaymentToStore,
  deletePaymentFromStore,
  upsertMealInStore,
  addNotificationToStore,
  deleteNotificationFromStore,
  updateMessSettingsInStore,
  regenerateInviteCodeInStore,
} from "./mess-store";

export type Member = {
  id: string;
  user_id: string | null;
  role: "admin" | "member";
  name: string;
  phone: string;
  room: string;
  joined: string;
  status: "active" | "new" | "left";
  tone: Tone;
};

export type Meal = {
  id: string;
  member_id: string;
  date: string;
  breakfast: number;
  lunch: number;
  dinner: number;
};

export type Expense = {
  id: string;
  date: string;
  type: "meal" | "household";
  category: string;
  description: string;
  amount: number;
  member_id: string | null;
  method: string;
  created_at: string;
};

export type Payment = {
  id: string;
  date: string;
  member_id: string;
  amount: number;
  method: string;
  kind: string;
  reference: string;
  created_at: string;
};

export type Mess = {
  id: string;
  owner_id: string;
  name: string;
  address: string;
  manager: string;
  start_day: number;
  currency: string;
  show_invite_to_members: boolean;
  meal_categories: string[];
  household_categories: string[];
};

export type Summary = {
  food: number;
  household: number;
  total_meals: number;
  deposits: number;
  active_members: number;
};

export type NotificationItem = {
  id: string;
  mess_id?: string;
  sender_id?: string | null;
  recipient_id?: string | null;
  title: string;
  message: string;
  type: "notice" | "reminder" | "alert" | "info";
  created_at: string;
};

export type MemberSession = {
  messId: string;
  code: string;
  memberId: string | null;
  memberName: string;
  messName?: string;
};

export const MEMBER_SESSION_KEY = "mm_member_session";

export function getMemberSession(): MemberSession | null {
  if (typeof window === "undefined") return null;
  const raw =
    localStorage.getItem(MEMBER_SESSION_KEY) || sessionStorage.getItem(MEMBER_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setMemberSession(session: MemberSession) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MEMBER_SESSION_KEY, JSON.stringify(session));
}

export function clearMemberSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(MEMBER_SESSION_KEY);
  sessionStorage.removeItem(MEMBER_SESSION_KEY);
}

export const MESS_COLUMNS =
  "id, owner_id, name, address, manager, start_day, currency, show_invite_to_members, meal_categories, household_categories";

/* ---------- month ---------- */
export const MonthContext = createContext<{ month: string; setMonth: (m: string) => void }>({
  month: currentMonth(),
  setMonth: () => {},
});
export const useMonth = () => useContext(MonthContext);
export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}
export const monthRange = (m: string) => {
  const [y, mo] = m.split("-").map(Number) as [number, number];
  const next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  return { start: `${m}-01`, end: `${next}-01` };
};
export const monthLabel = (m: string, short = false) =>
  new Date(`${m}-01T00:00:00`).toLocaleDateString("en-US", {
    month: short ? "short" : "long",
    year: short ? undefined : "numeric",
  });
export const recentMonths = (n = 12) => {
  const d = new Date();
  return Array.from({ length: n }, (_, i) => {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
  });
};
export const today = () => new Date().toISOString().slice(0, 10);

const num = <T extends Record<string, unknown>>(rows: T[] | null, keys: (keyof T)[]) =>
  (rows ?? []).map((r) => {
    const o = { ...r };
    keys.forEach((k) => ((o[k] as unknown) = Number(r[k] ?? 0)));
    return o;
  });

/* ---------- me ---------- */
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    staleTime: 60_000,
    queryFn: async () => {
      const memberSession = getMemberSession();
      if (memberSession?.code) {
        return {
          user: {
            id: memberSession.memberId ?? "guest",
            email: "",
            name: memberSession.memberName || "Housemate",
            avatar: "",
          },
          member: memberSession.memberId
            ? ({
                id: memberSession.memberId,
                name: memberSession.memberName,
                role: "member",
                status: "active",
              } as Member)
            : null,
          isAdmin: false,
          isGuestMember: true,
        };
      }

      const adminSession = getAdminSession();
      if (adminSession) {
        const data = getMessDataById(adminSession.messId, currentMonth());
        const adminMember = data?.members?.find(
          (m) => m.role === "admin" || m.user_id === adminSession.userId,
        ) || {
          id: adminSession.userId,
          name: adminSession.name,
          role: "admin",
          status: "active",
        };
        return {
          user: {
            id: adminSession.userId,
            email: adminSession.email,
            name: adminSession.name,
            avatar: "",
          },
          member: adminMember as Member,
          isAdmin: true,
          isGuestMember: false,
        };
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: member, error } = await supabase
        .from("mess_members")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      const { data: role } = await supabase
        .from("mess_user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      const name =
        (user.user_metadata?.["full_name"] as string) ||
        (user.user_metadata?.["name"] as string) ||
        user.email?.split("@")[0] ||
        "You";
      return {
        user: {
          id: user.id,
          email: user.email ?? "",
          name,
          avatar: (user.user_metadata?.["avatar_url"] as string) || "",
        },
        member: (member as Member | null) ?? null,
        isAdmin: role?.role === "admin",
        isGuestMember: false,
      };
    },
  });
}
export const useIsAdmin = () => !!useMe().data?.isAdmin;

/* ---------- reads (RLS scopes everything to the signed-in user's mess) ---------- */
export function useMess() {
  return useQuery({
    queryKey: ["mess"],
    queryFn: async () => {
      const adminSession = getAdminSession();
      if (adminSession) {
        const data = getMessDataById(adminSession.messId, currentMonth());
        if (data?.mess) return data.mess;
      }
      const memberSession = getMemberSession();
      if (memberSession?.code) {
        const data = getMessDataByCode(memberSession.code, currentMonth());
        if (data?.mess) return data.mess;
      }
      const { data, error } = await supabase.from("messes").select(MESS_COLUMNS).maybeSingle();
      if (error) throw error;
      return data as Mess | null;
    },
  });
}
export function useInviteCode() {
  return useQuery({
    queryKey: ["invite"],
    queryFn: async () => {
      const adminSession = getAdminSession();
      if (adminSession) {
        const data = getMessDataById(adminSession.messId, currentMonth());
        const code = (data?.mess as unknown as { invite_code?: string })?.invite_code;
        if (code) return code;
      }
      const { data, error } = await supabase.rpc("mess_invite_code");
      if (error) throw error;
      return (data as string | null) ?? null;
    },
  });
}
export function useMembers() {
  return useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const adminSession = getAdminSession();
      if (adminSession) {
        const data = getMessDataById(adminSession.messId, currentMonth());
        if (data?.members) return data.members;
      }
      const memberSession = getMemberSession();
      if (memberSession?.code) {
        const data = getMessDataByCode(memberSession.code, currentMonth());
        if (data?.members) return data.members;
      }
      const { data, error } = await supabase.from("mess_members").select("*").order("created_at");
      if (error) throw error;
      return data as Member[];
    },
  });
}
export function useMeals(month: string) {
  return useQuery({
    queryKey: ["meals", month],
    queryFn: async () => {
      const adminSession = getAdminSession();
      if (adminSession) {
        const data = getMessDataById(adminSession.messId, month);
        if (data?.meals) return data.meals;
      }
      const memberSession = getMemberSession();
      if (memberSession?.code) {
        const data = getMessDataByCode(memberSession.code, month);
        if (data?.meals) return data.meals;
      }
      const { start, end } = monthRange(month);
      const { data, error } = await supabase
        .from("mess_meals")
        .select("*")
        .gte("date", start)
        .lt("date", end)
        .order("date", { ascending: false });
      if (error) throw error;
      return num(data, ["breakfast", "lunch", "dinner"]) as Meal[];
    },
  });
}
export function useExpenses(month: string) {
  return useQuery({
    queryKey: ["expenses", month],
    queryFn: async () => {
      const adminSession = getAdminSession();
      if (adminSession) {
        const data = getMessDataById(adminSession.messId, month);
        if (data?.expenses) return data.expenses;
      }
      const memberSession = getMemberSession();
      if (memberSession?.code) {
        const data = getMessDataByCode(memberSession.code, month);
        if (data?.expenses) return data.expenses;
      }
      const { start, end } = monthRange(month);
      const { data, error } = await supabase
        .from("mess_expenses")
        .select("*")
        .gte("date", start)
        .lt("date", end)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return num(data, ["amount"]) as Expense[];
    },
  });
}
export function usePayments(month: string) {
  return useQuery({
    queryKey: ["payments", month],
    queryFn: async () => {
      const adminSession = getAdminSession();
      if (adminSession) {
        const data = getMessDataById(adminSession.messId, month);
        if (data?.payments) return data.payments;
      }
      const memberSession = getMemberSession();
      if (memberSession?.code) {
        const data = getMessDataByCode(memberSession.code, month);
        if (data?.payments) return data.payments;
      }
      const { start, end } = monthRange(month);
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .gte("date", start)
        .lt("date", end)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return num(data, ["amount"]) as Payment[];
    },
  });
}
async function fetchSummary(month: string): Promise<Summary> {
  const adminSession = getAdminSession();
  if (adminSession) {
    const data = getMessDataById(adminSession.messId, month);
    if (data?.summary) return data.summary;
  }
  const memberSession = getMemberSession();
  if (memberSession?.code) {
    const data = getMessDataByCode(memberSession.code, month);
    if (data?.summary) return data.summary;
  }
  const { start, end } = monthRange(month);
  const { data, error } = await supabase.rpc("mess_month_summary", { _start: start, _end: end });
  if (error) throw error;
  const s = data as unknown as Summary;
  return {
    food: Number(s.food),
    household: Number(s.household),
    total_meals: Number(s.total_meals),
    deposits: Number(s.deposits),
    active_members: Number(s.active_members),
  };
}
export function useSummary(month: string) {
  return useQuery({ queryKey: ["summary", month], queryFn: () => fetchSummary(month) });
}
export function useTrend(months: string[]) {
  return useQuery({
    queryKey: ["trend", months.join()],
    queryFn: async () =>
      Promise.all(
        months.map(async (m) => ({
          month: monthLabel(m, true),
          key: m,
          ...(await fetchSummary(m)),
        })),
      ),
  });
}

/** Everything a page needs to show balances for the selected month. */
export function useMonthData() {
  const { month } = useMonth();
  const members = useMembers(),
    meals = useMeals(month),
    payments = usePayments(month),
    expenses = useExpenses(month),
    summary = useSummary(month);
  const loading =
    members.isLoading ||
    meals.isLoading ||
    payments.isLoading ||
    summary.isLoading ||
    expenses.isLoading;
  const s = summary.data ?? {
    food: 0,
    household: 0,
    total_meals: 0,
    deposits: 0,
    active_members: 0,
  };
  const rate = mealRate(s.food, s.total_meals);
  const sharedShare = s.active_members ? s.household / s.active_members : 0;
  const ledger = buildLedger(
    members.data ?? [],
    meals.data ?? [],
    payments.data ?? [],
    rate,
    sharedShare,
  );
  return {
    month,
    loading,
    members: members.data ?? [],
    meals: meals.data ?? [],
    payments: payments.data ?? [],
    expenses: expenses.data ?? [],
    summary: s,
    rate,
    sharedShare,
    ledger,
  };
}

/* ---------- writes (admin only; the database enforces it) ---------- */
export function useSave<T>(
  fn: (v: T) => Promise<{ error: { message: string } | null }>,
  success: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: T) => {
      const { error } = await fn(v);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success(success);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyData = any;

const storeDb = {
  from: (table: string) => ({
    select: (_cols?: string) => {
      const selectBuilder = {
        order: (_col?: string, _opts?: { ascending?: boolean }) => ({
          gte: (_col2?: string, _val2?: unknown) => ({
            lt: async (_col3?: string, _val3?: unknown) => {
              const admin = getAdminSession();
              if (admin) {
                const data = getMessDataById(admin.messId, currentMonth());
                if (data) {
                  if (table === "mess_meals") return { data: data.meals, error: null };
                  if (table === "mess_expenses") return { data: data.expenses, error: null };
                  if (table === "payments") return { data: data.payments, error: null };
                }
              }
              return (supabase.from(table as AnyData) as AnyData)
                .select(_cols)
                .order(_col, _opts)
                .gte(_col2, _val2)
                .lt(_col3, _val3);
            },
          }),
          limit: async (n: number) => {
            const admin = getAdminSession();
            if (admin && table === "mess_notifications") {
              const data = getMessDataById(admin.messId, currentMonth());
              return { data: (data?.notifications ?? []).slice(0, n), error: null };
            }
            return (supabase.from(table as AnyData) as AnyData)
              .select(_cols)
              .order(_col, _opts)
              .limit(n);
          },
        }),
        eq: (_col: string, _val: unknown) => ({
          maybeSingle: async () => {
            const admin = getAdminSession();
            if (admin) {
              const data = getMessDataById(admin.messId, currentMonth());
              if (data && table === "messes") return { data: data.mess, error: null };
              if (data && table === "mess_members") {
                const m = data.members.find((x) => x.user_id === _val || x.id === _val);
                return { data: m || null, error: null };
              }
              if (table === "mess_user_roles") {
                return { data: { role: "admin" }, error: null };
              }
            }
            return (supabase.from(table as AnyData) as AnyData)
              .select(_cols)
              .eq(_col, _val)
              .maybeSingle();
          },
        }),
        maybeSingle: async () => {
          const admin = getAdminSession();
          if (admin && table === "messes") {
            const data = getMessDataById(admin.messId, currentMonth());
            return { data: data?.mess || null, error: null };
          }
          return (supabase.from(table as AnyData) as AnyData).select(_cols).maybeSingle();
        },
      };
      return selectBuilder;
    },

    insert: async (payload: AnyData) => {
      const admin = getAdminSession();
      if (admin) {
        if (table === "mess_members") {
          const added = addMemberToStore(admin.messId, payload);
          return { data: added, error: null };
        }
        if (table === "mess_expenses") {
          const added = addExpenseToStore(admin.messId, payload);
          return { data: added, error: null };
        }
        if (table === "payments") {
          const added = addPaymentToStore(admin.messId, payload);
          return { data: added, error: null };
        }
        if (table === "mess_notifications") {
          const added = addNotificationToStore(admin.messId, payload);
          return { data: added, error: null };
        }
      }
      return (supabase.from(table as AnyData) as AnyData).insert(payload);
    },

    upsert: async (payload: AnyData, _opts?: AnyData) => {
      const admin = getAdminSession();
      if (admin && table === "mess_meals") {
        const items = Array.isArray(payload) ? payload : [payload];
        const results = items.map((item) => upsertMealInStore(admin.messId, item));
        return { data: results, error: null };
      }
      return (supabase.from(table as AnyData) as AnyData).upsert(payload, _opts);
    },

    update: (payload: AnyData) => ({
      eq: async (col: string, val: AnyData) => {
        const admin = getAdminSession();
        if (admin) {
          if (table === "mess_members" && col === "id") {
            updateMemberStatusInStore(admin.messId, val, payload.status);
            return { data: null, error: null };
          }
          if (table === "messes") {
            const updated = updateMessSettingsInStore(admin.messId, payload);
            return { data: updated, error: null };
          }
        }
        return (supabase.from(table as AnyData) as AnyData).update(payload).eq(col, val);
      },
    }),

    delete: () => ({
      eq: async (col: string, val: AnyData) => {
        const admin = getAdminSession();
        if (admin && col === "id") {
          if (table === "mess_expenses") {
            deleteExpenseFromStore(admin.messId, val);
            return { data: null, error: null };
          }
          if (table === "payments") {
            deletePaymentFromStore(admin.messId, val);
            return { data: null, error: null };
          }
          if (table === "mess_notifications") {
            deleteNotificationFromStore(admin.messId, val);
            return { data: null, error: null };
          }
        }
        return (supabase.from(table as AnyData) as AnyData).delete().eq(col, val);
      },
    }),
  }),

  rpc: async (fn: string, args?: AnyData) => {
    const admin = getAdminSession();
    if (admin) {
      if (fn === "regenerate_invite_code") {
        const newCode = regenerateInviteCodeInStore(admin.messId);
        return { data: newCode, error: null };
      }
      if (fn === "mess_invite_code") {
        const data = getMessDataById(admin.messId, currentMonth());
        const code = (data?.mess as AnyData)?.invite_code;
        return { data: code || null, error: null };
      }
      if (fn === "mess_month_summary") {
        const data = getMessDataById(admin.messId, currentMonth());
        return { data: data?.summary || null, error: null };
      }
    }
    return (supabase.rpc as AnyData)(fn, args);
  },
};

export const db = storeDb as unknown as typeof supabase;

export async function signOut(qc: ReturnType<typeof useQueryClient>) {
  await qc.cancelQueries();
  qc.clear();
  clearMemberSession();
  clearAdminSession();
  try {
    await supabase.auth.signOut();
  } catch {
    // ignore
  }
}

export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};
export const pendingCodeKey = "mm_pending_invite";
