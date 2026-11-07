import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Lock, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, Money, PageIntro, Panel, PanelHeader, StatusBadge } from "@/components/app/ui";
import { foodTotal, householdTotal, ledger, members, rate, sharedShare, totalMeals } from "@/lib/mock-data";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/_authenticated/accounts")({
  head: () => pageMeta("Monthly Accounts", "Meal rate, dues and balance settlement."),
  component: Page,
});

function Step({ n, title, formula, result }: { n: number; title: string; formula: string; result: string }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-secondary p-4">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{n}</span>
      <div className="min-w-0 flex-1"><p className="font-semibold">{title}</p><p className="text-xs text-muted-foreground">{formula}</p></div>
      <p className="self-center text-lg font-extrabold">{result}</p>
    </div>
  );
}

function Page() {
  return (
    <div className="space-y-6">
      <PageIntro title="Monthly Accounts" subtitle="October 2026 · step-by-step settlement"
        actions={<><Button variant="outline" onClick={() => toast("Statement downloaded")}><Download /> Statement</Button>
          <Button onClick={() => toast.success("Month closed", { description: "Balances carried to November." })}><Lock /> Close month</Button></>} />
      <Panel>
        <PanelHeader title="How the numbers work" subtitle="Household bills never affect the meal rate" />
        <div className="grid gap-3 md:grid-cols-2">
          <Step n={1} title="Meal expenses" formula="Only bazar / food purchases" result={`৳${foodTotal.toLocaleString("en-IN")}`} />
          <Step n={2} title="Total meals" formula="All members, whole month" result={String(totalMeals)} />
          <Step n={3} title="Meal rate" formula={`৳${foodTotal.toLocaleString("en-IN")} ÷ ${totalMeals} meals`} result={`৳${rate.toFixed(2)}`} />
          <Step n={4} title="Shared bill per person" formula={`৳${householdTotal.toLocaleString("en-IN")} ÷ ${members.length} members`} result={`৳${sharedShare.toFixed(0)}`} />
        </div>
      </Panel>
      <Panel>
        <PanelHeader title="Member balances" subtitle="Balance = deposits − (meals × rate + shared bills)" />
        <ul className="space-y-3 md:hidden">
          {ledger.map((l) => (
            <li key={l.id} className="rounded-2xl bg-secondary/70 p-4">
              <div className="flex items-center gap-3">
                <Avatar name={l.name} tone={l.tone} size="sm" />
                <div className="min-w-0 flex-1"><p className="truncate font-semibold">{l.name}</p><p className="text-xs text-muted-foreground">{l.meals} meals</p></div>
                <div className="text-right"><p className="text-lg font-extrabold"><Money value={l.balance} signed /></p><StatusBadge status={l.balance < 0 ? "Overdue" : "Credit"} /></div>
              </div>
              <dl className="mt-3 grid grid-cols-4 gap-2 border-t pt-3 text-xs">
                {[["Meal cost", l.mealCost], ["Shared", l.shared], ["Due", l.due], ["Paid", l.deposits]].map(([k, v]) => (
                  <div key={k as string} className="min-w-0"><dt className="text-muted-foreground">{k}</dt><dd className="truncate font-semibold"><Money value={v as number} /></dd></div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground">{["Member", "Meals", "Meal cost", "Shared", "Total due", "Deposited", "Balance", ""].map((h) => <th key={h} className="pb-3 font-semibold">{h}</th>)}</tr></thead>
            <tbody className="divide-y">
              {ledger.map((l) => (
                <tr key={l.id}>
                  <td className="py-3"><div className="flex items-center gap-2"><Avatar name={l.name} tone={l.tone} size="sm" /><span className="font-semibold">{l.name}</span></div></td>
                  <td>{l.meals}</td><td><Money value={l.mealCost} /></td><td><Money value={l.shared} /></td>
                  <td className="font-semibold"><Money value={l.due} /></td><td><Money value={l.deposits} /></td>
                  <td><Money value={l.balance} signed /></td>
                  <td><StatusBadge status={l.balance < 0 ? "Overdue" : "Credit"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
