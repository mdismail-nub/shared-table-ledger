import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Phone, Plus, Search, DoorOpen, CalendarDays, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, EmptyState, Money, PageIntro, Panel, StatusBadge } from "@/components/app/ui";
import { AddMemberDialog } from "@/components/app/dialogs";
import { ledger, rate } from "@/lib/mock-data";
import { pageMeta } from "@/lib/meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/members")({
  head: () => pageMeta("Members", "Member profiles and individual accounts."),
  component: Page,
});

const filters = ["All", "Active", "New", "Owes money"] as const;

function Page() {
  const [q, setQ] = useState("");
  const [f, setF] = useState<(typeof filters)[number]>("All");
  const [sel, setSel] = useState(ledger[0].id);
  const list = ledger.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()) &&
    (f === "All" || (f === "Active" && m.status === "active") || (f === "New" && m.status === "new") || (f === "Owes money" && m.balance < 0)));
  const m = ledger.find((x) => x.id === sel)!;

  return (
    <div>
      <PageIntro title="Members" subtitle={`${ledger.length} people sharing this mess`}
        actions={<AddMemberDialog trigger={<Button><Plus /> Add member</Button>} />} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search members…" className="h-11 rounded-xl bg-card pl-10" />
        </div>
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-secondary p-1">
          {filters.map((x) => (
            <button key={x} onClick={() => setF(x)} className={cn("whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground", f === x && "bg-card text-foreground shadow-card")}>{x}</button>
          ))}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {list.length === 0 ? <EmptyState icon={Users} title="No members found" text="Try a different search or filter." /> : (
          <div className="grid gap-3 sm:grid-cols-2">
            {list.map((x) => (
              <button key={x.id} onClick={() => setSel(x.id)} className={cn("rounded-2xl border bg-card p-4 text-left shadow-card transition hover:-translate-y-0.5", sel === x.id && "ring-2 ring-primary")}>
                <div className="flex items-center gap-3">
                  <Avatar name={x.name} tone={x.tone} />
                  <div className="min-w-0 flex-1"><p className="truncate font-bold">{x.name}</p><p className="text-xs text-muted-foreground">Room {x.room}</p></div>
                  <StatusBadge status={x.status === "new" ? "New" : x.status === "left" ? "Left" : "Active"} />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-secondary p-2"><p className="text-[11px] text-muted-foreground">Meals</p><p className="font-bold">{x.meals}</p></div>
                  <div className="rounded-xl bg-secondary p-2"><p className="text-[11px] text-muted-foreground">Paid</p><p className="font-bold"><Money value={x.deposits} /></p></div>
                  <div className="rounded-xl bg-secondary p-2"><p className="text-[11px] text-muted-foreground">Balance</p><p className="text-sm"><Money value={x.balance} signed /></p></div>
                </div>
              </button>
            ))}
          </div>
        )}
        <Panel className="h-fit lg:sticky lg:top-6">
          <div className="flex flex-col items-center text-center">
            <Avatar name={m.name} tone={m.tone} size="lg" />
            <p className="mt-3 text-lg font-bold">{m.name}</p>
            <div className="mt-1 flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{m.phone}</span>
              <span className="flex items-center gap-1"><DoorOpen className="h-3.5 w-3.5" />{m.room}</span>
              <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{m.joined}</span>
            </div>
          </div>
          <div className={cn("mt-5 rounded-2xl p-4 text-center", m.balance < 0 ? "bg-destructive-soft" : "bg-mint")}>
            <p className="text-xs font-medium text-foreground/70">{m.balance < 0 ? "Needs to pay" : "Will get back"}</p>
            <p className={cn("text-3xl font-extrabold", m.balance < 0 ? "text-destructive" : "text-mint-foreground")}><Money value={m.balance} /></p>
          </div>
          <dl className="mt-4 space-y-2.5 text-sm">
            {[["Meals eaten", `${m.meals} × ৳${rate.toFixed(2)}`], ["Meal cost", <Money key="a" value={m.mealCost} />], ["Shared bills", <Money key="b" value={m.shared} />], ["Total due", <Money key="c" value={m.due} />], ["Deposited", <Money key="d" value={m.deposits} />]].map(([k, v], i) => (
              <div key={i} className="flex justify-between border-b border-dashed pb-2 last:border-0"><dt className="text-muted-foreground">{k}</dt><dd className="font-semibold">{v}</dd></div>
            ))}
          </dl>
        </Panel>
      </div>
    </div>
  );
}
