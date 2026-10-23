import { createFileRoute, Link } from "@tanstack/react-router";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, ArrowUpRight, Calculator, Home, PiggyBank, Plus, Receipt, ShoppingBasket, SlidersHorizontal, UtensilsCrossed, Wallet, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, Money, Panel, PanelHeader, StatCard } from "@/components/app/ui";
import { AddDepositDialog, AddExpenseDialog } from "@/components/app/dialogs";
import { activity, categoryBreakdown, dailySpend, depositTotal, foodTotal, householdTotal, memberById, monthlyTrend, outstanding, rate, totalMeals } from "@/lib/mock-data";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/")({
  head: () => pageMeta("Dashboard", "This month's meals, bazar, deposits and balances at a glance."),
  component: Dashboard,
});

const chartColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--muted-foreground)"];
const activityIcon = { bazar: ShoppingBasket, deposit: Wallet, meal: UtensilsCrossed, bill: Receipt, adjust: SlidersHorizontal };
const tooltipStyle = { borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12 };

function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-ink p-6 text-ink-foreground sm:p-8">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand-gradient opacity-60 blur-3xl" />
        <div className="relative grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-end">
          <div>
            <p className="text-sm font-medium opacity-70">Good afternoon, Ismail 👋</p>
            <h2 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">Today's meal rate is <span className="text-lime">৳{rate.toFixed(2)}</span></h2>
            <p className="mt-2 max-w-md text-sm opacity-70">Calculated from ৳{foodTotal.toLocaleString("en-IN")} food expenses across {totalMeals} meals. Household bills are kept separate.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild variant="default"><Link to="/meals"><UtensilsCrossed /> Record meals</Link></Button>
              <AddExpenseDialog trigger={<Button variant="lime"><Plus /> Add expense</Button>} />
              <AddDepositDialog trigger={<Button variant="outline" className="border-ink-foreground/20 bg-ink-foreground/10 text-ink-foreground hover:bg-ink-foreground/20"><Wallet /> Add deposit</Button>} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-ink-foreground/10 p-4"><p className="text-xs opacity-70">Collected</p><p className="text-xl font-bold">৳{depositTotal.toLocaleString("en-IN")}</p></div>
            <div className="rounded-2xl bg-ink-foreground/10 p-4"><p className="text-xs opacity-70">Outstanding</p><p className="text-xl font-bold text-peach">৳{Math.abs(outstanding).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p></div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total expenses" value={`৳${(foodTotal + householdTotal).toLocaleString("en-IN")}`} icon={Receipt} tone="primary" delta={6} />
        <StatCard label="Total meals" value={String(totalMeals)} icon={UtensilsCrossed} tone="mint" delta={12} />
        <StatCard label="Meal rate" value={`৳${rate.toFixed(2)}`} icon={Calculator} tone="cyan" delta={-3} />
        <StatCard label="Deposits" value={`৳${depositTotal.toLocaleString("en-IN")}`} icon={PiggyBank} tone="lime" delta={15} />
        <StatCard label="Household bills" value={`৳${householdTotal.toLocaleString("en-IN")}`} icon={Home} tone="peach" delta={4} />
        <StatCard label="Outstanding dues" value={`৳${Math.abs(outstanding).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`} icon={AlertCircle} tone="neutral" hint="2 members owe" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader title="Daily spending" subtitle="Food vs household, October" />
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={dailySpend} margin={{ left: -20, right: 4 }}>
                <defs>
                  <linearGradient id="gFood" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" />
                <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="food" name="Food" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#gFood)" />
                <Area type="monotone" dataKey="household" name="Household" stroke="var(--chart-4)" strokeWidth={2} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Category breakdown" subtitle="Where the money went" />
          <div className="mx-auto h-44 w-44">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={categoryBreakdown.slice(0, 6)} dataKey="value" innerRadius={52} outerRadius={80} paddingAngle={3} stroke="none">
                  {categoryBreakdown.slice(0, 6).map((_, i) => <Cell key={i} fill={chartColors[i]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-4 space-y-2">
            {categoryBreakdown.slice(0, 6).map((c, i) => (
              <li key={c.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: chartColors[i] }} />{c.name}</span>
                <span className="font-semibold">৳{c.value.toLocaleString("en-IN")}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader title="Deposits vs expenses" subtitle="Last 6 months" />
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={monthlyTrend} margin={{ left: -16 }} barGap={4}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" />
                <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--secondary)" }} />
                <Bar dataKey="deposits" name="Deposits" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="food" name="Food" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="household" name="Household" fill="var(--chart-3)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Recent activity" action={<Link to="/reports" className="text-xs font-semibold text-primary">View all</Link>} />
          <ul className="space-y-1">
            {activity.map((a) => {
              const Icon = activityIcon[a.kind];
              const m = memberById(a.memberId);
              return (
                <li key={a.id} className="flex items-center gap-3 rounded-xl p-2 hover:bg-secondary">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{a.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.name} · {a.date}</p>
                  </div>
                  {a.amount && <span className="text-sm font-bold">{a.kind === "deposit" ? "+" : ""}<Money value={a.amount} /></span>}
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <Link to="/accounts" className="group flex items-center justify-between rounded-2xl bg-lime p-5 text-lime-foreground">
        <div className="flex items-center gap-3"><Avatar name="M M" tone="neutral" /><div><p className="font-bold">Month-end is coming up</p><p className="text-sm opacity-80">Review balances before closing October.</p></div></div>
        <span className="flex items-center gap-1 text-sm font-bold">Open <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /><ArrowUpRight className="hidden" /></span>
      </Link>
    </div>
  );
}
