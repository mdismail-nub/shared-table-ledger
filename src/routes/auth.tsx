import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Eye, Loader2 } from "lucide-react";
import logo from "@/assets/logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/auth")({
  head: () => pageMeta("Sign in", "Sign in to Mess Manager to see meals, deposits and your monthly balance."),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) navigate({ to: "/", replace: true }); });
  }, [navigate]);

  const signIn = async () => {
    setBusy(true);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) { toast.error("Sign-in failed. Please try again."); setBusy(false); return; }
    if (r.redirected) return;
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="glass w-full max-w-md rounded-3xl p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="h-12 w-12 overflow-hidden rounded-2xl"><img src={logo.url} alt="" className="h-full w-full scale-[1.6] object-cover" /></span>
          <div><p className="text-xl font-extrabold">Mess Manager</p><p className="text-sm text-muted-foreground">Meals, bazar & balances in one place</p></div>
        </div>
        <h1 className="mt-8 text-3xl font-extrabold leading-tight">Welcome back 👋</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in with your Google account to continue.</p>
        <Button onClick={signIn} disabled={busy} size="lg" className="mt-6 h-12 w-full rounded-xl text-base">
          {busy ? <Loader2 className="animate-spin" /> : <GoogleIcon />} Continue with Google
        </Button>
        <div className="mt-6 grid gap-2 text-sm">
          <div className="flex gap-3 rounded-2xl bg-primary-soft p-3"><ShieldCheck className="h-5 w-5 shrink-0 text-primary" /><p><b>Manager</b> — the first person to sign in manages the mess.</p></div>
          <div className="flex gap-3 rounded-2xl bg-mint p-3 text-mint-foreground"><Eye className="h-5 w-5 shrink-0" /><p><b>Members</b> — sign in, enter the invite code from your manager, and see your own meals and balance.</p></div>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden><path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.63 4.1-5.35 4.1a5.9 5.9 0 0 1 0-11.8c1.84 0 3.07.78 3.77 1.45l2.57-2.47C16.73 3.85 14.6 2.9 12 2.9a9.1 9.1 0 1 0 0 18.2c5.25 0 8.73-3.69 8.73-8.88 0-.6-.07-1.05-.15-1.5Z" /></svg>
  );
}
