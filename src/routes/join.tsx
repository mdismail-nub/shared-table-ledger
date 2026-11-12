import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Home,
  User,
  Users,
  Copy,
  Check,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Share2,
  CheckCircle2,
  Phone,
  DoorOpen,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pageMeta } from "@/lib/meta";
import { parseInviteFromUrl, createMessInviteLink, type InvitePayload } from "@/lib/invite";
import {
  getStoredMess,
  saveStoredMess,
  getAdminSession,
  findMessByInviteCode,
  type MessRecord,
} from "@/lib/mess-store";
import {
  getMemberSession,
  setMemberSession,
  type Member,
  type Mess,
  type Meal,
  type Expense,
  type Payment,
  type NotificationItem,
} from "@/lib/data";
import { APP_LOGO } from "@/lib/logo";

export const Route = createFileRoute("/join")({
  ssr: false,
  head: () =>
    pageMeta(
      "Join Mess",
      "Join your mess table ledger using your invitation link or 6-digit code.",
    ),
  component: JoinMessPage,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Unable to load invitation
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Please check your invitation code or link."}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  ),
});

function JoinMessPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [busy, setBusy] = useState(false);

  // Invite state from URL or manual code
  const [inviteData, setInviteData] = useState<InvitePayload | null>(() => {
    if (typeof window !== "undefined") {
      return parseInviteFromUrl(window.location.search);
    }
    return null;
  });
  const [manualInput, setManualInput] = useState("");

  // Reactive members list from server / cloud / storage / invite link
  const [membersList, setMembersList] = useState<Member[]>(() => {
    if (typeof window !== "undefined") {
      const parsed = parseInviteFromUrl(window.location.search);
      if (parsed?.id) {
        const stored = getStoredMess(parsed.id);
        if (stored?.members && stored.members.length > 0) {
          return stored.members;
        }
        if (parsed.members && parsed.members.length > 0) {
          return parsed.members as Member[];
        }
      }
    }
    return [];
  });

  // Join form state
  const [selectedMemberId, setSelectedMemberId] = useState<string>("new");
  const [memberName, setMemberName] = useState("");
  const [room, setRoom] = useState("");
  const [phone, setPhone] = useState("");

  // Admin state if admin visits their own link
  const adminSession = useMemo(() => getAdminSession(), []);

  // Compute active members
  const activeMembers = useMemo(() => {
    return membersList.filter((m) => m.status !== "left");
  }, [membersList]);

  const displayCount = useMemo(() => {
    if (activeMembers.length > 0) return activeMembers.length;
    if (typeof inviteData?.memberCount === "number" && inviteData.memberCount > 0) {
      return inviteData.memberCount;
    }
    return 0;
  }, [activeMembers.length, inviteData?.memberCount]);

  // Parse URL on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const parsed = parseInviteFromUrl(window.location.search);
    if (parsed) {
      setInviteData(parsed);

      // Check if we already have full record in storage
      const existing = getStoredMess(parsed.id);
      if (existing?.members && existing.members.length > 0) {
        setMembersList(existing.members);
      } else {
        // Initialize basic mess record in storage so member can load it
        const newMess: Mess & { invite_code: string } = {
          id: parsed.id,
          owner_id: `usr_${parsed.manager.toLowerCase().replace(/\s+/g, "")}`,
          name: parsed.name,
          address: "Dhaka, Bangladesh",
          manager: parsed.manager,
          start_day: 1,
          currency: parsed.currency || "BDT (৳)",
          invite_code: parsed.code,
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

        const initialMembers: Member[] =
          parsed.members && parsed.members.length > 0
            ? (parsed.members as Member[])
            : [
                {
                  id: `mem_admin_${parsed.id.slice(-6)}`,
                  user_id: newMess.owner_id,
                  role: "admin",
                  name: parsed.manager,
                  phone: "",
                  room: "A-1",
                  joined: new Date().toISOString().slice(0, 10),
                  status: "active",
                  tone: "primary",
                },
              ];

        const newRecord: MessRecord = {
          mess: newMess,
          members: initialMembers,
          meals: [],
          expenses: [],
          payments: [],
          notifications: [
            {
              id: `ntf_${Date.now()}`,
              mess_id: parsed.id,
              sender_id: initialMembers[0]?.id || `mem_admin_${parsed.id.slice(-6)}`,
              recipient_id: null,
              title: `Welcome to ${parsed.name}! 🎉`,
              message: `You've joined ${parsed.name} managed by ${parsed.manager}.`,
              type: "notice",
              created_at: new Date().toISOString(),
            },
          ],
        };

        saveStoredMess(parsed.id, newRecord);
        setMembersList(initialMembers);
      }

      // Try server function first to get latest members
      import("@/lib/mess.functions")
        .then(({ lookupMessByCodeFn }) => lookupMessByCodeFn({ data: { code: parsed.code } }))
        .then((sRes) => {
          if (sRes?.members && sRes.members.length > 0) {
            setMembersList(sRes.members as Member[]);
            const current = getStoredMess(parsed.id);
            if (current) {
              current.members = sRes.members as Member[];
              saveStoredMess(parsed.id, current);
            }
          }
        })
        .catch(() => {});
    } else {
      // Check if URL has ?code=XXXXXX
      const params = new URLSearchParams(window.location.search);
      const codeParam = params.get("code");
      if (codeParam && codeParam.length === 6) {
        setManualInput(codeParam);
        handleLookupCode(codeParam);
      }
    }
  }, []);

  // Look up code manually
  const handleLookupCode = (code: string) => {
    const clean = code.trim().replace(/\D/g, "").slice(0, 6);
    if (clean.length !== 6) return;

    // 1. Try server function
    import("@/lib/mess.functions")
      .then(({ lookupMessByCodeFn }) => lookupMessByCodeFn({ data: { code: clean } }))
      .then((sRes) => {
        if (sRes) {
          setInviteData({
            id: sRes.id,
            name: sRes.name,
            manager: sRes.manager,
            code: clean,
            currency: sRes.currency,
            memberCount: sRes.members?.filter((m) => m.status !== "left").length,
            timestamp: Date.now(),
          });
          if (sRes.members && sRes.members.length > 0) {
            setMembersList(sRes.members as Member[]);
          }
          toast.success(`Mess found: ${sRes.name}`);
          return;
        }
        throw new Error("Not found on server");
      })
      .catch(() => {
        // 2. Check local
        const local = findMessByInviteCode(clean);
        if (local) {
          setInviteData({
            id: local.mess.id,
            name: local.mess.name,
            manager: local.mess.manager,
            code: clean,
            currency: local.mess.currency,
            memberCount: local.members?.filter((m) => m.status !== "left").length,
            timestamp: Date.now(),
          });
          if (local.members && local.members.length > 0) {
            setMembersList(local.members);
          }
          toast.success(`Mess found: ${local.mess.name}`);
        } else {
          toast.error("Mess not found for this 6-digit code. Please check with your mess admin.");
        }
      });
  };

  // Full invite link for sharing
  const shareableUrl = useMemo(() => {
    if (!inviteData) return "";
    return createMessInviteLink({
      id: inviteData.id,
      name: inviteData.name,
      manager: inviteData.manager,
      code: inviteData.code,
      currency: inviteData.currency,
      memberCount: displayCount,
      members: membersList,
    });
  }, [inviteData, displayCount, membersList]);

  // Copy functions
  const copyInviteLink = async () => {
    if (!shareableUrl) return;
    try {
      await navigator.clipboard.writeText(shareableUrl);
      setCopiedLink(true);
      toast.success(
        "Invitation link copied! Share it with your housemates via WhatsApp, Messenger, or SMS.",
      );
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      toast.error("Could not copy link to clipboard.");
    }
  };

  const copyCode = async () => {
    if (!inviteData?.code) return;
    try {
      await navigator.clipboard.writeText(inviteData.code);
      setCopiedCode(true);
      toast.success("6-digit code copied!");
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      toast.error("Could not copy code.");
    }
  };

  const shareToWhatsApp = () => {
    if (!shareableUrl || !inviteData) return;
    const msg = encodeURIComponent(
      `Join our mess "${inviteData.name}" on Mess Manager:\n${shareableUrl}\n(Code: ${inviteData.code})`,
    );
    window.open(`https://api.whatsapp.com/send?text=${msg}`, "_blank");
  };

  // Submit Member Joining
  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteData) return;
    setBusy(true);

    try {
      // 1. Fetch latest record from server or cloud if not yet loaded locally
      let currentRecord = getStoredMess(inviteData.id);
      if (!currentRecord || currentRecord.members.length === 0) {
        try {
          const { loadWorkspaceByCodeFn } = await import("@/lib/mess.functions");
          const sRes = await loadWorkspaceByCodeFn({
            data: { code: inviteData.code, month: new Date().toISOString().slice(0, 7) },
          });
          if (sRes?.mess) {
            currentRecord = {
              mess: sRes.mess,
              members: (sRes.members ?? []) as Member[],
              meals: (sRes.meals ?? []) as Meal[],
              expenses: (sRes.expenses ?? []) as Expense[],
              payments: (sRes.payments ?? []) as Payment[],
              notifications: (sRes.notifications ?? []) as NotificationItem[],
            };
          }
        } catch {
          // ignore
        }
      }

      if (!currentRecord) {
        // Fallback baseline only if completely unreachable
        const newMess: Mess & { invite_code: string } = {
          id: inviteData.id,
          owner_id: `usr_${inviteData.manager.toLowerCase().replace(/\s+/g, "")}`,
          name: inviteData.name,
          address: "Dhaka, Bangladesh",
          manager: inviteData.manager,
          start_day: 1,
          currency: inviteData.currency || "BDT (৳)",
          invite_code: inviteData.code,
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
        const fallbackMembers: Member[] =
          membersList.length > 0
            ? [...membersList]
            : inviteData.members && inviteData.members.length > 0
              ? [...(inviteData.members as Member[])]
              : [];

        currentRecord = {
          mess: newMess,
          members: fallbackMembers,
          meals: [],
          expenses: [],
          payments: [],
          notifications: [],
        };
      }

      let memberIdToUse = "";
      let memberNameToUse = "";

      if (selectedMemberId !== "new") {
        // Linked to existing member
        const found = currentRecord.members.find((m) => m.id === selectedMemberId);
        if (found) {
          memberIdToUse = found.id;
          memberNameToUse = found.name;
        }
      }

      if (!memberIdToUse) {
        // Adding a new member
        const cleanName = memberName.trim();
        if (!cleanName) {
          throw new Error("Please enter your name to join.");
        }

        const newMemId = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const tonePalette = ["mint", "peach", "lime", "cyan"] as const;
        const assignedTone =
          tonePalette[currentRecord.members.length % tonePalette.length] || "mint";

        const newMem: Member = {
          id: newMemId,
          user_id: null,
          role: "member",
          name: cleanName,
          phone: phone.trim(),
          room: room.trim() || "Unassigned",
          joined: new Date().toISOString().slice(0, 10),
          status: "active",
          tone: assignedTone,
        };

        currentRecord.members.push(newMem);

        // Add notice to mess notifications
        currentRecord.notifications.unshift({
          id: `ntf_${Date.now()}`,
          mess_id: inviteData.id,
          sender_id: newMemId,
          recipient_id: null,
          title: "New Member Joined 🎉",
          message: `${cleanName} joined the mess.`,
          type: "notice",
          created_at: new Date().toISOString(),
        });

        memberIdToUse = newMemId;
        memberNameToUse = cleanName;
      }

      let guestToken: string | undefined;
      try {
        const { createGuestSessionFn } = await import("@/lib/mess.functions");
        const sessionRes = await createGuestSessionFn({
          data: { code: inviteData.code, memberId: memberIdToUse },
        });
        if (sessionRes?.token) {
          guestToken = sessionRes.token;
        }
      } catch {
        // non-fatal in offline mode
      }

      // Save member directly to server
      if (selectedMemberId === "new") {
        try {
          const { saveRecordFn } = await import("@/lib/mess.functions");
          const targetMem = currentRecord.members.find((m) => m.id === memberIdToUse);
          if (targetMem) {
            await saveRecordFn({
              data: {
                messId: inviteData.id,
                table: "mess_members",
                action: "insert",
                payload: targetMem,
                token: guestToken,
              },
            });
          }
        } catch {
          // ignore
        }
      }

      // Save updated record locally
      saveStoredMess(inviteData.id, currentRecord);

      // Set member session
      setMemberSession({
        code: inviteData.code,
        messId: inviteData.id,
        messName: inviteData.name,
        memberId: memberIdToUse,
        memberName: memberNameToUse,
        token: guestToken,
      });

      // Server sync
      try {
        const { syncMessToServerFn } = await import("@/lib/mess.functions");
        await syncMessToServerFn({ data: { record: currentRecord, token: guestToken } });
      } catch {
        // ignore
      }

      await qc.invalidateQueries();
      toast.success(`Welcome to ${inviteData.name}, ${memberNameToUse}! 🎉`);
      await navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to join mess. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // Admin Quick Add Member
  const handleAdminAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteData) return;
    const cleanName = memberName.trim();
    if (!cleanName) {
      toast.error("Please enter the member's name.");
      return;
    }

    const currentRecord = getStoredMess(inviteData.id);
    if (!currentRecord) return;

    const newMemId = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const tonePalette = ["mint", "peach", "lime", "cyan"] as const;
    const assignedTone = tonePalette[currentRecord.members.length % tonePalette.length] || "mint";

    const newMem: Member = {
      id: newMemId,
      user_id: null,
      role: "member",
      name: cleanName,
      phone: phone.trim(),
      room: room.trim() || "Unassigned",
      joined: new Date().toISOString().slice(0, 10),
      status: "active",
      tone: assignedTone,
    };

    currentRecord.members.push(newMem);
    saveStoredMess(inviteData.id, currentRecord);

    toast.success(`Added ${cleanName} to members!`);
    setMemberName("");
    setRoom("");
    setPhone("");
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-8 sm:px-6">
      <header className="mb-8 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img
            src={APP_LOGO}
            className="h-10 w-10 rounded-xl object-cover shadow-xs"
            alt="Mess Manager"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/logo.png";
            }}
          />
          <span className="text-xl font-black tracking-tight">Mess Manager</span>
        </Link>
        {adminSession ? (
          <Link to="/dashboard">
            <Button variant="outline" size="sm">
              Open Dashboard
            </Button>
          </Link>
        ) : (
          <Link to="/auth">
            <Button variant="ghost" size="sm">
              Admin Login
            </Button>
          </Link>
        )}
      </header>

      {inviteData ? (
        <div className="space-y-6">
          {/* Main Invitation Card */}
          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:rounded-3xl sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4 sm:pb-5">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-primary/10 text-primary shrink-0">
                  <Home className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-primary">
                    Mess Invitation
                  </span>
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-foreground truncate">
                    {inviteData.name}
                  </h1>
                </div>
              </div>
              <div className="rounded-xl bg-muted px-2.5 py-1 sm:px-3 sm:py-1.5 text-center shrink-0">
                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Invite Code
                </p>
                <p className="font-mono text-sm sm:text-base font-extrabold tracking-widest text-foreground">
                  {inviteData.code}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-y-2 gap-x-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <span>
                  Manager: <strong className="text-foreground">{inviteData.manager}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span>
                  Members: <strong className="text-foreground">{displayCount} active</strong>
                </span>
              </div>
            </div>

            {/* Admin Sharing Section */}
            {adminSession?.messId === inviteData.id ? (
              <div className="mt-6 space-y-6 border-t pt-6">
                <div className="rounded-2xl bg-primary/5 p-4 border border-primary/20">
                  <div className="flex items-center gap-2 text-primary">
                    <ShieldCheck className="h-5 w-5" />
                    <h2 className="font-bold">You are the Manager of this Mess</h2>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Share this invitation link with your housemates. Anyone who clicks the link can
                    join instantly without needing passwords or sign-in.
                  </p>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Input
                      readOnly
                      value={shareableUrl}
                      className="bg-background text-xs font-mono"
                    />
                    <Button onClick={copyInviteLink} className="shrink-0 gap-1.5">
                      {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copiedLink ? "Copied!" : "Copy Link"}
                    </Button>
                    <Button
                      onClick={shareToWhatsApp}
                      variant="outline"
                      className="shrink-0 gap-1.5 text-emerald-600 hover:text-emerald-700"
                    >
                      <Share2 className="h-4 w-4" />
                      WhatsApp
                    </Button>
                  </div>
                </div>

                {/* Quick Add Member Form for Admin */}
                <form
                  onSubmit={handleAdminAddMember}
                  className="rounded-2xl border p-4 bg-muted/30"
                >
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Plus className="h-4 w-4 text-primary" />
                    Quick Add Member
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    You can add housemates yourself here, or let them join via the link above.
                  </p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Member Name *</Label>
                      <Input
                        placeholder="e.g. Tanvir"
                        value={memberName}
                        onChange={(e) => setMemberName(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Room / Seat</Label>
                      <Input
                        placeholder="e.g. 204"
                        value={room}
                        onChange={(e) => setRoom(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Phone (optional)</Label>
                      <Input
                        placeholder="017..."
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="h-9"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <Button size="sm" type="submit">
                      Add Member
                    </Button>
                  </div>
                </form>

                <div className="flex justify-end pt-2">
                  <Link to="/dashboard">
                    <Button className="gap-2">
                      Go to Dashboard <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              /* Member Joining Form */
              <form onSubmit={handleJoinSubmit} className="mt-6 space-y-5 border-t pt-6">
                <div className="rounded-2xl bg-muted/40 p-3.5 text-xs text-muted-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary shrink-0" />
                  <span>
                    No email or password needed! Enter your name below to view meals, expenses, and
                    ledger.
                  </span>
                </div>

                {activeMembers.filter((m) => m.role !== "admin").length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">
                      Are you already listed as a member?
                    </Label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => setSelectedMemberId("new")}
                        className={`flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs font-semibold transition ${
                          selectedMemberId === "new"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:bg-muted"
                        }`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>I'm a new member</span>
                      </button>
                      {activeMembers
                        .filter((m) => m.role !== "admin")
                        .map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setSelectedMemberId(m.id);
                              setMemberName(m.name);
                            }}
                            className={`flex items-center justify-between rounded-xl border p-2.5 text-left text-xs font-semibold transition ${
                              selectedMemberId === m.id
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border hover:bg-muted"
                            }`}
                          >
                            <span className="truncate">{m.name}</span>
                            {m.room && (
                              <span className="text-[10px] text-muted-foreground">{m.room}</span>
                            )}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {selectedMemberId === "new" && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="mem_name" className="text-sm font-semibold">
                        Your Full Name *
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="mem_name"
                          required
                          value={memberName}
                          onChange={(e) => setMemberName(e.target.value)}
                          placeholder="e.g. Tanvir Hasan"
                          className="pl-9"
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="mem_room" className="text-xs text-muted-foreground">
                          Room / Seat (optional)
                        </Label>
                        <div className="relative">
                          <DoorOpen className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="mem_room"
                            value={room}
                            onChange={(e) => setRoom(e.target.value)}
                            placeholder="e.g. Room 204"
                            className="pl-9 text-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="mem_phone" className="text-xs text-muted-foreground">
                          Phone Number (optional)
                        </Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="mem_phone"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="e.g. 01712345678"
                            className="pl-9 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={busy || (selectedMemberId === "new" && !memberName.trim())}
                  className="w-full gap-2 py-6 text-base font-bold shadow-md"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  {busy ? "Joining Mess..." : "Join Mess & Open Dashboard"}
                </Button>

                <p className="text-center text-[11px] text-muted-foreground">
                  By joining, you will have instant read-only access to this mess's meal ledger,
                  expenses, and reports.
                </p>
              </form>
            )}
          </div>
        </div>
      ) : (
        /* Manual Code Lookup if opened without URL parameters */
        <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-3 border-b pb-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground">Join a Mess</h1>
              <p className="text-xs text-muted-foreground">
                Enter your 6-digit invitation code or open the link your admin sent you.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">6-Digit Invitation Code</Label>
              <div className="flex gap-2">
                <Input
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="e.g. 123456"
                  maxLength={6}
                  className="font-mono text-lg tracking-widest text-center"
                />
                <Button
                  onClick={() => handleLookupCode(manualInput)}
                  disabled={manualInput.trim().length !== 6}
                >
                  Find Mess
                </Button>
              </div>
            </div>

            <div className="rounded-2xl bg-muted/40 p-4 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground mb-1">Have an invitation link?</p>
              <p>
                Ask your mess manager to send you their direct invitation link (e.g. from WhatsApp
                or Messenger). When you open that link, your mess will open automatically!
              </p>
            </div>

            <div className="pt-4 text-center">
              <Link to="/">
                <Button variant="ghost" size="sm">
                  Back to Home
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
