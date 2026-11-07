import { createContext, useContext } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { buildLedger, mealRate } from "./accounting";
import type { Tone } from "@/components/app/ui";

export type Member = { id: string; user_id: string | null; role: "admin" | "member"; name: string; phone: string; room: string; joined: string; status: "active" | "new" | "left"; tone: Tone };
export type Meal = { id: string; member_id: string; date: string; breakfast: number; lunch: number; dinner: number };
export type Expense = { id: string; date: string; type: "meal" | "household"; category: string; description: string; amount: number; member_id: string | null; method: string; created_at: string };
export type Payment = { id: string; date: string; member_id: string; amount: number; method: string; kind: string; reference: string; created_at: string };
export type Mess = { id: string; owner_id: string; name: string; address: string; manager: string; start_day: number; currency: string; show_invite_to_members: boolean; meal_categories: string[]; household_categories: string[] };
export type Summary = { food: number; household: number; total_meals: number; deposits: number; active_members: number };

export const MESS_COLUMNS = "id, owner_id, name, address, manager, start_day, currency, show_invite_to_members, meal_categories, household_categories";

/* ---------- month ---------- */
export const MonthContext = createContext<{ month: string; setMonth: (m: string) => void }>({ month: currentMonth(), setMonth: () => {} });
export const useMonth = () => useContext(MonthContext);
export function currentMonth() { return new Date().toISOString().slice(0, 7); }
export const monthRange = (m: string) => {
  const [y, mo] = m.split("-").map(Number) as [number, number];
  const next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  return { start: `${m}-01`, end: `${next}-01` };
};
export const monthLabel = (m: string, short = false) =>
  new Date(`${m}-01T00:00:00`).toLocaleDateString("en-US", { month: short ? "short" : "long", year: short ? undefined : "numeric" });
export const recentMonths = (n = 12) => {
  const d = new Date();
  return Array.from({ length: n }, (_, i) => {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
  });
};
export const today = () => new Date().toISOString().slice(0, 10);

const num = <T extends Record<string, unknown>>(rows: T[] | null, keys: (keyof T)[]) =>
  (rows ?? []).map((r) => { const o = { ...r }; keys.forEach((k) => ((o[k] as unknown) = Number(r[k] ?? 0))); return o; });

/* ---------- me ---------- */
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: member, error } = await supabase.from("mess_members").select("*").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      const { data: role } = await supabase.from("mess_user_roles").select("role").eq("user_id", user.id).maybeSingle();
      const name = (user.user_metadata?.["full_name"] as string) || (user.user_metadata?.["name"] as string) || user.email?.split("@")[0] || "You";
      return {
        user: { id: user.id, email: user.email ?? "", name, avatar: (user.user_metadata?.["avatar_url"] as string) || "" },
        member: (member as Member | null) ?? null,
        isAdmin: role?.role === "admin",
      };
    },
  });
}
export const useIsAdmin = () => !!useMe().data?.isAdmin;

/* ---------- reads (RLS scopes everything to the signed-in user's mess) ---------- */
export function useMess() {
  return useQuery({ queryKey: ["mess"], queryFn: async () => {
    const { data, error } = await supabase.from("messes").select(MESS_COLUMNS).maybeSingle();
    if (error) throw error; return data as Mess | null;
  } });
}
export function useInviteCode() {
  return useQuery({ queryKey: ["invite"], queryFn: async () => {
    const { data, error } = await supabase.rpc("mess_invite_code");
    if (error) throw error; return (data as string | null) ?? null;
  } });
}
export function useMembers() {
  return useQuery({ queryKey: ["members"], queryFn: async () => {
    const { data, error } = await supabase.from("mess_members").select("*").order("created_at");
    if (error) throw error; return data as Member[];
  } });
}
export function useMeals(month: string) {
  return useQuery({ queryKey: ["meals", month], queryFn: async () => {
    const { start, end } = monthRange(month);
    const { data, error } = await supabase.from("mess_meals").select("*").gte("date", start).lt("date", end).order("date", { ascending: false });
    if (error) throw error; return num(data, ["breakfast", "lunch", "dinner"]) as Meal[];
  } });
}
export function useExpenses(month: string) {
  return useQuery({ queryKey: ["expenses", month], queryFn: async () => {
    const { start, end } = monthRange(month);
    const { data, error } = await supabase.from("mess_expenses").select("*").gte("date", start).lt("date", end).order("date", { ascending: false }).order("created_at", { ascending: false });
    if (error) throw error; return num(data, ["amount"]) as Expense[];
  } });
}
export function usePayments(month: string) {
  return useQuery({ queryKey: ["payments", month], queryFn: async () => {
    const { start, end } = monthRange(month);
    const { data, error } = await supabase.from("payments").select("*").gte("date", start).lt("date", end).order("date", { ascending: false }).order("created_at", { ascending: false });
    if (error) throw error; return num(data, ["amount"]) as Payment[];
  } });
}
async function fetchSummary(month: string): Promise<Summary> {
  const { start, end } = monthRange(month);
  const { data, error } = await supabase.rpc("mess_month_summary", { _start: start, _end: end });
  if (error) throw error;
  const s = data as unknown as Summary;
  return { food: Number(s.food), household: Number(s.household), total_meals: Number(s.total_meals), deposits: Number(s.deposits), active_members: Number(s.active_members) };
}
export function useSummary(month: string) {
  return useQuery({ queryKey: ["summary", month], queryFn: () => fetchSummary(month) });
}
export function useTrend(months: string[]) {
  return useQuery({ queryKey: ["trend", months.join()], queryFn: async () =>
    Promise.all(months.map(async (m) => ({ month: monthLabel(m, true), key: m, ...(await fetchSummary(m)) }))) });
}

/** Everything a page needs to show balances for the selected month. */
export function useMonthData() {
  const { month } = useMonth();
  const members = useMembers(), meals = useMeals(month), payments = usePayments(month), expenses = useExpenses(month), summary = useSummary(month);
  const loading = members.isLoading || meals.isLoading || payments.isLoading || summary.isLoading || expenses.isLoading;
  const s = summary.data ?? { food: 0, household: 0, total_meals: 0, deposits: 0, active_members: 0 };
  const rate = mealRate(s.food, s.total_meals);
  const sharedShare = s.active_members ? s.household / s.active_members : 0;
  const ledger = buildLedger(members.data ?? [], meals.data ?? [], payments.data ?? [], rate, sharedShare);
  return { month, loading, members: members.data ?? [], meals: meals.data ?? [], payments: payments.data ?? [], expenses: expenses.data ?? [], summary: s, rate, sharedShare, ledger };
}

/* ---------- writes (admin only; the database enforces it) ---------- */
export function useSave<T>(fn: (v: T) => Promise<{ error: { message: string } | null }>, success: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: T) => { const { error } = await fn(v); if (error) throw new Error(error.message); },
    onSuccess: () => { toast.success(success); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });
}
export const db = supabase;

export async function signOut(qc: ReturnType<typeof useQueryClient>) {
  await qc.cancelQueries();
  qc.clear();
  await supabase.auth.signOut();
}

export const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };
export const pendingCodeKey = "mm_pending_invite";
