import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bell,
  BellRing,
  Send,
  Trash2,
  Megaphone,
  AlertTriangle,
  Info,
  Clock,
  Loader2,
  Users,
  User,
  MessageSquare,
  Reply,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "@/components/ui/sheet";
import { useWorkspace } from "@/lib/workspace";
import { db, useSave, today, formatLocalDate, type NotificationItem } from "@/lib/data";

export function SendNotificationDialog({
  trigger,
  defaultRecipientId,
  defaultTitle,
  onSent,
}: {
  trigger?: React.ReactNode;
  defaultRecipientId?: string | undefined;
  defaultTitle?: string | undefined;
  onSent?: (() => void) | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState<string>(defaultRecipientId ?? "");
  const [type, setType] = useState<"notice" | "reminder" | "alert" | "info">("notice");
  const w = useWorkspace();

  const save = useSave(async (f: FormData) => {
    const title = String(f.get("title") ?? "").trim();
    const message = String(f.get("message") ?? "").trim();

    if (!title) throw new Error("Please enter a title for the notification.");
    if (!message) throw new Error("Please enter a message.");
    if (!w.mess?.id) throw new Error("Mess not found.");

    const recipientId = recipient === "" ? null : recipient;

    const { error: insertError } = await db.from("mess_notifications").insert({
      mess_id: w.mess.id,
      sender_id: w.own?.id ?? null,
      recipient_id: recipientId,
      title,
      message,
      type,
    });
    if (insertError) throw new Error(insertError.message);

    return { error: null };
  }, "Notification sent successfully!");

  if (!w.isAdmin) return null;

  const eligibleMembers = w.members.filter((m) => m.status !== "left");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button variant="outline" size="sm" className="gap-2 font-semibold">
            <Megaphone className="h-4 w-4" />
            Send Notice
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-md max-h-[90dvh] overflow-y-auto p-4 sm:p-6 rounded-2xl sm:rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Megaphone className="h-5 w-5 text-primary" />
            {defaultRecipientId ? "Reply to Housemate" : "Send Mess Notification"}
          </DialogTitle>
          <DialogDescription>
            {defaultRecipientId
              ? "Send a private reply directly to this member."
              : "Broadcast an announcement to all members or send a private notice to a specific housemate."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await save.mutateAsync(new FormData(e.currentTarget));
              setOpen(false);
              onSent?.();
            } catch {
              // Toast displays error
            }
          }}
          className="mt-2 space-y-4"
        >
          <div>
            <Label htmlFor="recipient">Send To</Label>
            <select
              id="recipient"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="mt-2 h-11 w-full rounded-xl border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">📢 All Housemates (Broadcast)</option>
              {eligibleMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  👤 {m.name} {m.room ? `(Room ${m.room})` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {recipient === ""
                ? "Every member in the mess will see this notice."
                : "Only the selected member will see this notice. Other housemates cannot see it."}
            </p>
          </div>

          <div>
            <Label htmlFor="notif-type">Notification Type</Label>
            <select
              id="notif-type"
              value={type}
              onChange={(e) => setType(e.target.value as "notice" | "reminder" | "alert" | "info")}
              className="mt-2 h-11 w-full rounded-xl border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="notice">📢 General Notice</option>
              <option value="reminder">⏰ Payment / Bazar Reminder</option>
              <option value="alert">⚠️ Urgent Alert</option>
              <option value="info">ℹ️ Information</option>
            </select>
          </div>

          <div>
            <Label htmlFor="title">Notice Title</Label>
            <Input
              id="title"
              name="title"
              required
              defaultValue={defaultTitle ?? ""}
              maxLength={120}
              placeholder="e.g. WiFi Bill Due / Dinner Time Today"
              className="mt-2 h-11 bg-card"
            />
          </div>

          <div>
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              name="message"
              required
              rows={4}
              maxLength={1000}
              placeholder="e.g. Please clear your shared electricity and WiFi bills before tomorrow evening."
              className="mt-2 resize-none bg-card text-xs sm:text-sm"
            />
          </div>

          <Button type="submit" disabled={save.isPending} className="w-full gap-2 font-bold">
            {save.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send Notification
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MessageAdminDialog({
  trigger,
  defaultPreset,
  onSent,
}: {
  trigger?: React.ReactNode;
  defaultPreset?: string | undefined;
  onSent?: (() => void) | undefined;
}) {
  const [open, setOpen] = useState(false);
  const w = useWorkspace();
  const [selectedPreset, setSelectedPreset] = useState<string>(defaultPreset ?? "dinner_off");
  const [mealDate, setMealDate] = useState<string>(today());
  const [notes, setNotes] = useState<string>("");

  const presets = [
    {
      id: "dinner_off",
      icon: "🌙",
      label: "Dinner OFF",
      title: "Dinner OFF Notice",
      defaultNote: "Please mark my dinner as OFF for this date.",
    },
    {
      id: "lunch_off",
      icon: "☀️",
      label: "Lunch OFF",
      title: "Lunch OFF Notice",
      defaultNote: "Please mark my lunch as OFF for this date.",
    },
    {
      id: "breakfast_off",
      icon: "🍳",
      label: "Breakfast OFF",
      title: "Breakfast OFF Notice",
      defaultNote: "Please mark my breakfast as OFF for this date.",
    },
    {
      id: "all_off",
      icon: "🚫",
      label: "All Meals OFF",
      title: "All Meals OFF Notice",
      defaultNote: "Please mark all my meals as OFF for this date.",
    },
    {
      id: "deposit_paid",
      icon: "💳",
      label: "Paid Deposit",
      title: "Deposit Paid Notice",
      defaultNote: "I have submitted my monthly deposit. Please check and record it.",
    },
    {
      id: "custom",
      icon: "💬",
      label: "Custom Note",
      title: "Note to Admin",
      defaultNote: "",
    },
  ];

  const adminMember = w.members.find((m) => m.role === "admin" || m.name === w.mess?.manager);
  const currentPreset = presets.find((p) => p.id === selectedPreset) ?? presets[0]!;

  const save = useSave(async () => {
    if (!w.mess?.id) throw new Error("Mess not found.");
    if (!w.own) {
      throw new Error("You must be an active, verified member of this mess to send messages.");
    }
    const senderName = w.own.name;
    const senderRoom = w.own.room ? ` (Room ${w.own.room})` : "";
    const memberId = w.own.id;

    let fullTitle = "";
    if (selectedPreset !== "custom") {
      fullTitle = `${currentPreset.icon} ${currentPreset.label}: ${senderName}${senderRoom}`;
    } else {
      fullTitle = `💬 Note from ${senderName}${senderRoom}`;
    }

    let fullMessage = `Date: ${mealDate}\nFrom: ${senderName}${senderRoom}\n`;
    if (currentPreset.defaultNote) {
      fullMessage += `Request: ${currentPreset.defaultNote}\n`;
    }
    if (notes.trim()) {
      fullMessage += `Details: ${notes.trim()}`;
    }

    const payload = {
      mess_id: w.mess.id,
      sender_id: memberId,
      recipient_id: adminMember?.id || w.mess?.owner_id || null,
      title: fullTitle,
      message: fullMessage.trim(),
      type: "notice" as const,
      created_at: new Date().toISOString(),
    };

    const res = await db.from("mess_notifications").insert(payload);
    if (res.error) throw new Error(res.error.message);
    return { error: null };
  }, "Message sent to Admin! Your manager will see this notice.");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button size="sm" className="gap-2 font-bold shadow-xs">
            <MessageSquare className="h-4 w-4" />
            Message Admin
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-md max-h-[90dvh] overflow-y-auto p-4 sm:p-6 rounded-2xl sm:rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <MessageSquare className="h-5 w-5 text-primary" />
            Message Mess Manager
          </DialogTitle>
          <DialogDescription>
            Quickly notify {w.mess?.manager || "Admin"} about your meal cancellation, bazar note, or
            deposit payment.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await save.mutateAsync();
              setOpen(false);
              setNotes("");
              onSent?.();
            } catch {
              // Toast displays error
            }
          }}
          className="mt-2 space-y-4"
        >
          {/* Sender & Manager Summary */}
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3 flex items-center justify-between text-xs">
            <div>
              <p className="text-muted-foreground">Sending as</p>
              <p className="font-bold text-foreground">
                {w.own?.name ?? "Housemate"} {w.own?.room ? `· Room ${w.own.room}` : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground">To Manager</p>
              <p className="font-bold text-foreground">{w.mess?.manager || "Admin"}</p>
            </div>
          </div>

          {/* Quick Preset Selector */}
          <div>
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Quick Meal & Notice Presets
            </Label>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {presets.map((p) => {
                const isSelected = selectedPreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPreset(p.id)}
                    className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-semibold text-left transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary"
                        : "border-border bg-card text-foreground hover:bg-secondary/70"
                    }`}
                  >
                    <span className="text-base">{p.icon}</span>
                    <span className="truncate">{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Picker */}
          {selectedPreset !== "deposit_paid" && (
            <div>
              <Label htmlFor="meal-date">Date for this notice</Label>
              <div className="mt-1.5 flex gap-2">
                <Input
                  id="meal-date"
                  type="date"
                  value={mealDate}
                  onChange={(e) => setMealDate(e.target.value)}
                  className="h-10 bg-card flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMealDate(today())}
                  className="h-10 text-xs"
                >
                  Today
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    setMealDate(formatLocalDate(d));
                  }}
                  className="h-10 text-xs"
                >
                  Tomorrow
                </Button>
              </div>
            </div>
          )}

          {/* Additional Notes or Custom Message */}
          <div>
            <Label htmlFor="msg-notes">
              {selectedPreset === "custom"
                ? "Your Message *"
                : "Additional Details / Reason (Optional)"}
            </Label>
            <Textarea
              id="msg-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              required={selectedPreset === "custom"}
              rows={3}
              maxLength={500}
              placeholder={
                selectedPreset === "dinner_off"
                  ? "e.g. Eating outside with colleagues tonight."
                  : selectedPreset === "deposit_paid"
                    ? "e.g. Sent 2,000 BDT via bKash TrxID: 9X78Q..."
                    : "Write your message for the mess manager here..."
              }
              className="mt-1.5 resize-none bg-card text-xs"
            />
          </div>

          {!w.own && (
            <p className="rounded-lg bg-amber-500/10 p-2.5 text-center text-xs font-medium text-amber-700 dark:text-amber-300">
              Only verified members of this mess can send notices to the admin.
            </p>
          )}

          <Button
            type="submit"
            disabled={save.isPending || !w.own}
            className="w-full gap-2 font-bold"
          >
            {save.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send Notice to Admin
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NotificationDrawer() {
  const w = useWorkspace();
  const [open, setOpen] = useState(false);

  const notifications = w.notifications ?? [];
  const unreadCount = notifications.length;

  const deleteSave = useSave(
    async (id: string) => await db.from("mess_notifications").delete().eq("id", id),
    "Notification deleted",
  );

  const typeConfig = {
    notice: { icon: Megaphone, label: "Notice", tone: "bg-lime text-lime-foreground" },
    reminder: { icon: Clock, label: "Reminder", tone: "bg-peach text-peach-foreground" },
    alert: {
      icon: AlertTriangle,
      label: "Alert",
      tone: "bg-destructive text-destructive-foreground",
    },
    info: { icon: Info, label: "Info", tone: "bg-cyan text-cyan-foreground" },
  };

  const myId = w.userId || w.own?.id;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground px-1">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="flex flex-col p-0 w-full max-w-[100vw] sm:max-w-md">
        <SheetHeader className="border-b p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BellRing className="h-5 w-5 text-primary" />
              <SheetTitle>Mess Notices</SheetTitle>
            </div>
            {w.isAdmin ? (
              <SendNotificationDialog />
            ) : (
              <MessageAdminDialog
                trigger={
                  <Button size="sm" className="gap-1.5 font-bold shadow-xs text-xs h-8">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Message Admin
                  </Button>
                }
              />
            )}
          </div>
          <SheetDescription className="text-xs">
            {w.isAdmin
              ? `Manage announcements, member meal off notices & reminders for ${w.mess?.name}.`
              : `Announcements, meal updates & your messages to ${w.mess?.manager || "Admin"}.`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notifications.length === 0 ? (
            <div className="grid h-64 place-items-center text-center text-sm text-muted-foreground">
              <div>
                <Bell className="mx-auto mb-3 h-8 w-8 opacity-30" />
                <p className="font-semibold">No notices yet</p>
                <p className="mt-1 text-xs">
                  {w.isAdmin
                    ? "Click 'Send Notice' to broadcast an announcement or send a direct notice."
                    : "No notices yet. Need to turn off a meal? Click 'Message Admin' above."}
                </p>
              </div>
            </div>
          ) : (
            notifications.map((n) => {
              const cfg = typeConfig[n.type] ?? typeConfig.notice;
              const Icon = cfg.icon;

              const sender = w.members.find(
                (m) => m.id === n.sender_id || m.user_id === n.sender_id,
              );
              const recipient = w.members.find(
                (m) => m.id === n.recipient_id || m.user_id === n.recipient_id,
              );

              const isFromMemberToAdmin = Boolean(
                w.isAdmin &&
                n.sender_id &&
                n.sender_id !== w.own?.id &&
                (sender?.role !== "admin" ||
                  n.recipient_id === w.own?.id ||
                  n.recipient_id === w.mess?.owner_id),
              );
              const isTargetedToMe = Boolean(
                !w.isAdmin &&
                n.recipient_id &&
                (n.recipient_id === myId ||
                  n.recipient_id === w.own?.id ||
                  n.recipient_id === w.own?.user_id),
              );
              const isSentByMe = Boolean(
                !w.isAdmin &&
                n.sender_id &&
                (n.sender_id === myId ||
                  n.sender_id === w.own?.id ||
                  n.sender_id === w.own?.user_id),
              );

              const isMealNotice =
                n.title.includes("Dinner OFF") ||
                n.title.includes("Lunch OFF") ||
                n.title.includes("Breakfast OFF") ||
                n.title.includes("Meals OFF");

              return (
                <article
                  key={n.id}
                  className={`relative rounded-2xl border p-3.5 sm:p-4 shadow-sm space-y-2 min-w-0 overflow-hidden break-words [overflow-wrap:anywhere] transition-colors ${
                    isFromMemberToAdmin
                      ? "border-primary/40 bg-primary/5 dark:bg-primary/10"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.tone}`}
                      >
                        <Icon className="h-3 w-3" />
                        {cfg.label}
                      </span>

                      {/* Clear audience / visibility tags */}
                      {w.isAdmin ? (
                        isFromMemberToAdmin ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-accent text-accent-foreground px-2 py-0.5 text-[10px] font-bold">
                            <MessageSquare className="h-3 w-3" />
                            From: {sender?.name || "Housemate"}
                          </span>
                        ) : n.recipient_id ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-secondary text-foreground px-2 py-0.5 text-[10px] font-bold">
                            <User className="h-3 w-3 text-primary" />
                            Only To: {recipient?.name || "Specific Housemate"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-secondary text-muted-foreground px-2 py-0.5 text-[10px]">
                            <Users className="h-3 w-3" />
                            All Housemates
                          </span>
                        )
                      ) : isSentByMe ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold">
                          <Send className="h-3 w-3" />
                          Sent to Admin
                        </span>
                      ) : isTargetedToMe ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[10px] font-bold">
                          <User className="h-3 w-3" />
                          Direct to you only
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-secondary text-muted-foreground px-2 py-0.5 text-[10px]">
                          <Users className="h-3 w-3" />
                          All members
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(n.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      {(w.isAdmin || isSentByMe) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          disabled={deleteSave.isPending}
                          onClick={() => deleteSave.mutate(n.id)}
                          aria-label="Delete notice"
                          title="Delete notice"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <h3 className="font-bold text-xs sm:text-sm text-foreground break-words [overflow-wrap:anywhere]">
                    {n.title}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                    {n.message}
                  </p>

                  {/* Admin Quick Action Buttons on Member Notices */}
                  {w.isAdmin && isFromMemberToAdmin && (
                    <div className="pt-2 border-t flex flex-wrap items-center gap-2">
                      {isMealNotice && (
                        <Button asChild size="sm" variant="outline" className="h-7 text-xs gap-1.5">
                          <Link to="/meals" onClick={() => setOpen(false)}>
                            <UtensilsCrossed className="h-3 w-3 text-primary" />
                            Open Meals Ledger
                          </Link>
                        </Button>
                      )}
                      <SendNotificationDialog
                        trigger={
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5">
                            <Reply className="h-3 w-3" />
                            Reply
                          </Button>
                        }
                        defaultRecipientId={n.sender_id || undefined}
                        defaultTitle={`Re: ${n.title}`}
                      />
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
