import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, UtensilsCrossed, ShoppingBasket, Wallet, Calculator, FileBarChart, Settings, Bell, ChevronDown, MoreHorizontal, CalendarDays,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import logo from "@/assets/logo.png.asset.json";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/members", label: "Members", icon: Users },
  { to: "/meals", label: "Meals", icon: UtensilsCrossed },
  { to: "/expenses", label: "Expenses", icon: ShoppingBasket },
  { to: "/deposits", label: "Deposits", icon: Wallet },
  { to: "/accounts", label: "Monthly Accounts", icon: Calculator },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const months = ["October 2026", "September 2026", "August 2026", "July 2026"];

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="h-9 w-9 shrink-0 overflow-hidden rounded-xl"><img src={logo.url} alt="" className="h-full w-full scale-[1.6] object-cover" /></span>
      <span className="text-lg font-extrabold tracking-tight">Mess Manager</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [more, setMore] = useState(false);
  const [month, setMonth] = useState<string>(months[0]!);
  const active = (to: string) => (to === "/" ? path === "/" : path.startsWith(to));
  const current = nav.find((n) => active(n.to));

  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-sidebar p-4 lg:flex">
        <div className="px-2 py-2"><Brand /></div>
        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
              active(n.to) && "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground",
            )}>
              <n.icon className="h-[18px] w-[18px]" /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="rounded-2xl bg-brand-gradient p-4 text-primary-foreground">
          <p className="text-xs font-medium opacity-80">October closes in</p>
          <p className="mt-1 text-2xl font-bold">8 days</p>
          <Link to="/accounts" className="mt-3 inline-flex rounded-lg bg-card px-3 py-1.5 text-xs font-semibold text-foreground">Review accounts</Link>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
          <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl lg:hidden"><img src={logo.url} alt="Mess Manager" className="h-full w-full scale-[1.6] object-cover" /></div>
              <h1 className="truncate text-lg font-bold sm:text-xl">{current?.label ?? "Mess Manager"}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger className="flex h-10 items-center gap-2 rounded-xl border bg-card px-3 text-sm font-medium">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <span className="hidden sm:inline">{month}</span>
                  <span className="sm:hidden">{month.slice(0, 3)}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {months.map((m) => <DropdownMenuItem key={m} onClick={() => setMonth(m)}>{m}</DropdownMenuItem>)}
                </DropdownMenuContent>
              </DropdownMenu>
              <button aria-label="Notifications" className="relative grid h-10 w-10 place-items-center rounded-xl border bg-card">
                <Bell className="h-4 w-4" />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive" />
              </button>
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">MI</div>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:pb-12">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-2xl border bg-card/95 p-1.5 shadow-card backdrop-blur lg:hidden">
        {nav.slice(0, 4).map((n) => (
          <Link key={n.to} to={n.to} className={cn("flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium text-muted-foreground", active(n.to) && "bg-accent text-accent-foreground")}>
            <n.icon className="h-5 w-5" /> {n.label.split(" ")[0]}
          </Link>
        ))}
        <button onClick={() => setMore(true)} className={cn("flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium text-muted-foreground", nav.slice(4).some((n) => active(n.to)) && "bg-accent text-accent-foreground")}>
          <MoreHorizontal className="h-5 w-5" /> More
        </button>
      </nav>
      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader><SheetTitle>More</SheetTitle></SheetHeader>
          <div className="grid grid-cols-2 gap-2 p-4 pt-0">
            {nav.slice(4).map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setMore(false)} className={cn("flex items-center gap-3 rounded-2xl border p-4 text-sm font-semibold", active(n.to) && "border-primary bg-accent text-accent-foreground")}>
                <n.icon className="h-5 w-5 text-primary" /> {n.label}
              </Link>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
