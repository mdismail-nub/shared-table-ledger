import { useState } from "react";
import {
  Bell,
  BellRing,
  Send,
  Plus,
  Trash2,
  Megaphone,
  AlertTriangle,
  Info,
  Clock,
  Loader2,
  Users,
  User,
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
import { db, useSave, type NotificationItem } from "@/lib/data";
import { toast } from "sonner";

export function SendNotificationDialog({
  trigger,
  onSent,
}: {
  trigger?: React.ReactNode;
  onSent?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState<string>("");
  const [type, setType] = useState<"notice" | "reminder" | "alert" | "info">("notice");
  const w = useWorkspace();

  const save = useSave(async (f: FormData) => {
    const title = String(f.get("title") ?? "").trim();
    const message = String(f.get("message") ?? "").trim();

    if (!title) throw new Error("Please enter a title for the notification.");
    if (!message) throw new Error("Please enter a message.");
    if (!w.mess?.id) throw new Error("Mess not found.");

    const recipientId = recipient === "" ? null : recipient;

    // Use RPC if available, or direct insert into mess_notifications
    const { error: rpcError } = await db.rpc("send_mess_notification", {
      _recipient_id: recipientId,
      _title: title,
      _message: message,
      _type: type,
    });

    if (rpcError) {
      // Fallback to direct insert
      const { error: insertError } = await db.from("mess_notifications").insert({
        mess_id: w.mess.id,
        sender_id: w.own?.id ?? null,
        recipient_id: recipientId,
        title,
        message,
        type,
      });
      if (insertError) throw new Error(insertError.message);
    }

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
          <Button variant="outline" size="sm" className="gap-2">
            <Megaphone className="h-4 w-4" />
            Send Notice
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Megaphone className="h-5 w-5 text-primary" />
            Send Mess Notification
          </DialogTitle>
          <DialogDescription>
            Broadcast an announcement to all members or send a targeted notice to a specific
            housemate.
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
                ? "Every member in the mess will see this notice on their dashboard."
                : "Only the selected member will see this notice."}
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
              className="mt-2 resize-none bg-card"
            />
          </div>

          <Button type="submit" disabled={save.isPending} className="w-full gap-2">
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

      <SheetContent side="right" className="flex flex-col p-0 sm:max-w-md">
        <SheetHeader className="border-b p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BellRing className="h-5 w-5 text-primary" />
              <SheetTitle>Mess Notices</SheetTitle>
            </div>
            {w.isAdmin && <SendNotificationDialog />}
          </div>
          <SheetDescription className="text-xs">
            Announcements, meal updates, and reminders for {w.mess?.name}.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notifications.length === 0 ? (
            <div className="grid h-64 place-items-center text-center text-sm text-muted-foreground">
              <div>
                <Bell className="mx-auto mb-3 h-8 w-8 opacity-30" />
                <p className="font-semibold">No notices yet</p>
                <p className="mt-1 text-xs">Announcements from the admin will appear here.</p>
              </div>
            </div>
          ) : (
            notifications.map((n) => {
              const cfg = typeConfig[n.type] ?? typeConfig.notice;
              const Icon = cfg.icon;
              const isPrivate = Boolean(n.recipient_id);

              return (
                <article
                  key={n.id}
                  className="relative rounded-2xl border bg-card p-4 shadow-sm space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.tone}`}
                      >
                        <Icon className="h-3 w-3" />
                        {cfg.label}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                        {isPrivate ? <User className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                        {isPrivate ? "Direct to you" : "All members"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(n.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      {w.isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          disabled={deleteSave.isPending}
                          onClick={() => deleteSave.mutate(n.id)}
                          aria-label="Delete notice"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <h3 className="font-bold text-sm text-foreground">{n.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {n.message}
                  </p>
                </article>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
