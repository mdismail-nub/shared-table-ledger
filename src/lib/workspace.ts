import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { loadWorkspace } from "./workspace.functions";
import {
  currentMonth,
  useMonth,
  getMemberSession,
  db,
  type Mess,
  type Member,
  type Meal,
  type Expense,
  type Payment,
  type Summary,
  type NotificationItem,
} from "./data";
import { buildLedger, mealRate } from "./accounting";
import { supabase } from "@/integrations/supabase/client";
import { getAdminSession, getMessDataById, getMessDataByCode } from "./mess-store";
import { loadWorkspaceByCodeFn, loadWorkspaceByIdFn } from "./mess.functions";

export interface WorkspacePayload {
  mess: Mess;
  members: Member[];
  isAdmin: boolean;
  meals: Meal[];
  expenses: Expense[];
  payments: Payment[];
  summary: Summary;
  notifications: NotificationItem[];
  userId: string | null;
}

export const workspaceOptions = (month = currentMonth()) =>
  queryOptions<WorkspacePayload>({
    queryKey: ["workspace", month],
    queryFn: async (): Promise<WorkspacePayload> => {
      const memberSession = getMemberSession();
      if (memberSession?.code) {
        try {
          const sRes = await loadWorkspaceByCodeFn({
            data: { code: memberSession.code, month },
          });
          if (sRes) {
            return {
              mess: sRes.mess,
              members: (sRes.members ?? []) as Member[],
              isAdmin: false,
              meals: (sRes.meals ?? []) as Meal[],
              expenses: (sRes.expenses ?? []) as Expense[],
              payments: (sRes.payments ?? []) as Payment[],
              summary: sRes.summary,
              notifications: (sRes.notifications ?? []) as NotificationItem[],
              userId: memberSession.memberId,
            };
          }
        } catch {
          // ignore
        }

        const storeData = getMessDataByCode(memberSession.code, month);
        if (storeData) {
          return {
            mess: storeData.mess,
            members: storeData.members,
            isAdmin: false,
            meals: storeData.meals,
            expenses: storeData.expenses,
            payments: storeData.payments,
            summary: storeData.summary,
            notifications: storeData.notifications,
            userId: memberSession.memberId,
          };
        }

        try {
          const { data, error } = await db.rpc("get_workspace_by_invite_code", {
            invite_code: memberSession.code,
            p_month: month,
          });
          if (!error && data) {
            const res = data as unknown as WorkspacePayload;
            return {
              mess: res.mess,
              members: (res.members ?? []) as Member[],
              isAdmin: false,
              meals: (res.meals ?? []) as Meal[],
              expenses: (res.expenses ?? []) as Expense[],
              payments: (res.payments ?? []) as Payment[],
              summary: res.summary ?? {
                food: 0,
                household: 0,
                total_meals: 0,
                deposits: 0,
                active_members: 0,
              },
              notifications: (res.notifications ?? []) as NotificationItem[],
              userId: memberSession.memberId,
            };
          }
        } catch {
          // Fall through
        }
      }

      const adminSession = getAdminSession();
      if (adminSession) {
        try {
          const sRes = await loadWorkspaceByIdFn({
            data: { messId: adminSession.messId, month },
          });
          if (sRes) {
            return {
              mess: sRes.mess,
              members: (sRes.members ?? []) as Member[],
              isAdmin: true,
              meals: (sRes.meals ?? []) as Meal[],
              expenses: (sRes.expenses ?? []) as Expense[],
              payments: (sRes.payments ?? []) as Payment[],
              summary: sRes.summary,
              notifications: (sRes.notifications ?? []) as NotificationItem[],
              userId: adminSession.userId,
            };
          }
        } catch {
          // ignore
        }

        const storeData = getMessDataById(adminSession.messId, month);
        if (storeData) {
          return {
            mess: storeData.mess,
            members: storeData.members,
            isAdmin: true,
            meals: storeData.meals,
            expenses: storeData.expenses,
            payments: storeData.payments,
            summary: storeData.summary,
            notifications: storeData.notifications,
            userId: adminSession.userId,
          };
        }
      }

      return (await loadWorkspace({ data: { month } })) as unknown as WorkspacePayload;
    },
  });

export function useWorkspace() {
  const { month } = useMonth();
  const { data } = useSuspenseQuery(workspaceOptions(month));

  const summary = (data?.summary ?? {
    food: 0,
    household: 0,
    total_meals: 0,
    deposits: 0,
    active_members: 0,
  }) as Summary;

  const rate = mealRate(Number(summary?.food ?? 0), Number(summary?.total_meals ?? 0));
  const activeMembersCount = Number(summary?.active_members ?? 0);
  const shared = activeMembersCount > 0 ? Number(summary?.household ?? 0) / activeMembersCount : 0;
  const members = (data?.members ?? []) as Member[];
  const meals = (data?.meals ?? []) as Meal[];
  const payments = (data?.payments ?? []) as Payment[];
  const notifications = (data?.notifications ?? []) as NotificationItem[];
  const ledger = buildLedger(members, meals, payments, rate, shared);

  const own =
    ledger.find((m) =>
      data?.userId ? m.id === data.userId || m.user_id === data.userId : false,
    ) || ledger[0];

  return {
    ...data,
    month,
    summary,
    rate,
    shared,
    members,
    ledger,
    notifications,
    own,
  };
}
