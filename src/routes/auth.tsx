import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Mail, Lock, User, Home, ShieldCheck, Sparkles } from "lucide-react";
import logo from "@/assets/logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pageMeta } from "@/lib/meta";
import { signInAdmin, signUpAdmin, getAdminSession } from "@/lib/mess-store";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/auth")({
  head: () =>
    pageMeta("Admin Authentication", "Direct email authentication for mess administrators."),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [messName, setMessName] = useState("");
  const [currency, setCurrency] = useState("BDT (৳)");

  useEffect(() => {
    const session = getAdminSession();
    if (session) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const session = await signInAdmin({ email, password });
      await qc.invalidateQueries();
      toast.success(`Welcome back, ${session.name}!`);
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed. Please try again.");
      setBusy(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const session = await signUpAdmin({
        email,
        password,
        name,
        messName,
        currency,
      });
      await qc.invalidateQueries();
      toast.success(`Admin account created for ${session.name}!`);
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed. Please try again.");
      setBusy(false);
    }
  };

  const fillDemo = () => {
    setEmail("admin@mess.com");
    setPassword("password123");
    toast.info("Demo credentials filled: admin@mess.com / password123");
  };

  return (
    <div className="grid min-h-screen place-items-center px-4 py-8">
      <div className="glass w-full max-w-md rounded-3xl p-6 sm:p-8 animate-rise">
        <div className="flex items-center gap-3">
          <span className="h-12 w-12 overflow-hidden rounded-2xl bg-primary/10 flex items-center justify-center">
            <img
              src={logo.url}
              alt="Mess Manager logo"
              className="h-full w-full scale-[1.6] object-cover"
            />
          </span>
          <div>
            <p className="text-xl font-extrabold">Mess Manager</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Admin Portal & Management
            </p>
          </div>
        </div>

        <div className="mt-6 flex rounded-xl bg-muted/60 p-1">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
              mode === "signin"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
              mode === "signup"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Create Account
          </button>
        </div>

        {mode === "signin" ? (
          <form onSubmit={handleSignIn} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="signin-email" className="text-xs font-semibold">
                Email Address
              </Label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="signin-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@mess.com"
                  className="pl-10 h-11 rounded-xl"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="signin-password" className="text-xs font-semibold">
                  Password
                </Label>
              </div>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="signin-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 h-11 rounded-xl"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={busy}
              size="lg"
              className="mt-6 h-11 w-full rounded-xl text-sm font-semibold gap-2"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              {busy ? "Signing in…" : "Sign In as Admin"}
            </Button>

            <button
              type="button"
              onClick={fillDemo}
              className="mt-2 w-full py-1.5 text-xs text-primary font-medium flex items-center justify-center gap-1 hover:underline"
            >
              <Sparkles className="h-3 w-3" />
              Quick fill demo credentials (admin@mess.com)
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignUp} className="mt-6 space-y-3.5">
            <div>
              <Label htmlFor="signup-name" className="text-xs font-semibold">
                Your Full Name
              </Label>
              <div className="relative mt-1.5">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="signup-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Tanvir Hasan"
                  className="pl-10 h-11 rounded-xl"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="signup-email" className="text-xs font-semibold">
                Email Address
              </Label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="signup-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="pl-10 h-11 rounded-xl"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="signup-password" className="text-xs font-semibold">
                Create Password
              </Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="signup-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="pl-10 h-11 rounded-xl"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="signup-mess" className="text-xs font-semibold">
                Mess Name
              </Label>
              <div className="relative mt-1.5">
                <Home className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="signup-mess"
                  type="text"
                  required
                  value={messName}
                  onChange={(e) => setMessName(e.target.value)}
                  placeholder="e.g. Green Villa Mess"
                  className="pl-10 h-11 rounded-xl"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="signup-currency" className="text-xs font-semibold">
                Currency
              </Label>
              <select
                id="signup-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="mt-1.5 w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="BDT (৳)">BDT (৳)</option>
                <option value="INR (₹)">INR (₹)</option>
                <option value="USD ($)">USD ($)</option>
                <option value="EUR (€)">EUR (€)</option>
                <option value="GBP (£)">GBP (£)</option>
                <option value="SAR (﷼)">SAR (﷼)</option>
                <option value="AED (د.إ)">AED (د.إ)</option>
                <option value="MYR (RM)">MYR (RM)</option>
              </select>
            </div>

            <Button
              type="submit"
              disabled={busy}
              size="lg"
              className="mt-6 h-11 w-full rounded-xl text-sm font-semibold gap-2"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              {busy ? "Creating account…" : "Create Admin Account & Mess"}
            </Button>
          </form>
        )}

        <div className="mt-5 border-t pt-4">
          <Button asChild variant="ghost" className="w-full text-xs text-muted-foreground">
            <Link to="/">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Back to Welcome
            </Link>
          </Button>
        </div>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          Direct email authentication — no third-party OAuth required.
        </p>
      </div>
    </div>
  );
}
