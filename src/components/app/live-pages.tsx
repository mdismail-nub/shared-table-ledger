import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useWorkspace } from "@/lib/workspace";
import { useSave, db, monthLabel, today, useInviteCode } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, Money, PageIntro, StatCard, EmptyState, StatusBadge } from "./ui";
import { LiveDialog } from "./live-dialog";
import { ChartEmpty, ChartTip, axis, shortTaka } from "./charts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Calculator,
  Wallet,
  Users,
  ShoppingBasket,
  Home,
  UtensilsCrossed,
  Plus,
  Minus,
  Save,
  Trash2,
  Copy,
  RefreshCw,
  Download,
  ArrowRight,
  Megaphone,
} from "lucide-react";
import { toast } from "sonner";
import { exportLedger } from "@/lib/export";
import { SendNotificationDialog } from "./notification-dialog";

function ConfirmDeleteDialog({
  title,
  description,
  onConfirm,
  disabled,
  triggerLabel,
}: {
  title: string;
  description: string;
  onConfirm: () => void;
  disabled?: boolean;
  triggerLabel: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={triggerLabel}
          title={triggerLabel}
          disabled={disabled}
        >
          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function SpendingChart() {
  const w = useWorkspace();
  const data = Object.values(
    (w.expenses || []).reduce(
      (
        a: Record<string, { day: string; food: number; household: number }>,
        e: { date: string; type: string; amount: number | string },
      ) => {
        const r = a[e.date] ?? { day: e.date.slice(5), food: 0, household: 0 };
        r[e.type === "meal" ? "food" : "household"] += Number(e.amount);
        a[e.date] = r;
        return a;
      },
      {} as Record<string, { day: string; food: number; household: number }>,
    ),
  ).reverse();

  return (
    <section className="min-w-0">
      <h2 className="mb-4 text-lg font-bold">Daily spending</h2>
      <div className="mb-3 flex gap-5 text-xs">
        <span className="flex items-center gap-2">
          <i className="h-2 w-2 rounded-full bg-chart-1" />
          Food
        </span>
        <span className="flex items-center gap-2">
          <i className="h-2 w-2 rounded-full bg-chart-3" />
          Household
        </span>
      </div>
      {!data.length ? (
        <ChartEmpty />
      ) : (
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="day" {...axis} />
              <YAxis {...axis} width={55} tickFormatter={shortTaka} />
              <Tooltip content={<ChartTip total />} cursor={{ fill: "var(--secondary)" }} />
              <Bar dataKey="food" name="Food" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              <Bar
                dataKey="household"
                name="Household"
                fill="var(--chart-3)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function NoticeBoard() {
  const w = useWorkspace();
  const notifications = (w.notifications ?? []).filter((n) => {
    if (w.isAdmin) return true;
    if (!n.recipient_id) return true;
    return n.recipient_id === w.userId;
  });

  const typeConfig: Record<string, { tone: string; label: string }> = {
    notice: { tone: "bg-lime text-lime-foreground", label: "Notice" },
    reminder: { tone: "bg-peach text-peach-foreground", label: "Reminder" },
    alert: { tone: "bg-destructive text-destructive-foreground", label: "Urgent Alert" },
    info: { tone: "bg-cyan text-cyan-foreground", label: "Info" },
  };

  return (
    <section className="rounded-3xl border bg-card p-6 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Mess Notice Board</h2>
            <p className="text-xs text-muted-foreground">
              Broadcast announcements and member updates
            </p>
          </div>
        </div>
        {w.isAdmin && <SendNotificationDialog />}
      </div>

      {notifications.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          <p className="font-semibold">No active notices</p>
          <p className="mt-1 text-xs">
            {w.isAdmin
              ? "Keep your housemates informed. Click 'Send Notice' to broadcast an announcement."
              : "No notices have been posted yet."}
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {notifications.slice(0, 6).map((n) => {
            const cfg = typeConfig[n.type] ?? typeConfig["notice"]!;
            const isPrivate = Boolean(n.recipient_id);

            return (
              <article
                key={n.id}
                className="relative flex flex-col justify-between rounded-2xl border bg-background/60 p-4 shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.tone}`}
                    >
                      {cfg.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(n.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>

                  <h3 className="mt-2 text-sm font-bold text-foreground">{n.title}</h3>
                  <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {n.message}
                  </p>
                </div>

                <div className="mt-3 border-t pt-2 text-[10px] text-muted-foreground">
                  {isPrivate ? "👤 For you specifically" : "📢 Sent to all housemates"}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function DashboardPage() {
  const w = useWorkspace();
  const nav = useNavigate();

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-primary-soft p-6 sm:p-8">
        <p className="text-sm text-accent-foreground">
          {monthLabel(w.month)} · {w.isAdmin ? "Admin overview" : "Member overview (View-Only)"}
        </p>
        <h1 className="mt-2 text-3xl font-extrabold">
          Welcome, {w.own?.name.split(" ")[0] ?? "housemate"}.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {w.mess?.name} · A good month starts around the table.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {w.isAdmin ? (
            <>
              <LiveDialog kind="expense" />
              <LiveDialog kind="payment" />
              <SendNotificationDialog />
            </>
          ) : (
            <Button onClick={() => nav({ to: "/accounts" })}>
              My account <ArrowRight />
            </Button>
          )}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Meal rate"
          value={`৳${w.rate.toFixed(2)}`}
          icon={Calculator}
          tone="primary"
        />
        <StatCard
          label={w.isAdmin ? "Total meals" : "Your meals"}
          value={String(w.isAdmin ? w.summary.total_meals : (w.own?.meals ?? 0))}
          icon={UtensilsCrossed}
          tone="lime"
        />
        <StatCard
          label={w.isAdmin ? "Collected" : "Your payments"}
          value={`৳${(w.isAdmin ? Number(w.summary.deposits) : (w.own?.deposits ?? 0)).toLocaleString("en-IN")}`}
          icon={Wallet}
          tone="mint"
        />
        <StatCard
          label={w.isAdmin ? "Household bills" : "Your shared bills"}
          value={`৳${Math.round(w.isAdmin ? Number(w.summary.household) : (w.own?.shared ?? 0)).toLocaleString("en-IN")}`}
          icon={Home}
          tone="peach"
        />
      </div>

      {/* Notice Board */}
      <NoticeBoard />

      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <SpendingChart />
        <section>
          <h2 className="mb-4 text-lg font-bold">
            {w.isAdmin ? "Latest payments" : "Your balance"}
          </h2>
          {w.isAdmin ? (
            <PaymentList limit={5} />
          ) : (
            <div className="rounded-2xl bg-mint p-6">
              <p className="text-sm">
                {(w.own?.balance ?? 0) < 0 ? "Still to pay" : "Available credit"}
              </p>
              <p className="mt-2 text-3xl font-extrabold">
                <Money value={w.own?.balance ?? 0} />
              </p>
              <Button variant="ghost" className="mt-4" onClick={() => nav({ to: "/accounts" })}>
                View breakdown <ArrowRight />
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export function MembersPage() {
  const w = useWorkspace();
  const [q, setQ] = useState("");
  const save = useSave(
    async (v: { id: string; status: string }) =>
      await db.from("mess_members").update({ status: v.status }).eq("id", v.id),
    "Member updated",
  );

  return (
    <>
      <PageIntro
        title="Housemates"
        subtitle={`${w.members.length} members · ${w.mess?.name}`}
        actions={w.isAdmin ? <LiveDialog kind="member" /> : null}
      />
      <Input
        aria-label="Search members"
        placeholder="Search housemates…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-5 max-w-md bg-card"
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {w.members
          .filter((m) => m.name.toLowerCase().includes(q.toLowerCase()))
          .map((m) => (
            <article key={m.id} className="rounded-2xl border bg-card p-5 shadow-card">
              <div className="flex items-center gap-3">
                <Avatar name={m.name} tone={m.tone} />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-bold">{m.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {m.role === "admin" ? "Admin" : "Member"}
                    {m.room && ` · Room ${m.room}`}
                  </p>
                </div>
                <StatusBadge
                  status={m.status === "left" ? "Left" : m.status === "new" ? "New" : "Active"}
                />
              </div>
              <p className="mt-4 text-xs text-muted-foreground">Joined {m.joined}</p>
              {w.isAdmin && m.role !== "admin" && (
                <select
                  aria-label={`Status for ${m.name}`}
                  value={m.status}
                  disabled={save.isPending}
                  onChange={(e) => save.mutate({ id: m.id, status: e.target.value })}
                  className="mt-4 h-10 w-full rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="active">Active</option>
                  <option value="new">New</option>
                  <option value="left">Left (Exclude from bills)</option>
                </select>
              )}
            </article>
          ))}
      </div>
    </>
  );
}

export function MealsPage() {
  const w = useWorkspace();
  const year = Number(w.month.slice(0, 4));
  const monthNum = Number(w.month.slice(5, 7));
  const lastDay = new Date(year, monthNum, 0).getDate();
  const minDate = `${w.month}-01`;
  const maxDate = `${w.month}-${String(lastDay).padStart(2, "0")}`;

  const defaultDay = today().startsWith(w.month) ? today() : minDate;
  const [day, setDay] = useState(defaultDay);
  const [draft, setDraft] = useState<
    Record<string, { breakfast: number; lunch: number; dinner: number }>
  >({});
  const slots = ["breakfast", "lunch", "dinner"] as const;

  const visible = w.members.filter((m) => m.status !== "left");

  const row = (id: string) =>
    draft[id] ??
    w.meals.find(
      (m: { member_id: string; date: string }) => m.member_id === id && m.date === day,
    ) ?? {
      breakfast: 0,
      lunch: 0,
      dinner: 0,
    };

  const save = useSave(async () => {
    if (!visible.length) return { error: null };
    const payload = visible.map((m) => {
      const r = row(m.id);
      return {
        member_id: m.id,
        date: day,
        breakfast: Math.max(0, Math.min(10, Number(r.breakfast) || 0)),
        lunch: Math.max(0, Math.min(10, Number(r.lunch) || 0)),
        dinner: Math.max(0, Math.min(10, Number(r.dinner) || 0)),
      };
    });
    return await db.from("mess_meals").upsert(payload, { onConflict: "member_id,date" });
  }, "Meals saved");

  return (
    <div className="space-y-6">
      <PageIntro title={w.isAdmin ? "Daily meals" : "My meals"} subtitle={monthLabel(w.month)} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          aria-label="Meal date"
          type="date"
          value={day}
          min={minDate}
          max={maxDate}
          onChange={(e) => {
            setDay(e.target.value);
            setDraft({});
          }}
          className="w-44 bg-card"
        />
        {w.isAdmin && (
          <Button
            disabled={save.isPending || !visible.length}
            onClick={() => save.mutate(undefined)}
          >
            <Save />
            Save meals
          </Button>
        )}
      </div>

      {visible.map((m) => (
        <article
          key={m.id}
          className="flex flex-col gap-4 border-b py-4 sm:flex-row sm:items-center"
        >
          <div className="flex flex-1 items-center gap-3">
            <Avatar name={m.name} />
            <span className="font-semibold">{m.name}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {slots.map((k) => (
              <div key={k} className="rounded-xl bg-card p-2 text-center">
                <p className="mb-2 text-[11px] capitalize text-muted-foreground">{k}</p>
                <div className="flex items-center justify-center gap-1">
                  {w.isAdmin && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      aria-label={`Less ${k} for ${m.name}`}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          [m.id]: { ...row(m.id), [k]: Math.max(0, row(m.id)[k] - 0.5) },
                        })
                      }
                    >
                      <Minus />
                    </Button>
                  )}
                  <span className="w-8 font-bold">{row(m.id)[k]}</span>
                  {w.isAdmin && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      aria-label={`More ${k} for ${m.name}`}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          [m.id]: { ...row(m.id), [k]: Math.min(10, row(m.id)[k] + 0.5) },
                        })
                      }
                    >
                      <Plus />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </article>
      ))}

      {!visible.length && (
        <EmptyState
          icon={Users}
          title="No active members"
          text="Your housemates will appear here."
        />
      )}

      <section>
        <h2 className="mb-4 text-lg font-bold">Monthly meal totals</h2>
        {w.ledger
          .filter(
            (m) => w.isAdmin || (w.userId ? m.id === w.userId || m.user_id === w.userId : true),
          )
          .map((m) => (
            <div key={m.id} className="mb-4">
              <div className="mb-2 flex justify-between text-sm">
                <span>{m.name}</span>
                <b>{m.meals} meals</b>
              </div>
              <progress
                value={m.meals}
                max={Math.max(1, ...w.ledger.map((l: { meals: number }) => l.meals))}
                className="h-2 w-full accent-primary"
              />
            </div>
          ))}
      </section>
    </div>
  );
}

function PaymentList({ limit }: { limit?: number }) {
  const w = useWorkspace();
  const save = useSave(
    async (id: string) => await db.from("payments").delete().eq("id", id),
    "Payment removed",
  );

  return w.payments.length ? (
    <ul className="divide-y">
      {w.payments
        .slice(0, limit)
        .map(
          (p: {
            id: string;
            member_id: string;
            date: string;
            method: string;
            reference?: string;
            amount: number | string;
          }) => (
            <li key={p.id} className="flex items-center gap-3 py-4">
              <Avatar
                name={w.members.find((m: { id: string }) => m.id === p.member_id)?.name ?? "Member"}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {w.members.find((m: { id: string }) => m.id === p.member_id)?.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.date} · {p.method} {p.reference ? `· ${p.reference}` : ""}
                </p>
              </div>
              <b className="text-success">
                <Money value={Number(p.amount)} />
              </b>
              {w.isAdmin && (
                <ConfirmDeleteDialog
                  title="Remove Payment Record?"
                  description="This will permanently delete this payment deposit. Member balances will recalculate automatically."
                  triggerLabel="Delete payment"
                  disabled={save.isPending}
                  onConfirm={() => save.mutate(p.id)}
                />
              )}
            </li>
          ),
        )}
    </ul>
  ) : (
    <ChartEmpty text="No payments this month" h="h-40" />
  );
}

export function PaymentsPage() {
  const w = useWorkspace();
  return (
    <>
      <PageIntro
        title={w.isAdmin ? "Payments" : "My payments"}
        subtitle={monthLabel(w.month)}
        actions={w.isAdmin ? <LiveDialog kind="payment" /> : null}
      />
      <PaymentList />
    </>
  );
}

export function ExpensesPage() {
  const w = useWorkspace();
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const save = useSave(
    async (id: string) => await db.from("mess_expenses").delete().eq("id", id),
    "Expense removed",
  );

  const list = w.expenses.filter(
    (e: { type: string; category: string; description?: string }) =>
      (type === "all" || e.type === type) &&
      (e.category + (e.description || "")).toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <PageIntro
        title="Expenses"
        subtitle="Food and household bills, kept separate."
        actions={w.isAdmin ? <LiveDialog kind="expense" /> : null}
      />
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Food / Bazar"
          value={`৳${Number(w.summary.food).toLocaleString("en-IN")}`}
          icon={ShoppingBasket}
          tone="mint"
        />
        <StatCard
          label="Household bills"
          value={`৳${Number(w.summary.household).toLocaleString("en-IN")}`}
          icon={Home}
          tone="peach"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex gap-1">
          {["all", "meal", "household"].map((t) => (
            <Button
              key={t}
              variant={type === t ? "default" : "outline"}
              onClick={() => setType(t)}
              className="capitalize"
            >
              {t === "meal" ? "Food" : t}
            </Button>
          ))}
        </div>
        <Input
          aria-label="Search expenses"
          placeholder="Search expenses…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="bg-card"
        />
      </div>

      {list.length ? (
        <ul className="divide-y">
          {list.map(
            (e: {
              id: string;
              type: string;
              category: string;
              description?: string;
              date: string;
              method: string;
              amount: number | string;
            }) => (
              <li key={e.id} className="flex items-center gap-3 py-4">
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                    e.type === "meal"
                      ? "bg-mint text-mint-foreground"
                      : "bg-peach text-peach-foreground"
                  }`}
                >
                  {e.type === "meal" ? (
                    <ShoppingBasket className="h-5 w-5" />
                  ) : (
                    <Home className="h-5 w-5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="break-words font-semibold">{e.description || e.category}</h2>
                  <p className="text-xs text-muted-foreground">
                    {e.category} · {e.date} · {e.method}
                  </p>
                </div>
                <b className="shrink-0">
                  <Money value={Number(e.amount)} />
                </b>
                {w.isAdmin && (
                  <ConfirmDeleteDialog
                    title="Remove Expense Record?"
                    description="This will permanently delete this expense. The meal rate or household bill share will recalculate immediately."
                    triggerLabel="Delete expense"
                    disabled={save.isPending}
                    onConfirm={() => save.mutate(e.id)}
                  />
                )}
              </li>
            ),
          )}
        </ul>
      ) : (
        <EmptyState
          icon={ShoppingBasket}
          title="No expenses found"
          text="No matching records for this month."
        />
      )}
    </div>
  );
}

export function AccountsPage() {
  const w = useWorkspace();
  const filtered = w.ledger.filter((m) =>
    w.userId ? m.id === w.userId || m.user_id === w.userId : true,
  );
  const rows = w.isAdmin ? w.ledger : filtered.length ? filtered : w.ledger;

  return (
    <div className="space-y-6">
      <PageIntro
        title={w.isAdmin ? "Monthly accounts" : "My account"}
        subtitle={monthLabel(w.month)}
        actions={
          <Button variant="outline" onClick={() => exportLedger(rows, w.month)}>
            <Download />
            Statement
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-primary-soft p-5">
          <h2 className="font-bold">Meal rate</h2>
          <p className="mt-3 text-3xl font-extrabold">৳{w.rate.toFixed(2)}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            ৳{Number(w.summary.food).toLocaleString("en-IN")} food ÷ {w.summary.total_meals} meals
          </p>
        </div>
        <div className="rounded-2xl bg-peach p-5">
          <h2 className="font-bold">Household share</h2>
          <p className="mt-3 text-3xl font-extrabold">৳{w.shared.toFixed(2)}</p>
          <p className="mt-2 text-xs text-peach-foreground">
            ৳{Number(w.summary.household).toLocaleString("en-IN")} ÷ {w.summary.active_members}{" "}
            active members · separate from meal rate
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((m) => (
          <article key={m.id} className="rounded-2xl border bg-card p-5">
            <div className="flex items-center gap-3">
              <Avatar name={m.name} />
              <h2 className="min-w-0 flex-1 truncate font-bold">{m.name}</h2>
              <Money value={m.balance} signed />
            </div>
            <dl className="mt-5 space-y-3">
              {[
                ["Meals", String(m.meals)],
                ["Meal cost", `৳${m.mealCost.toFixed(2)}`],
                ["Shared bills", `৳${m.shared.toFixed(2)}`],
                ["Total charges", `৳${m.due.toFixed(2)}`],
                ["Paid", `৳${m.deposits.toFixed(2)}`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b pb-2 text-sm">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}

export function ReportsPage() {
  const w = useWorkspace();
  const categories: [string, number][] = (
    Object.entries(
      (w.expenses || []).reduce(
        (a: Record<string, number>, e: { category: string; amount: number | string }) => ({
          ...a,
          [e.category]: (a[e.category] ?? 0) + Number(e.amount),
        }),
        {} as Record<string, number>,
      ),
    ) as [string, number][]
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-8">
      <PageIntro
        title="Reports"
        subtitle={monthLabel(w.month)}
        actions={
          <Button
            variant="outline"
            onClick={() => {
              const filtered = w.ledger.filter((m) =>
                w.userId ? m.id === w.userId || m.user_id === w.userId : true,
              );
              const target = w.isAdmin ? w.ledger : filtered.length ? filtered : w.ledger;
              exportLedger(target, w.month);
            }}
          >
            <Download />
            Export CSV
          </Button>
        }
      />
      <SpendingChart />
      <section>
        <h2 className="mb-5 text-lg font-bold">Spending by category</h2>
        {categories.map(([name, value]) => (
          <div key={name} className="mb-5">
            <div className="mb-2 flex justify-between text-sm">
              <span>{name}</span>
              <b>
                <Money value={value} />
              </b>
            </div>
            <progress
              value={value}
              max={Math.max(1, ...categories.map((c) => c[1]))}
              className="h-2 w-full accent-primary"
            />
          </div>
        ))}
        {!categories.length && <ChartEmpty />}
      </section>
    </div>
  );
}

export function SettingsPage() {
  const w = useWorkspace();
  const invite = useInviteCode();

  const save = useSave(async (f: FormData) => {
    const name = String(f.get("name") ?? "").trim();
    const manager = String(f.get("manager") ?? "").trim();
    const address = String(f.get("address") ?? "").trim();

    if (name.length < 2 || name.length > 80)
      throw new Error("Mess name must be between 2 and 80 characters.");
    if (manager.length < 1 || manager.length > 80)
      throw new Error("Manager name must be between 1 and 80 characters.");

    const meal_categories = String(f.get("meal_categories") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const household_categories = String(f.get("household_categories") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (meal_categories.length === 0)
      throw new Error("At least one food/meal category is required.");
    if (household_categories.length === 0)
      throw new Error("At least one household category is required.");
    if (!w.mess?.id) throw new Error("Mess record not found.");

    return await db
      .from("messes")
      .update({
        name,
        manager,
        address: address.slice(0, 200),
        show_invite_to_members: f.get("invite") === "on",
        meal_categories,
        household_categories,
      })
      .eq("id", w.mess.id);
  }, "Settings saved");

  const rotate = useSave(async () => await db.rpc("regenerate_invite_code"), "Invitation updated");

  return (
    <div className="space-y-7">
      <PageIntro
        title={w.isAdmin ? "Settings" : "Mess information"}
        subtitle={w.mess?.name ?? ""}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(new FormData(e.currentTarget));
        }}
        className="space-y-6"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          {(["name", "manager", "address"] as const).map((k) => (
            <div key={k}>
              <Label htmlFor={k} className="capitalize">
                {k === "name" ? "Mess name" : k}
              </Label>
              <Input
                id={k}
                name={k}
                defaultValue={w.mess?.[k]}
                readOnly={!w.isAdmin}
                required={k !== "address"}
                minLength={k === "name" ? 2 : 1}
                maxLength={k === "address" ? 200 : 80}
                className="mt-2 h-12 bg-card"
              />
            </div>
          ))}
        </div>

        <section className="border-t pt-6">
          <h2 className="mb-4 text-lg font-bold">Categories (comma-separated)</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            {(["meal_categories", "household_categories"] as const).map((k) => (
              <div key={k}>
                <Label htmlFor={k}>
                  {k === "meal_categories" ? "Food categories" : "Household categories"}
                </Label>
                <Input
                  id={k}
                  name={k}
                  defaultValue={w.mess?.[k]?.join(", ")}
                  readOnly={!w.isAdmin}
                  required
                  className="mt-2 bg-card"
                />
              </div>
            ))}
          </div>
        </section>

        {w.isAdmin && (
          <>
            <label className="flex items-center justify-between gap-4 border-t pt-6">
              <span className="text-sm font-semibold">Let members see the invitation code</span>
              <Switch name="invite" defaultChecked={w.mess?.show_invite_to_members ?? false} />
            </label>
            <Button disabled={save.isPending}>
              <Save />
              Save changes
            </Button>
          </>
        )}
      </form>

      {invite.data && (
        <section className="border-t pt-6">
          <h2 className="text-lg font-bold">Invitation code</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Share this 6-digit code with housemates so they can join your mess.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-3xl font-extrabold tracking-[0.15em]">{invite.data}</span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Copy invitation code"
              title="Copy code"
              onClick={async () => {
                await navigator.clipboard.writeText(invite.data ?? "");
                toast.success("Code copied");
              }}
            >
              <Copy />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const link = `${window.location.origin}/?code=${invite.data}`;
                await navigator.clipboard.writeText(link);
                toast.success("Direct invitation link copied!");
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy Direct Link
            </Button>
            {w.isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={rotate.isPending}>
                    <RefreshCw />
                    New code
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Generate New Invitation Code?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The previous invitation code will immediately stop working. Existing members
                      will not be affected, but anyone trying to join with the old code will be
                      rejected.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => rotate.mutate(undefined)}>
                      Generate
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
