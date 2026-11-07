import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Save, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageIntro, Panel, PanelHeader } from "@/components/app/ui";
import { householdCategories, mealCategories } from "@/lib/mock-data";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/settings")({
  head: () => pageMeta("Settings", "Mess details, categories and accounting rules."),
  component: Page,
});

function Chips({ items, tone }: { items: string[]; tone: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((c) => <span key={c} className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${tone}`}>{c}<X className="h-3 w-3 opacity-60" /></span>)}
      <button className="flex items-center gap-1 rounded-full border border-dashed px-3 py-1 text-sm text-muted-foreground"><Plus className="h-3 w-3" />Add</button>
    </div>
  );
}

function Toggle({ title, text, on }: { title: string; text: string; on?: boolean }) {
  return <div className="flex items-center justify-between gap-4 py-3"><div><p className="font-semibold">{title}</p><p className="text-xs text-muted-foreground">{text}</p></div><Switch defaultChecked={!!on} /></div>;
}

function Page() {
  return (
    <div className="space-y-6">
      <PageIntro title="Settings" subtitle="Mess details, categories and accounting rules."
        actions={<Button onClick={() => toast.success("Settings saved")}><Save /> Save changes</Button>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Mess details" />
          <div className="grid gap-4 sm:grid-cols-2">
            {[["Mess name", "Green House Mess"], ["Manager", "Md Ismail"], ["Address", "Mirpur 10, Dhaka"], ["Currency", "BDT (৳)"]].map(([l, v]) => (
              <div key={l} className="space-y-1.5"><Label className="text-xs font-semibold text-muted-foreground">{l}</Label><Input defaultValue={v} className="h-11 rounded-xl" /></div>
            ))}
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Accounting rules" />
          <div className="divide-y">
            <Toggle title="Split household bills equally" text="Wi-Fi, gas, electricity shared by all active members" on />
            <Toggle title="Carry balance to next month" text="Unpaid dues and credits roll over" on />
            <Toggle title="Count guest meals" text="Charge guest meals to the host member" />
            <Toggle title="Lock past days" text="Prevent edits to meals older than 3 days" />
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Meal categories" subtitle="These count toward the meal rate" />
          <Chips items={mealCategories} tone="bg-mint text-mint-foreground" />
        </Panel>
        <Panel>
          <PanelHeader title="Household categories" subtitle="Shared bills, never in the meal rate" />
          <Chips items={householdCategories} tone="bg-peach text-peach-foreground" />
        </Panel>
        <Panel className="lg:col-span-2">
          <PanelHeader title="Notifications" />
          <div className="grid gap-x-8 divide-y sm:grid-cols-2 sm:divide-y-0">
            <Toggle title="Daily meal reminder" text="Remind at 10 PM to record meals" on />
            <Toggle title="Low balance alerts" text="Notify members whose balance goes negative" on />
          </div>
        </Panel>
      </div>
    </div>
  );
}
