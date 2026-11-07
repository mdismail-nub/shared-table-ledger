import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Suspense, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  UtensilsCrossed,
  ShoppingBasket,
  Wallet,
  Calculator,
  FileBarChart,
  Settings,
  LogOut,
  MoreHorizontal,
} from "lucide-react";
import { APP_LOGO } from "@/lib/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  MonthContext,
  useMonth,
  currentMonth,
  recentMonths,
  monthLabel,
  signOut,
} from "@/lib/data";
import { useWorkspace } from "@/lib/workspace";
import { NotificationDrawer } from "@/components/app/notification-dialog";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/members", label: "Members", icon: Users },
  { to: "/meals", label: "Meals", icon: UtensilsCrossed },
  { to: "/expenses", label: "Expenses", icon: ShoppingBasket },
  { to: "/deposits", label: "Payments", icon: Wallet },
  { to: "/accounts", label: "Monthly Accounts", icon: Calculator },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [month, setMonth] = useState(currentMonth());
  if (path === "/" || path === "/auth" || path.startsWith("/join")) return children;
  return (
    <MonthContext.Provider value={{ month, setMonth }}>
      <Suspense
        fallback={
          <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
            Loading your mess…
          </div>
        }
      >
        <WorkspaceShell>{children}</WorkspaceShell>
      </Suspense>
    </MonthContext.Provider>
  );
}

function WorkspaceShell({ children }: { children: ReactNode }) {
  const w = useWorkspace();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [more, setMore] = useState(false);
  const months = recentMonths();
  const { setMonth } = useMonth();
  const active = (to: string) => path === to;
  const label = (n: (typeof nav)[number]) =>
    !w.isAdmin && n.to === "/settings"
      ? "Mess info"
      : !w.isAdmin && n.to === "/accounts"
        ? "My account"
        : !w.isAdmin && n.to === "/deposits"
          ? "My payments"
          : n.label;

  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-sidebar p-5 lg:flex">
        <Link to="/dashboard" className="flex items-center gap-3">
          <img
            src={APP_LOGO}
            className="h-10 w-10 rounded-xl object-cover shadow-xs"
            alt="Mess Manager"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/logo.png";
            }}
          />
          <span className="font-extrabold">Mess Manager</span>
        </Link>
        <p className="mt-6 truncate text-xs font-semibold text-muted-foreground">{w.mess?.name}</p>
        <nav className="mt-4 flex-1 space-y-1">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-muted-foreground hover:bg-secondary",
                active(n.to) && "bg-accent text-accent-foreground",
              )}
            >
              <n.icon className="h-4 w-4" />
              {label(n)}
            </Link>
          ))}
        </nav>
        <div className="rounded-2xl bg-lime p-4">
          <p className="text-xs font-semibold">Around your table</p>
          <p className="mt-2 text-2xl font-extrabold">{w.summary.active_members} housemates</p>
          {!w.isAdmin && (
            <span className="mt-2 inline-block rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-bold text-foreground">
              👁️ View-Only Mode
            </span>
          )}
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-7">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={APP_LOGO}
                className="h-9 w-9 rounded-xl object-cover lg:hidden"
                alt="Mess Manager"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = "/logo.png";
                }}
              />
              <div className="min-w-0">
                <h1 className="truncate font-bold sm:text-lg">
                  {nav.find((n) => active(n.to))?.label ?? "Mess Manager"}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {w.isAdmin ? "Admin" : "Member (View-Only)"} · {w.own?.name ?? "Housemate"}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <NotificationDrawer />
              <select
                aria-label="Accounting month"
                value={w.month}
                onChange={(e) => {
                  setMonth(e.target.value);
                }}
                className="h-10 max-w-36 rounded-xl border bg-card px-2 text-xs sm:max-w-none sm:text-sm"
              >
                {months.map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </select>
              <Button
                variant="ghost"
                size="icon"
                aria-label={w.isAdmin ? "Sign out" : "Exit mess"}
                title={w.isAdmin ? "Sign out" : "Exit mess"}
                onClick={async () => {
                  await signOut(qc);
                  navigate({ to: "/", replace: true });
                }}
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-7 lg:pb-10">{children}</main>
      </div>
      <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-2xl border bg-card/95 p-1.5 shadow-card backdrop-blur-xl lg:hidden">
        {nav.slice(0, 4).map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold text-muted-foreground",
              active(n.to) && "bg-accent text-accent-foreground",
            )}
          >
            <n.icon className="h-5 w-5" />
            {n.label}
          </Link>
        ))}
        <Button
          variant="ghost"
          className="h-auto flex-col gap-1 py-2 text-[10px]"
          onClick={() => setMore(true)}
        >
          <MoreHorizontal />
          More
        </Button>
      </nav>
      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Your mess</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-3 p-4">
            {nav.slice(4).map((n) => (
              <Button asChild key={n.to} variant="outline">
                <Link to={n.to} onClick={() => setMore(false)}>
                  <n.icon />
                  {label(n)}
                </Link>
              </Button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
