import { createContext, useContext } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { buildLedger, mealRate } from "./accounting";
import type { Tone } from "@/components/app/ui";

export type Member = { id: string; user_id: string | null; name: string; phone: string; room: string; joined: string; status: "active" | "new" | "left"; tone: Tone };
export type Meal = { id: string; member_id: string; date: string; breakfast: number; lunch: number; dinner: number };
export type Expense = { id: string; date: string; type: "meal" | "household"; category: string; description: string; amount: number; member_id: string | null; method: string };
export type Deposit = { id: string; date: string; member_id: string; amount: number; method: string; kind: string; reference: string };
export type Settings = { id: number; name: string; manager: string; address: string; currency: string; invite_code: string; meal_categories: string[]; household_categories: string[] };
export type Summary = { food: number; household: number; total_meals: number; deposits: number; active_members: number };

/* ---------- month ---------- */
export const MonthContext = createContext<{ month: string; setMonth: (m: string) => void }>({ month: "", setMonth: () => {} });
export const useMonth = () => useContext(MonthContext);
export const currentMonth = () => new Date().toISOString().slice(0, 7);
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

const num = <T extends Record<string, unknown>>(rows: T[] | null, keys: (keyof T)[]) =>
  (rows ?? []).map((r) => { const o = { ...r }; keys.forEach((k) => ((o[k] as unknown) = Number(r[k] ?? 0))); return o; });

/* ---------- me ---------- */
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const [{ data: roles }, { data: member }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("members").select("*").eq("user_id", user.id).maybeSingle(),
      ]);
      const name = (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || user.email || "You";
      return {
        user: { id: user.id, email: user.email ?? "", name, avatar: (user.user_metadata?.avatar_url as string) || "" },
        isAdmin: !!roles?.some((r) => r.role === "admin"),
        member: (member as Member | null) ?? null,
      };
    },
  });
}
export const useIsAdmin = () => !!useMe().data?.isAdmin;

/* ---------- reads ---------- */
export function useMembers() {
  return useQuery({ queryKey: ["members"], queryFn: async () => {
    const { data, error } = await supabase.from("members").select("*").order("created_at");
    if (error) throw error; return data as Member[];
  } });
}
export function useMeals(month: string) {
  return useQuery({ queryKey: ["meals", month], enabled: !!month, queryFn: async () => {
    const { start, end } = monthRange(month);
    const { data, error } = await supabase.from("meals").select("*").gte("date", start).lt("date", end);
    if (error) throw error; return num(data, ["breakfast", "lunch", "dinner"]) as Meal[];
  } });
}
export function useExpenses(month: string, enabled = true) {
  return useQuery({ queryKey: ["expenses", month], enabled: !!month && enabled, queryFn: async () => {
    const { start, end } = monthRange(month);
    const { data, error } = await supabase.from("expenses").select("*").gte("date", start).lt("date", end).order("date", { ascending: false }).order("created_at", { ascending: false });
    if (error) throw error; return num(data, ["amount"]) as Expense[];
  } });
}
export function useDeposits(month: string) {
  return useQuery({ queryKey: ["deposits", month], enabled: !!month, queryFn: async () => {
    const { start, end } = monthRange(month);
    const { data, error } = await supabase.from("deposits").select("*").gte("date", start).lt("date", end).order("date", { ascending: false }).order("created_at", { ascending: false });
    if (error) throw error; return num(data, ["amount"]) as Deposit[];
  } });
}
export function useSummary(month: string) {
  return useQuery({ queryKey: ["summary", month], enabled: !!month, queryFn: async () => fetchSummary(month) });
}
async function fetchSummary(month: string) {
  const { start, end } = monthRange(month);
  const { data, error } = await supabase.rpc("month_summary", { _start: start, _end: end });
  if (error) throw error;
  const s = data as unknown as Summary;
  return { food: Number(s.food), household: Number(s.household), total_meals: Number(s.total_meals), deposits: Number(s.deposits), active_members: Number(s.active_members) };
}
export function useTrend(months: string[]) {
  return useQuery({ queryKey: ["trend", months.join()], queryFn: async () =>
    Promise.all(months.map(async (m) => ({ month: monthLabel(m, true), key: m, ...(await fetchSummary(m)) }))) });
}
export function useSettings() {
  return useQuery({ queryKey: ["settings"], queryFn: async () => {
    const { data, error } = await supabase.from("mess_settings").select("*").eq("id", 1).maybeSingle();
    if (error) throw error; return data as Settings | null;
  } });
}

/** Everything a page needs to show balances for the selected month. */
export function useMonthData() {
  const { month } = useMonth();
  const members = useMembers(), meals = useMeals(month), deposits = useDeposits(month), summary = useSummary(month);
  const loading = members.isLoading || meals.isLoading || deposits.isLoading || summary.isLoading;
  const s = summary.data ?? { food: 0, household: 0, total_meals: 0, deposits: 0, active_members: 0 };
  const rate = mealRate(s.food, s.total_meals);
  const sharedShare = s.active_members ? s.household / s.active_members : 0;
  const ledger = buildLedger(members.data ?? [], meals.data ?? [], deposits.data ?? [], rate, sharedShare);
  return { month, loading, members: members.data ?? [], meals: meals.data ?? [], deposits: deposits.data ?? [], summary: s, rate, sharedShare, ledger };
}

/* ---------- writes (admin only; RLS enforces) ---------- */
export function useSave<T>(fn: (v: T) => Promise<{ error: { message: string } | null }>, success: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: T) => { const { error } = await fn(v); if (error) throw new Error(error.message); },
    onSuccess: () => { toast.success(success); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });
}
export const db = supabase;
