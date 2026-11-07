import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownLeft, PiggyBank, Plus, Wallet, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, Money, PageIntro, Panel, PanelHeader, StatCard, StatusBadge } from "@/components/app/ui";
import { AddDepositDialog } from "@/components/app/dialogs";
import { depositTotal, deposits, ledger, memberById, outstanding } from "@/lib/mock-data";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/_authenticated/deposits")({
  head: () => pageMeta("Deposits", "Deposits, withdrawals and payment history."),
  component: Page,
});

function Page() {
  const byMethod = deposits.reduce<Record<string, number>>((a, d) => ((a[d.method] = (a[d.method] ?? 0) + d.amount), a), {});
  return (
    <div className="space-y-6">
      <PageIntro title="Deposits" subtitle="Who paid, how much and how." actions={<AddDepositDialog trigger={<Button><Plus /> Add deposit</Button>} />} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total collected" value={`৳${depositTotal.toLocaleString("en-IN")}`} icon={PiggyBank} tone="mint" />
        <StatCard label="Outstanding" value={`৳${Math.abs(Math.round(outstanding)).toLocaleString("en-IN")}`} icon={AlertCircle} tone="peach" />
        <StatCard label="Transactions" value={String(deposits.length)} icon={Wallet} tone="primary" />
        <StatCard label="Members owing" value={String(ledger.filter((l) => l.balance < 0).length)} icon={ArrowDownLeft} tone="lime" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Panel>
          <PanelHeader title="Payment history" subtitle="October 2026" />
          <ul className="divide-y">
            {deposits.map((d) => { const m = memberById(d.memberId); return (
              <li key={d.id} className="flex items-center gap-3 py-3">
                <Avatar name={m.name} tone={m.tone} size="sm" />
                <div className="min-w-0 flex-1"><p className="truncate font-semibold">{m.name}</p><p className="text-xs text-muted-foreground">{d.date.slice(5)} · {d.method}</p></div>
                <StatusBadge status={d.kind === "Advance" ? "Credit" : "Paid"} />
                <p className="w-20 text-right font-bold text-success">+<Money value={d.amount} /></p>
              </li>); })}
          </ul>
        </Panel>
        <div className="space-y-6">
          <Panel>
            <PanelHeader title="By payment method" />
            <div className="space-y-3">
              {Object.entries(byMethod).map(([k, v]) => (
                <div key={k}><div className="mb-1 flex justify-between text-sm"><span className="font-medium">{k}</span><span className="font-bold"><Money value={v} /></span></div>
                  <div className="h-2 rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${(v / depositTotal) * 100}%` }} /></div></div>
              ))}
            </div>
          </Panel>
          <Panel>
            <PanelHeader title="Still owing" subtitle="Remind these members" />
            <ul className="space-y-2">
              {ledger.filter((l) => l.balance < 0).map((l) => (
                <li key={l.id} className="flex items-center justify-between rounded-xl bg-destructive-soft px-3 py-2"><span className="text-sm font-semibold">{l.name}</span><Money value={l.balance} signed /></li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
