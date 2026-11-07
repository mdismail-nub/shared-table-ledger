import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Minus, Plus, Save, Sun, Moon, Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, PageIntro, Panel, PanelHeader, StatCard } from "@/components/app/ui";
import { members, rate, totalMeals } from "@/lib/mock-data";
import { pageMeta } from "@/lib/meta";
import { cn } from "@/lib/utils";
import { UtensilsCrossed, Calculator, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/meals")({
  head: () => pageMeta("Meals", "Daily meal entry and monthly totals."),
  component: Page,
});

const slots = [{ k: "b", label: "Breakfast", icon: Coffee }, { k: "l", label: "Lunch", icon: Sun }, { k: "d", label: "Dinner", icon: Moon }] as const;
type Row = Record<"b" | "l" | "d", number>;

function Page() {
  const [day, setDay] = useState(25);
  const [rows, setRows] = useState<Record<string, Row>>(() => Object.fromEntries(members.map((m, i) => [m.id, { b: i % 3 ? 1 : 0, l: 1, d: 1 }])));
  const set = (id: string, k: keyof Row, d: number) => setRows((r) => ({ ...r, [id]: { ...r[id]!, [k]: Math.max(0, Math.min(5, r[id]![k] + d)) } }));
  const dayTotal = Object.values(rows).reduce((s, r) => s + r.b + r.l + r.d, 0);
  const allOn = (k: keyof Row) => setRows((r) => Object.fromEntries(Object.entries(r).map(([id, v]) => [id, { ...v, [k]: 1 }])));

  return (
    <div className="space-y-6">
      <PageIntro title="Meals" subtitle="Tap + / − to record each member's meals for the day." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Meals this month" value={String(totalMeals)} icon={UtensilsCrossed} tone="primary" />
        <StatCard label="Current meal rate" value={`৳${rate.toFixed(2)}`} icon={Calculator} tone="lime" />
        <StatCard label="Today's meals" value={String(dayTotal)} icon={Sun} tone="mint" />
        <StatCard label="Eating today" value={`${Object.values(rows).filter((r) => r.b + r.l + r.d > 0).length}/${members.length}`} icon={Users} tone="peach" />
      </div>
      <Panel>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" onClick={() => setDay((d) => Math.max(1, d - 1))} aria-label="Previous day"><ChevronLeft /></Button>
            <div className="min-w-32 text-center"><p className="font-bold">October {day}, 2026</p><p className="text-xs text-muted-foreground">{day === 25 ? "Today" : "Past day"}</p></div>
            <Button size="icon" variant="outline" onClick={() => setDay((d) => Math.min(31, d + 1))} aria-label="Next day"><ChevronRight /></Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => <Button key={s.k} size="sm" variant="outline" onClick={() => allOn(s.k)}>All {s.label.toLowerCase()}</Button>)}
          </div>
        </div>
        <div className="divide-y">
          {members.map((m) => {
            const r = rows[m.id]!;
            return (
              <div key={m.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center gap-3"><Avatar name={m.name} tone={m.tone} size="sm" /><div><p className="font-semibold">{m.name}</p><p className="text-xs text-muted-foreground">{r.b + r.l + r.d} meals today</p></div></div>
                <div className="grid grid-cols-3 gap-2">
                  {slots.map((s) => (
                    <div key={s.k} className={cn("flex items-center gap-1 rounded-xl p-1", r[s.k] ? "bg-primary-soft" : "bg-secondary")}>
                      <button onClick={() => set(m.id, s.k, -1)} className="grid h-7 w-7 place-items-center rounded-lg bg-card" aria-label={`Less ${s.label}`}><Minus className="h-3.5 w-3.5" /></button>
                      <div className="w-10 text-center"><s.icon className="mx-auto h-3 w-3 text-muted-foreground" /><p className="text-sm font-bold">{r[s.k]}</p></div>
                      <button onClick={() => set(m.id, s.k, 1)} className="grid h-7 w-7 place-items-center rounded-lg bg-card" aria-label={`More ${s.label}`}><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-ink p-4 text-ink-foreground">
          <p className="text-sm"><span className="text-2xl font-extrabold text-lime">{dayTotal}</span> meals for this day</p>
          <Button variant="lime" onClick={() => toast.success("Meals saved", { description: `${dayTotal} meals recorded for Oct ${day}.` })}><Save /> Save meals</Button>
        </div>
      </Panel>
      <Panel>
        <PanelHeader title="Monthly totals" subtitle="Meals per member so far in October" />
        <div className="space-y-3">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3">
              <span className="w-28 truncate text-sm font-medium">{m.name}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-brand-gradient" style={{ width: `${(m.meals / 90) * 100}%` }} /></div>
              <span className="w-10 text-right text-sm font-bold">{m.meals}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
