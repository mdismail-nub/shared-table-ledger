import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Money, PageIntro, Panel, PanelHeader } from "@/components/app/ui";
import { categoryBreakdown, ledger, monthlyTrend } from "@/lib/mock-data";
import { pageMeta } from "@/lib/meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reports")({
  head: () => pageMeta("Reports", "Charts, statements and exports."),
  component: Page,
});

const tip = { borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12 };

function Page() {
  const max = categoryBreakdown[0].value;
  return (
    <div className="space-y-6">
      <PageIntro title="Reports" subtitle="Trends, breakdowns and exports."
        actions={<><Button variant="outline" onClick={() => toast("PDF export started")}><FileText /> PDF</Button><Button variant="outline" onClick={() => toast("Excel export started")}><FileSpreadsheet /> Excel</Button></>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Six-month spending" subtitle="Food vs household" />
          <div className="h-64"><ResponsiveContainer><BarChart data={monthlyTrend}>
            <CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} /><YAxis tickLine={false} axisLine={false} fontSize={12} width={44} />
            <Tooltip contentStyle={tip} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="food" name="Food" fill="var(--chart-1)" radius={[6, 6, 0, 0]} /><Bar dataKey="household" name="Household" fill="var(--chart-4)" radius={[6, 6, 0, 0]} />
          </BarChart></ResponsiveContainer></div>
        </Panel>
        <Panel>
          <PanelHeader title="Deposits trend" subtitle="Money collected per month" />
          <div className="h-64"><ResponsiveContainer><LineChart data={monthlyTrend}>
            <CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} /><YAxis tickLine={false} axisLine={false} fontSize={12} width={44} />
            <Tooltip contentStyle={tip} /><Line dataKey="deposits" name="Deposits" stroke="var(--chart-5)" strokeWidth={3} dot={{ r: 4 }} />
          </LineChart></ResponsiveContainer></div>
        </Panel>
        <Panel>
          <PanelHeader title="Where the money went" subtitle="By category, this month" />
          <div className="space-y-3">
            {categoryBreakdown.map((c) => (
              <div key={c.name}><div className="mb-1 flex justify-between text-sm"><span className="font-medium">{c.name}</span><span className="font-bold"><Money value={c.value} /></span></div>
                <div className="h-2 rounded-full bg-secondary"><div className={cn("h-full rounded-full", c.type === "meal" ? "bg-success" : "bg-warning")} style={{ width: `${(c.value / max) * 100}%` }} /></div></div>
            ))}
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Member summary" subtitle="Ranked by meals eaten" />
          <ol className="space-y-2">
            {[...ledger].sort((a, b) => b.meals - a.meals).map((l, i) => (
              <li key={l.id} className="flex items-center gap-3 rounded-xl bg-secondary px-3 py-2.5">
                <span className="w-5 text-sm font-bold text-muted-foreground">{i + 1}</span>
                <span className="flex-1 font-semibold">{l.name}</span><span className="text-sm text-muted-foreground">{l.meals} meals</span>
                <span className="w-20 text-right text-sm"><Money value={l.balance} signed /></span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </div>
  );
}
