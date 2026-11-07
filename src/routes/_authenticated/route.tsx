import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getMemberSession } from "@/lib/data";
import { getAdminSession } from "@/lib/mess-store";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // 1. Guest member session verified by 6-digit code
    const memberSession = getMemberSession();
    if (memberSession?.code) {
      return;
    }

    // 2. Direct email authenticated admin session
    const adminSession = getAdminSession();
    if (adminSession) {
      return;
    }

    // 3. Otherwise verify Supabase Auth (Admin)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw redirect({ to: "/" });

      const { data, error } = await supabase
        .from("mess_members")
        .select("id, status")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data || data.status === "left") throw redirect({ to: "/" });
    } catch (e) {
      if ((e as { isRedirect?: boolean })?.isRedirect) throw e;
      throw redirect({ to: "/" });
    }
  },
  component: Outlet,
});
