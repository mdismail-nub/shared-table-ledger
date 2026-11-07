import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Copy,
  Users,
  ShieldCheck,
  Loader2,
  Home,
  CheckCircle2,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pageMeta } from "@/lib/meta";
import { useMe, db, getMemberSession, setMemberSession, clearMemberSession } from "@/lib/data";
import {
  findMessByInviteCode,
  getAdminSession,
  setAdminSession,
  saveStoredMess,
  type AdminSession,
} from "@/lib/mess-store";
import { lookupMessByCodeFn, createMessFn } from "@/lib/mess.functions";
import welcome from "@/assets/onboard-welcome.png";
import admin from "@/assets/role-admin.png";
import member from "@/assets/role-member.png";
import logo from "@/assets/logo.png.asset.json";

export const Route = createFileRoute("/")({
  head: () =>
    pageMeta("Welcome", "Create your mess or join your housemates with a secure invitation."),
  component: Welcome,
});

interface MessLookupResult {
  id: string;
  name: string;
  manager?: string;
  address?: string;
  currency?: string;
  meal_categories?: string[];
  household_categories?: string[];
  members: Array<{ id: string; name: string }>;
}

function Welcome() {
  const me = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState<"welcome" | "roles" | "admin" | "member" | "done">("welcome");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [created, setCreated] = useState("");

  const [messInfo, setMessInfo] = useState<MessLookupResult | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [verifying, setVerifying] = useState(false);

  const verifyCode = useCallback(async (candidateCode: string) => {
    const clean = candidateCode.replace(/\D/g, "").slice(0, 6);
    if (clean.length !== 6) {
      setMessInfo(null);
      return;
    }
    setVerifying(true);
    try {
      // 1. Try server function (works across all browsers, incognito, and devices!)
      try {
        const sRes = await lookupMessByCodeFn({ data: { code: clean } });
        if (sRes) {
          const info: MessLookupResult = {
            id: sRes.id,
            name: sRes.name,
            manager: sRes.manager,
            address: sRes.address,
            currency: sRes.currency,
            meal_categories: sRes.meal_categories,
            household_categories: sRes.household_categories,
            members: sRes.members.map((m) => ({
              id: m.id,
              name: m.name,
              room: m.room,
              tone: m.tone,
              role: m.role,
              status: m.status,
            })),
          };
          setMessInfo(info);
          if (info.members && info.members.length > 0 && info.members[0]) {
            setSelectedMemberId(info.members[0].id);
          } else {
            setSelectedMemberId("");
          }
          toast.success(`Mess found: ${info.name}`);
          setVerifying(false);
          return;
        }
      } catch {
        // Fall back to local check
      }

      // 2. Check local mess store fallback
      const local = findMessByInviteCode(clean);
      if (local) {
        const info: MessLookupResult = {
          id: local.mess.id,
          name: local.mess.name,
          manager: local.mess.manager,
          address: local.mess.address,
          currency: local.mess.currency,
          meal_categories: local.mess.meal_categories,
          household_categories: local.mess.household_categories,
          members: local.members.map((m) => ({
            id: m.id,
            name: m.name,
            room: m.room,
            tone: m.tone,
            role: m.role,
            status: m.status,
          })),
        };
        setMessInfo(info);
        if (info.members && info.members.length > 0 && info.members[0]) {
          setSelectedMemberId(info.members[0].id);
        } else {
          setSelectedMemberId("");
        }
        toast.success(`Mess found: ${info.name}`);
        setVerifying(false);
        return;
      }

      // 3. Fallback to Supabase RPC
      try {
        const { data, error } = await db.rpc("get_mess_by_invite_code", {
          invite_code: clean,
        });
        if (!error && data) {
          const info = data as unknown as MessLookupResult;
          setMessInfo(info);
          if (info.members && info.members.length > 0 && info.members[0]) {
            setSelectedMemberId(info.members[0].id);
          } else {
            setSelectedMemberId("");
          }
          toast.success(`Mess found: ${info.name}`);
          setVerifying(false);
          return;
        }
      } catch {
        // Fall through
      }

      setMessInfo(null);
      toast.error("Invalid 6-digit invitation code. Please check with your mess admin.");
    } catch (err) {
      setMessInfo(null);
      toast.error(err instanceof Error ? err.message : "Failed to verify code.");
    } finally {
      setVerifying(false);
    }
  }, []);

  // Check URL query parameters on initial render for ?code=123456
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const codeParam = params.get("code");
      if (codeParam) {
        const cleaned = codeParam.replace(/\D/g, "").slice(0, 6);
        if (cleaned.length === 6) {
          sessionStorage.setItem("mm_pending_invite", cleaned);
          setCode(cleaned);
          setStep("member");
          verifyCode(cleaned);
        }
      }
    }
  }, [verifyCode]);

  useEffect(() => {
    const existingSession = getMemberSession();
    if (existingSession?.code) {
      navigate({ to: "/dashboard", replace: true });
      return;
    }

    const adminSession = getAdminSession();
    if (adminSession) {
      navigate({ to: "/dashboard", replace: true });
      return;
    }

    if ((me.data?.member && me.data.member.status !== "left") || me.data?.isGuestMember) {
      navigate({ to: "/dashboard", replace: true });
    } else if (me.data && !me.data.isGuestMember) {
      const pending = sessionStorage.getItem("mm_pending_invite");
      if (pending && pending.length === 6) {
        setCode(pending);
        setStep("member");
        verifyCode(pending);
      } else {
        setStep(sessionStorage.getItem("mm_role") === "admin" ? "admin" : "member");
      }
    }
  }, [me.data, navigate, verifyCode]);

  async function choose(role: "admin" | "member") {
    sessionStorage.setItem("mm_role", role);
    if (role === "admin") {
      const adminSession = getAdminSession();
      if (adminSession) {
        await navigate({ to: "/dashboard" });
      } else {
        clearMemberSession();
        await navigate({ to: "/auth" });
      }
    } else {
      // Member flow: NO sign-in required!
      setStep("member");
      if (code.length === 6 && !messInfo) {
        verifyCode(code);
      }
    }
  }

  function handleCodeChange(val: string) {
    const clean = val.replace(/\D/g, "").slice(0, 6);
    setCode(clean);
    if (clean.length === 6) {
      verifyCode(clean);
    } else {
      setMessInfo(null);
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const f = new FormData(e.currentTarget);
      if (step === "admin") {
        const name = String(f.get("name") ?? "").trim();
        const manager = String(f.get("manager") ?? "").trim();
        const address = String(f.get("address") ?? "").trim();

        if (name.length < 2 || name.length > 80)
          throw new Error("Mess name must be between 2 and 80 characters.");
        if (manager.length < 1 || manager.length > 80) throw new Error("Please enter your name.");

        const res = await createMessFn({
          data: {
            name,
            manager,
            address: address.slice(0, 200),
            currency: "BDT (৳)",
          },
        });

        // Set admin session
        const session: AdminSession = {
          userId: res.owner_id,
          email: `${manager.toLowerCase().replace(/\s+/g, "")}@mess.local`,
          name: manager,
          messId: res.id,
          token: `adm_${Date.now()}`,
          createdAt: new Date().toISOString(),
        };
        setAdminSession(session);

        const newMess = {
          id: res.id,
          owner_id: res.owner_id,
          name,
          address: address.slice(0, 200) || "Dhaka, Bangladesh",
          manager,
          start_day: 1,
          currency: "BDT (৳)",
          invite_code: res.invite_code,
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
          household_categories: [
            "Wi-Fi",
            "Electricity",
            "Gas",
            "Water",
            "Cleaning",
            "Other household",
          ],
        };
        const adminMember = {
          id: `mem_${res.owner_id.slice(0, 8)}`,
          user_id: res.owner_id,
          role: "admin" as const,
          name,
          phone: "",
          room: "A-1",
          joined: new Date().toISOString().slice(0, 10),
          status: "active" as const,
          tone: "primary" as const,
        };
        saveStoredMess(res.id, {
          mess: newMess,
          members: [adminMember],
          meals: [],
          expenses: [],
          payments: [],
          notifications: [
            {
              id: `ntf_${Date.now()}`,
              mess_id: res.id,
              sender_id: adminMember.id,
              recipient_id: null,
              title: "Mess Created Successfully 🎉",
              message: `Welcome to ${name}! Share your 6-digit invitation code (${res.invite_code}) with your housemates.`,
              type: "notice",
              created_at: new Date().toISOString(),
            },
          ],
        });

        setCreated(res.invite_code);
        setStep("done");
      } else {
        const cleanCode = code.replace(/\D/g, "").slice(0, 6);
        if (cleanCode.length !== 6)
          throw new Error("Please enter a valid 6-digit invitation code.");

        let currentMess = messInfo;
        if (!currentMess) {
          try {
            const sRes = await lookupMessByCodeFn({ data: { code: cleanCode } });
            if (sRes) {
              currentMess = {
                id: sRes.id,
                name: sRes.name,
                manager: sRes.manager,
                address: sRes.address,
                currency: sRes.currency,
                meal_categories: sRes.meal_categories,
                household_categories: sRes.household_categories,
                members: sRes.members.map((m) => ({ id: m.id, name: m.name })),
              };
            }
          } catch {
            // ignore
          }

          if (!currentMess) {
            const local = findMessByInviteCode(cleanCode);
            if (local) {
              currentMess = {
                id: local.mess.id,
                name: local.mess.name,
                manager: local.mess.manager,
                address: local.mess.address,
                currency: local.mess.currency,
                meal_categories: local.mess.meal_categories,
                household_categories: local.mess.household_categories,
                members: local.members.map((m) => ({ id: m.id, name: m.name })),
              };
            }
          }

          if (!currentMess) {
            throw new Error("Invalid 6-digit invitation code. Please check with your mess admin.");
          }
        }

        const selectedMember = currentMess.members?.find((m) => m.id === selectedMemberId);

        setMemberSession({
          code: cleanCode,
          messId: currentMess.id,
          messName: currentMess.name,
          memberId: selectedMember ? selectedMember.id : null,
          memberName: selectedMember ? selectedMember.name : "Guest Member",
        });

        // If user happens to be signed in to Supabase, also link their account
        if (me.data?.user && !me.data.isGuestMember) {
          try {
            await db.rpc("join_mess_by_code", { _code: cleanCode });
          } catch {
            // Ignore if join RPC fails for guest
          }
        }

        sessionStorage.removeItem("mm_pending_invite");
        await qc.invalidateQueries();
        toast.success(`Welcome to ${currentMess.name}!`);
        await navigate({ to: "/dashboard" });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-5 py-6 sm:px-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={logo.url} className="h-10 w-10 rounded-xl" alt="" />
          <span className="text-lg font-extrabold">Mess Manager</span>
        </div>
        <span className="text-xs text-muted-foreground">Better together.</span>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center py-8 text-center animate-rise">
        {step === "welcome" && (
          <>
            <img
              src={welcome}
              alt="Housemates sharing a meal"
              className="mb-5 aspect-[4/3] w-full max-w-md rounded-3xl object-contain"
            />
            <span className="rounded-full bg-lime px-3 py-1 text-xs font-bold">
              A little less accounting. A lot more living.
            </span>
            <h1 className="mt-5 text-4xl font-extrabold sm:text-5xl">Mess Manager</h1>
            <p className="mt-3 max-w-sm text-muted-foreground">
              Good meals, happy housemates,
              <br />
              and every taka accounted for.
            </p>
            <Button size="lg" className="mt-7 w-full max-w-xs" onClick={() => setStep("roles")}>
              Get started <ArrowRight />
            </Button>
            <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setStep("member")}
              >
                <Users className="h-4 w-4" />
                Join with 6-digit code
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => navigate({ to: "/auth" })}
              >
                <ShieldCheck className="h-4 w-4" />
                Admin sign in
              </Button>
            </div>
          </>
        )}

        {step === "roles" && (
          <>
            <p className="text-xs font-bold uppercase text-accent-foreground">
              Your place at the table
            </p>
            <h1 className="mt-3 text-3xl font-extrabold">How will you join?</h1>
            <div className="mt-8 grid w-full max-w-2xl gap-4 sm:grid-cols-2">
              {[
                {
                  role: "admin" as const,
                  title: "I’m an admin",
                  text: "Create a mess, manage meals, bills, and send notices to members.",
                  image: admin,
                  icon: ShieldCheck,
                },
                {
                  role: "member" as const,
                  title: "I’m a member",
                  text: "Enter your 6-digit code to view meals, expenses, and notices (No sign-in required).",
                  image: member,
                  icon: Users,
                },
              ].map((x) => (
                <div key={x.role} className="rounded-3xl border bg-card p-5 text-left">
                  <img
                    src={x.image}
                    alt=""
                    className="mx-auto aspect-[4/3] w-full max-w-56 object-contain"
                  />
                  <h2 className="mt-3 text-xl font-bold">{x.title}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{x.text}</p>
                  <Button
                    onClick={() => choose(x.role)}
                    variant={x.role === "admin" ? "default" : "lime"}
                    className="mt-5 w-full"
                  >
                    <x.icon />
                    {x.role === "admin" ? "Continue as Admin" : "Enter with Code"} <ArrowRight />
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="ghost" className="mt-6" onClick={() => setStep("welcome")}>
              <ArrowLeft />
              Back
            </Button>
          </>
        )}

        {(step === "admin" || step === "member") && (
          <form onSubmit={submit} className="w-full max-w-md text-left">
            <img
              src={step === "admin" ? admin : member}
              alt=""
              className="mx-auto h-40 object-contain"
            />
            <h1 className="mt-4 text-center text-3xl font-extrabold">
              {step === "admin" ? "Make it your mess" : "Enter Mess Invitation"}
            </h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {step === "admin"
                ? "A fresh start for your shared home."
                : "Enter the 6-digit invitation code given by your mess admin."}
            </p>

            <div className="mt-6 space-y-4">
              {step === "admin" ? (
                <>
                  <div>
                    <Label htmlFor="name">Mess name</Label>
                    <Input
                      id="name"
                      name="name"
                      required
                      minLength={2}
                      maxLength={80}
                      placeholder="e.g. Green House"
                      className="mt-2 h-12 bg-card"
                    />
                  </div>
                  <div>
                    <Label htmlFor="manager">Your name</Label>
                    <Input
                      id="manager"
                      name="manager"
                      required
                      minLength={1}
                      maxLength={80}
                      defaultValue={me.data?.user.name ?? ""}
                      placeholder="e.g. Rahim Khan"
                      className="mt-2 h-12 bg-card"
                    />
                  </div>
                  <div>
                    <Label htmlFor="address">Address (optional)</Label>
                    <Input
                      id="address"
                      name="address"
                      maxLength={200}
                      placeholder="e.g. Flat 4B, Dhanmondi, Dhaka"
                      className="mt-2 h-12 bg-card"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="invite-code">6-Digit Invitation Code</Label>
                      {verifying && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" /> Checking code…
                        </span>
                      )}
                    </div>
                    <Input
                      id="invite-code"
                      aria-label="Invitation code"
                      value={code}
                      onChange={(e) => handleCodeChange(e.target.value)}
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                      autoComplete="one-time-code"
                      placeholder="000000"
                      className="mt-2 h-16 bg-card text-center text-3xl font-bold tracking-[0.35em]"
                    />
                  </div>

                  {messInfo && (
                    <div className="rounded-2xl border border-primary/20 bg-primary-soft p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-xs font-semibold text-accent-foreground">Mess Found</p>
                          <h3 className="font-bold text-foreground text-base">{messInfo.name}</h3>
                          {messInfo.address && (
                            <p className="text-xs text-muted-foreground">{messInfo.address}</p>
                          )}
                        </div>
                      </div>

                      <div className="border-t pt-3">
                        <Label htmlFor="member-select" className="text-xs">
                          Who are you?
                        </Label>
                        <select
                          id="member-select"
                          value={selectedMemberId}
                          onChange={(e) => setSelectedMemberId(e.target.value)}
                          className="mt-1.5 h-10 w-full rounded-xl border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          {messInfo.members?.map((m) => (
                            <option key={m.id} value={m.id}>
                              👤 {m.name}
                            </option>
                          ))}
                          <option value="">👀 Visitor / Guest (Read-Only)</option>
                        </select>
                        <p className="mt-1.5 text-[11px] text-muted-foreground flex items-center gap-1">
                          <Eye className="h-3.5 w-3.5" />
                          Members and visitors have view-only access to records and notices.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <Button
              size="lg"
              disabled={busy || (step === "member" && code.length !== 6)}
              className="mt-6 w-full"
            >
              {busy || verifying ? <Loader2 className="animate-spin" /> : <ArrowRight />}
              {step === "admin"
                ? "Create mess"
                : messInfo
                  ? `Enter as ${
                      messInfo.members?.find((m) => m.id === selectedMemberId)?.name ?? "Viewer"
                    } (View Only)`
                  : "Verify & Join"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="mt-3 w-full"
              onClick={() => {
                setMessInfo(null);
                setStep("roles");
              }}
            >
              <ArrowLeft />
              Choose another role
            </Button>
          </form>
        )}

        {step === "done" && (
          <>
            <div className="grid h-20 w-20 place-items-center rounded-full bg-mint text-mint-foreground">
              <Check className="h-9 w-9" />
            </div>
            <h1 className="mt-6 text-3xl font-extrabold">Your table is ready!</h1>
            <p className="mt-3 text-muted-foreground">
              Share this 6-digit code with your housemates. They won't need to sign in with
              Google—they simply enter this code to view meals, expenses, and notices.
            </p>
            <p className="mt-6 text-4xl font-extrabold tracking-[0.2em]">{created}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={async () => {
                await navigator.clipboard.writeText(created);
                toast.success("Invite code copied");
              }}
            >
              <Copy />
              Copy invite code
            </Button>
            <Button
              className="mt-7"
              size="lg"
              onClick={async () => {
                await qc.invalidateQueries();
                navigate({ to: "/dashboard" });
              }}
            >
              Go to my dashboard <ArrowRight />
            </Button>
          </>
        )}
      </main>

      <footer className="text-center text-xs text-muted-foreground">
        Meals. Housemates. Peace of mind.
      </footer>
    </div>
  );
}
