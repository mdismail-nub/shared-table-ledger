import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Home, Plus, Receipt, Search, ShoppingBasket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, EmptyState, Money, PageIntro, Panel, StatCard, StatusBadge } from "@/components/app/ui";
import { AddExpenseDialog } from "@/components/app/dialogs";
import { expenses, foodTotal, householdTotal, memberById } from "@/lib/mock-data";
import { pageMeta } from "@/lib/meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => pageMeta("Expenses", "Bazar purchases and household bills."),
  component: Page,
});

const tabs = [{ k: "all", l: "All" }, { k: "meal", l: "Meal / Bazar" }, { k: "household", l: "Household" }] as const;

function Page() {
  const [tab, setTab] = useState<(typeof tabs)[number]["k"]>("all");
  const [q, setQ] = useState("");
  const list = expenses.filter((e) => (tab === "all" || e.type === tab) && (e.description + e.category).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <PageIntro title="Expenses" subtitle="Bazar purchases and household bills, kept separate."
        actions={<AddExpenseDialog trigger={<Button><Plus /> Add expense</Button>} />} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Meal / bazar" value={`৳${foodTotal.toLocaleString("en-IN")}`} icon={ShoppingBasket} tone="mint" hint="Used for the meal rate" />
        <StatCard label="Household bills" value={`৳${householdTotal.toLocaleString("en-IN")}`} icon={Home} tone="peach" hint="Split equally, not in meal rate" />
        <div className="col-span-2 sm:col-span-1"><StatCard label="Entries this month" value={String(expenses.length)} icon={Receipt} tone="primary" /></div>
      </div>
      <Panel>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="flex gap-1 rounded-xl bg-secondary p-1">
            {tabs.map((t) => <button key={t.k} onClick={() => setTab(t.k)} className={cn("rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground", tab === t.k && "bg-card text-foreground shadow-card")}>{t.l}</button>)}
          </div>
          <div className="relative flex-1"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search expenses…" className="h-10 rounded-xl pl-10" /></div>
        </div>
        {list.length === 0 ? <EmptyState icon={Receipt} title="No expenses" text="Nothing matches your search." /> : (
          <ul className="divide-y">
            {list.map((e) => {
              const m = memberById(e.memberId);
              const Icon = e.type === "meal" ? ShoppingBasket : Home;
              return (
                <li key={e.id} className="flex items-center gap-3 py-3">
                  <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", e.type === "meal" ? "bg-mint text-mint-foreground" : "bg-peach text-peach-foreground")}><Icon className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{e.description}</p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">{e.category} · {e.date.slice(5)} · {e.method}</p>
                  </div>
                  <div className="hidden items-center gap-2 md:flex"><Avatar name={m.name} tone={m.tone} size="sm" /><span className="text-sm">{m.name.split(" ")[0]}</span></div>
                  <StatusBadge status={e.type === "meal" ? "Meal" : "Household"} className="hidden sm:inline-flex" />
                  <p className="w-20 text-right font-bold"><Money value={e.amount} /></p>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
