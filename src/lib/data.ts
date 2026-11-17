import { createContext, useContext } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { cppApi, isNetworkOrConnectionError } from "./api-client";
import { buildLedger, mealRate } from "./accounting";
import type { Tone } from "@/components/app/ui";
import {
  getAdminSession,
  clearAdminSession,
  ADMIN_SESSION_KEY,
  getMessDataById,
  getMessDataByCode,
  addMemberToStore,
  updateMemberStatusInStore,
  deleteMemberFromStore,
  addExpenseToStore,
  deleteExpenseFromStore,
  addPaymentToStore,
  deletePaymentFromStore,
  upsertMealInStore,
  addNotificationToStore,
  deleteNotificationFromStore,
  getStoredMess,
  ensureStoredMess,
  updateMessSettingsInStore,
  regenerateInviteCodeInStore,
} from "./mess-store";
import { enqueueSyncOperation, cancelPendingOperationsForEntity } from "./offline-db";
import { executePendingSync, registerBackgroundSync } from "./offline-sync";

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
  invite_code?: string | undefined;
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
  messName?: string | undefined;
  token?: string | undefined;
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
  const serialized = JSON.stringify(session);
  localStorage.setItem(MEMBER_SESSION_KEY, serialized);
  sessionStorage.setItem(MEMBER_SESSION_KEY, serialized);
  try {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
  } catch {
    // ignore
  }
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
export function formatLocalDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const today = () => formatLocalDate(new Date());

export const shortMonthYear = (m: string) => {
  const parts = m.split("-").map(Number);
  const y = parts[0] ?? new Date().getFullYear();
  const mo = parts[1] ?? 1;
  const d = new Date(y, mo - 1, 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};

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
      if (adminSession?.inviteCode) {
        return adminSession.inviteCode;
      }
      if (adminSession) {
        if (cppApi.isAvailable()) {
          try {
            const cppRes = await cppApi.settings.getInviteCode();
            if (cppRes.data?.code) {
              return cppRes.data.code;
            }
          } catch {
            // ignore
          }
        }
        const data = getMessDataById(adminSession.messId, currentMonth());
        const code = (data?.mess as unknown as { invite_code?: string })?.invite_code;
        if (code) return code;
      }
      const memberSession = getMemberSession();
      if (memberSession?.code) {
        return memberSession.code;
      }
      if (cppApi.isAvailable()) {
        try {
          const cppRes = await cppApi.settings.getInviteCode();
          if (cppRes.data?.code) {
            return cppRes.data.code;
          }
        } catch {
          // ignore
        }
      }
      return null;
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
        if (data?.members && data.members.length > 0) return data.members;
      }
      const memberSession = getMemberSession();
      if (memberSession?.code) {
        const data = getMessDataByCode(memberSession.code, currentMonth());
        if (data?.members && data.members.length > 0) return data.members;
      }
      if (cppApi.isAvailable()) {
        try {
          const cppRes = await cppApi.members.list();
          if (cppRes.data && !cppRes.error) return cppRes.data;
        } catch {
          // ignore
        }
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
      if (cppApi.isAvailable()) {
        try {
          const cppRes = await cppApi.meals.list(month);
          if (cppRes.data && !cppRes.error) return cppRes.data;
        } catch {
          // ignore
        }
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
      if (cppApi.isAvailable()) {
        try {
          const cppRes = await cppApi.expenses.list(month);
          if (cppRes.data && !cppRes.error) return cppRes.data;
        } catch {
          // ignore
        }
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
      if (cppApi.isAvailable()) {
        try {
          const cppRes = await cppApi.payments.list(month);
          if (cppRes.data && !cppRes.error) return cppRes.data;
        } catch {
          // ignore
        }
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
  if (cppApi.isAvailable()) {
    try {
      const cppRes = await cppApi.accounting.getSummary(month);
      if (cppRes.data && !cppRes.error) return cppRes.data;
    } catch {
      // ignore
    }
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
      const member = getMemberSession();
      const messId = payload?.mess_id || admin?.messId || member?.messId;

      // 1. Primary: C++ Drogon REST Backend (when available)
      if (cppApi.isAvailable()) {
        try {
          if (table === "mess_expenses") {
            const expenseData = {
              date: payload.date || today(),
              type: (payload.type as "meal" | "household") || "meal",
              category: payload.category || "General",
              description: payload.description || "",
              amount: Number(payload.amount || 0),
              member_id: payload.member_id || null,
              method: payload.method || "Cash",
            };
            const cppRes = await cppApi.expenses.add(expenseData);
            if (cppRes.error) {
              return { data: null, error: { message: cppRes.error } };
            }
            const added: Expense = {
              id: cppRes.data?.id || payload.id || `exp_${Date.now()}`,
              ...expenseData,
              created_at: payload.created_at || new Date().toISOString(),
            };
            if (messId) {
              try {
                addExpenseToStore(messId, added);
              } catch {
                // ignore
              }
            }
            return { data: added, error: null };
          }

          if (table === "payments") {
            const paymentData = {
              date: payload.date || today(),
              member_id: payload.member_id,
              amount: Number(payload.amount || 0),
              method: payload.method || "Cash",
              reference: payload.reference || "",
            };
            const cppRes = await cppApi.payments.record(paymentData);
            if (cppRes.error) {
              return { data: null, error: { message: cppRes.error } };
            }
            const added: Payment = {
              id: cppRes.data?.id || payload.id || `pay_${Date.now()}`,
              ...paymentData,
              kind: payload.kind || "Deposit",
              created_at: payload.created_at || new Date().toISOString(),
            };
            if (messId) {
              try {
                addPaymentToStore(messId, added);
              } catch {
                // ignore
              }
            }
            return { data: added, error: null };
          }

          if (table === "mess_members") {
            const memberData = {
              name: (payload.name || "").trim(),
              phone: (payload.phone || "").trim(),
              room: (payload.room || "").trim(),
            };
            const cppRes = await cppApi.members.add(memberData);
            if (cppRes.error) {
              return { data: null, error: { message: cppRes.error } };
            }
            const added: Member = {
              id: cppRes.data?.id || payload.id || `mem_${Date.now()}`,
              user_id: payload.user_id ?? null,
              role: payload.role || "member",
              ...memberData,
              joined: payload.joined || today(),
              status: (payload.status as "active" | "new" | "left") || "active",
              tone: payload.tone || "primary",
            };
            if (messId) {
              try {
                addMemberToStore(messId, added);
              } catch {
                // ignore
              }
            }
            return { data: added, error: null };
          }

          if (table === "mess_notifications") {
            const notifData = {
              title: payload.title || "Notice",
              message: payload.message || "",
              type: payload.type || "notice",
              recipient_id: payload.recipient_id ?? null,
            };
            const cppRes = await cppApi.notifications.send(notifData);
            if (cppRes.error) {
              return { data: null, error: { message: cppRes.error } };
            }
            const item: NotificationItem = {
              id: cppRes.data?.id || payload.id || `ntf_${Date.now()}`,
              mess_id: messId || "",
              sender_id: payload.sender_id ?? (admin ? admin.userId : member?.memberId) ?? null,
              ...notifData,
              created_at: payload.created_at || new Date().toISOString(),
            };
            if (messId) {
              try {
                addNotificationToStore(messId, item);
              } catch {
                // ignore
              }
            }
            return { data: item, error: null };
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : `Failed to save ${table}`;
          if (!isNetworkOrConnectionError(msg)) {
            return { data: null, error: { message: msg } };
          }
        }
      }

      // 2. Offline / Mock fallback path
      if (table === "mess_notifications") {
        const notifPayload = payload as Partial<NotificationItem>;
        if (messId) {
          const item: NotificationItem = {
            id: notifPayload.id || `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            mess_id: messId,
            sender_id: notifPayload.sender_id ?? (admin ? admin.userId : member?.memberId) ?? null,
            recipient_id: notifPayload.recipient_id ?? null,
            title: notifPayload.title || "Notice",
            message: notifPayload.message || "",
            type: notifPayload.type || "notice",
            created_at: notifPayload.created_at || new Date().toISOString(),
          };

          try {
            addNotificationToStore(messId, item);
          } catch {
            // ignore
          }

          let serverOk = false;
          try {
            const { saveRecordFn } = await import("./mess.functions");
            const sRes = await saveRecordFn({
              data: {
                messId,
                table: "mess_notifications",
                action: "insert",
                payload: item,
                token: admin?.token || member?.token,
              },
            });
            if (sRes && (sRes as { error?: string }).error) {
              return { data: null, error: { message: (sRes as { error: string }).error! } };
            }
            if (sRes && !(sRes as { error?: string }).error) {
              serverOk = true;
            }
          } catch (err) {
            const isOffline =
              (typeof navigator !== "undefined" && !navigator.onLine) ||
              (err instanceof Error &&
                (err.message.includes("Failed to fetch") ||
                  err.message.includes("NetworkError") ||
                  err.name === "TypeError"));

            if (!isOffline) {
              const message = err instanceof Error ? err.message : "Failed to send notification";
              return { data: null, error: { message } };
            }
          }

          if (!serverOk) {
            const uuid = `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
            await enqueueSyncOperation({
              uuid,
              messId,
              table: "mess_notifications",
              action: "insert",
              payload: item,
            });

            if (typeof navigator !== "undefined" && navigator.onLine) {
              executePendingSync(messId).catch(() => {});
            } else {
              registerBackgroundSync();
            }
          }

          return { data: item, error: null };
        }
      }

      if (admin && messId) {
        let added: AnyData = null;
        if (table === "mess_members") {
          added = addMemberToStore(messId, payload);
        } else if (table === "mess_expenses") {
          added = addExpenseToStore(messId, payload);
        } else if (table === "payments") {
          added = addPaymentToStore(messId, payload);
        }

        if (added) {
          let serverOk = false;
          try {
            const { saveRecordFn } = await import("./mess.functions");
            const sRes = await saveRecordFn({
              data: {
                messId,
                table,
                action: "insert",
                payload: added,
                token: admin.token,
              },
            });
            if (sRes && (sRes as { error?: string }).error) {
              return { data: null, error: { message: (sRes as { error: string }).error! } };
            }
            if (sRes && !(sRes as { error?: string }).error) {
              serverOk = true;
            }
          } catch (err) {
            const isOffline =
              (typeof navigator !== "undefined" && !navigator.onLine) ||
              (err instanceof Error &&
                (err.message.includes("Failed to fetch") ||
                  err.message.includes("NetworkError") ||
                  err.name === "TypeError"));

            if (!isOffline) {
              const message = err instanceof Error ? err.message : `Failed to save ${table}`;
              return { data: null, error: { message } };
            }
          }

          if (!serverOk) {
            const uuid = `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
            await enqueueSyncOperation({
              uuid,
              messId,
              table,
              action: "insert",
              payload: added,
            });

            if (typeof navigator !== "undefined" && navigator.onLine) {
              executePendingSync(messId).catch(() => {});
            } else {
              registerBackgroundSync();
            }
          }

          return { data: added, error: null };
        }
      }

      return (supabase.from(table as AnyData) as AnyData).insert(payload);
    },

    upsert: async (payload: AnyData, _opts?: AnyData) => {
      const admin = getAdminSession();
      const member = getMemberSession();
      const messId = admin?.messId || member?.messId;

      if (table === "mess_meals") {
        const rawItems = Array.isArray(payload) ? payload : [payload];
        const meals: Meal[] = rawItems.map((item) => ({
          id: item.id || `ml_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          member_id: item.member_id,
          date: item.date,
          breakfast: Number(item.breakfast ?? 0),
          lunch: Number(item.lunch ?? 0),
          dinner: Number(item.dinner ?? 0),
        }));

        if (cppApi.isAvailable()) {
          try {
            const cppRes = await cppApi.meals.upsertDaily(meals);
            if (cppRes.error) {
              return { data: null, error: { message: cppRes.error } };
            }
            if (messId) {
              try {
                for (const m of meals) {
                  upsertMealInStore(messId, m);
                }
              } catch {
                // ignore
              }
            }
            return { data: meals, error: null };
          } catch (err) {
            const msg = err instanceof Error ? err.message : "C++ meal update failed";
            if (!isNetworkOrConnectionError(msg)) {
              return { data: null, error: { message: msg } };
            }
          }
        }

        // Offline / fallback path
        if (messId) {
          const results = meals.map((item) => upsertMealInStore(messId, item));
          for (const item of results) {
            const uuid = `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
            await enqueueSyncOperation({
              uuid,
              messId,
              table: "mess_meals",
              action: "upsert",
              payload: item,
            });
          }
          if (typeof navigator !== "undefined" && navigator.onLine) {
            executePendingSync(messId).catch(() => {});
          } else {
            registerBackgroundSync();
          }
          return { data: results, error: null };
        }
      }
      return (supabase.from(table as AnyData) as AnyData).upsert(payload, _opts);
    },

    update: (payload: AnyData) => ({
      eq: async (col: string, val: AnyData) => {
        const admin = getAdminSession();
        const member = getMemberSession();
        const messId = admin?.messId || member?.messId;

        if (table === "mess_members" && col === "id") {
          if (cppApi.isAvailable()) {
            try {
              const cppRes = await cppApi.members.updateStatus(String(val), payload.status);
              if (cppRes.error) {
                return { data: null, error: { message: cppRes.error } };
              }
              if (messId) {
                try {
                  updateMemberStatusInStore(messId, String(val), payload.status);
                } catch {
                  // ignore
                }
              }
              return { data: null, error: null };
            } catch (err) {
              const msg = err instanceof Error ? err.message : "C++ status update failed";
              if (!isNetworkOrConnectionError(msg)) {
                return { data: null, error: { message: msg } };
              }
            }
          }

          if (messId) {
            updateMemberStatusInStore(messId, val, payload.status);
            const uuid = `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
            await enqueueSyncOperation({
              uuid,
              messId,
              table: "mess_members",
              action: "update",
              payload,
              col,
              val,
            });
            if (typeof navigator !== "undefined" && navigator.onLine) {
              executePendingSync(messId).catch(() => {});
            } else {
              registerBackgroundSync();
            }
            return { data: null, error: null };
          }
        }

        if (table === "messes") {
          if (cppApi.isAvailable()) {
            try {
              const cppRes = await cppApi.settings.update(payload);
              if (cppRes.error) {
                return { data: null, error: { message: cppRes.error } };
              }
              if (messId) {
                try {
                  updateMessSettingsInStore(messId, payload);
                } catch {
                  // ignore
                }
              }
              return { data: payload, error: null };
            } catch (err) {
              const msg = err instanceof Error ? err.message : "C++ settings update failed";
              if (!isNetworkOrConnectionError(msg)) {
                return { data: null, error: { message: msg } };
              }
            }
          }

          if (messId) {
            const updated = updateMessSettingsInStore(messId, payload);
            const uuid = `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
            await enqueueSyncOperation({
              uuid,
              messId,
              table: "messes",
              action: "update",
              payload,
            });
            if (typeof navigator !== "undefined" && navigator.onLine) {
              executePendingSync(messId).catch(() => {});
            } else {
              registerBackgroundSync();
            }
            return { data: updated, error: null };
          }
        }
        return (supabase.from(table as AnyData) as AnyData).update(payload).eq(col, val);
      },
    }),

    delete: () => ({
      eq: async (col: string, val: AnyData) => {
        const admin = getAdminSession();
        const member = getMemberSession();
        const messId = admin?.messId || member?.messId;

        if (col === "id") {
          // 1. Primary: C++ Drogon REST Backend (when available)
          if (cppApi.isAvailable()) {
            try {
              let cppRes: { data: unknown; error: string | null } = { data: null, error: null };
              if (table === "mess_members") {
                cppRes = await cppApi.members.delete(String(val));
              } else if (table === "mess_expenses") {
                cppRes = await cppApi.expenses.delete(String(val));
              } else if (table === "payments") {
                cppRes = await cppApi.payments.delete(String(val));
              } else if (table === "mess_notifications") {
                cppRes = await cppApi.notifications.delete(String(val));
              }
              if (cppRes.error) {
                return { data: null, error: { message: cppRes.error } };
              }
              if (messId) {
                try {
                  if (table === "mess_members") deleteMemberFromStore(messId, String(val));
                  else if (table === "mess_expenses") deleteExpenseFromStore(messId, String(val));
                  else if (table === "payments") deletePaymentFromStore(messId, String(val));
                  else if (table === "mess_notifications") deleteNotificationFromStore(messId, String(val));
                } catch {
                  // ignore
                }
              }
              return { data: null, error: null };
            } catch (err) {
              const msg = err instanceof Error ? err.message : "C++ delete failed";
              if (!isNetworkOrConnectionError(msg)) {
                return { data: null, error: { message: msg } };
              }
            }
          }

          // 2. Offline / Mock fallback path
          if (messId) {
            if (table === "mess_members") {
              deleteMemberFromStore(messId, val);
            } else if (table === "mess_expenses") {
              deleteExpenseFromStore(messId, val);
            } else if (table === "payments") {
              deletePaymentFromStore(messId, val);
            } else if (table === "mess_notifications") {
              deleteNotificationFromStore(messId, val);
            }

            const cancelled = await cancelPendingOperationsForEntity(table, val);
            if (cancelled > 0) {
              return { data: null, error: null };
            }

            let serverOk = false;
            try {
              const { saveRecordFn } = await import("./mess.functions");
              const sRes = await saveRecordFn({
                data: {
                  messId,
                  table,
                  action: "delete",
                  col: "id",
                  val,
                  token: admin?.token || member?.token,
                },
              });
              if (sRes && (sRes as { error?: string }).error) {
                return { data: null, error: { message: (sRes as { error: string }).error! } };
              }
              if (sRes && !(sRes as { error?: string }).error) {
                serverOk = true;
              }
            } catch (err) {
              const isOffline =
                (typeof navigator !== "undefined" && !navigator.onLine) ||
                (err instanceof Error &&
                  (err.message.includes("Failed to fetch") ||
                    err.message.includes("NetworkError") ||
                    err.name === "TypeError"));

              if (!isOffline) {
                const message = err instanceof Error ? err.message : `Failed to delete from ${table}`;
                return { data: null, error: { message } };
              }
            }

            if (!serverOk) {
              const uuid = `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
              await enqueueSyncOperation({
                uuid,
                messId,
                table,
                action: "delete",
                col: "id",
                val,
              });

              if (typeof navigator !== "undefined" && navigator.onLine) {
                executePendingSync(messId).catch(() => {});
              } else {
                registerBackgroundSync();
              }
            }

            return { data: null, error: null };
          }
        }

        return (supabase.from(table as AnyData) as AnyData).delete().eq(col, val);
      },
    }),
  }),

  rpc: async (fn: string, args?: AnyData) => {
    if (fn === "create_mess") {
      const { createMessFn } = await import("./mess.functions");
      const res = await createMessFn({
        data: {
          name: args?._name || "My Mess",
          manager: args?._manager || "Admin",
          address: args?._address || "",
          currency: args?._currency || "BDT (৳)",
        },
      });
      return { data: res, error: null };
    }
    if (fn === "get_mess_by_invite_code") {
      const { lookupMessByCodeFn } = await import("./mess.functions");
      const res = await lookupMessByCodeFn({
        data: { code: String(args?.invite_code || args?._code || "") },
      });
      return { data: res, error: null };
    }
    if (fn === "get_workspace_by_invite_code") {
      const { loadWorkspaceByCodeFn } = await import("./mess.functions");
      const res = await loadWorkspaceByCodeFn({
        data: {
          code: String(args?.invite_code || args?._code || ""),
          month: String(args?.p_month || currentMonth()),
        },
      });
      return { data: res, error: null };
    }
    if (fn === "join_mess_by_code") {
      const { lookupMessByCodeFn } = await import("./mess.functions");
      const res = await lookupMessByCodeFn({
        data: { code: String(args?._code || args?.invite_code || "") },
      });
      return { data: res?.id || null, error: null };
    }
    const admin = getAdminSession();
    if (admin) {
      if (fn === "regenerate_invite_code") {
        if (cppApi.isAvailable()) {
          try {
            const cppRes = await cppApi.settings.regenerateCode();
            if (cppRes.data?.code) {
              return { data: cppRes.data.code, error: null };
            }
          } catch {
            // ignore
          }
        }
        const newCode = regenerateInviteCodeInStore(admin.messId);
        return { data: newCode, error: null };
      }
      if (fn === "mess_invite_code") {
        if (admin.inviteCode) {
          return { data: admin.inviteCode, error: null };
        }
        if (cppApi.isAvailable()) {
          try {
            const cppRes = await cppApi.settings.getInviteCode();
            if (cppRes.data?.code) {
              return { data: cppRes.data.code, error: null };
            }
          } catch {
            // ignore
          }
        }
        const data = getMessDataById(admin.messId, currentMonth());
        const code = (data?.mess as AnyData)?.invite_code;
        return { data: code || null, error: null };
      }
      if (fn === "mess_month_summary") {
        const data = getMessDataById(admin.messId, currentMonth());
        return { data: data?.summary || null, error: null };
      }
    }
    if (fn === "mess_invite_code") {
      const member = getMemberSession();
      if (member?.code) {
        return { data: member.code, error: null };
      }
      return { data: null, error: null };
    }
    if (isSupabaseConfigured()) {
      return (supabase.rpc as AnyData)(fn, args);
    }
    return { data: null, error: null };
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
