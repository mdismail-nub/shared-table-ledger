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
  shortMonthYear,
  signOut,
} from "@/lib/data";
import { useWorkspace } from "@/lib/workspace";
import { NotificationDrawer } from "@/components/app/notification-dialog";
import { usePwa } from "@/lib/pwa";
import { useOnlineStatus } from "@/lib/offline-sync";
import { Download, WifiOff, RefreshCw, Sparkles } from "lucide-react";
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
  const pwa = usePwa();
  const online = useOnlineStatus();
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
        {pwa.isInstallable && !pwa.isStandalone && (
          <div className="mb-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => pwa.promptInstall()}
              className="w-full justify-start gap-2 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 font-bold"
            >
              <Download className="h-4 w-4" />
              Install App
            </Button>
          </div>
        )}
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
        {pwa.hasUpdate && (
          <div className="bg-primary px-4 py-2 text-center text-xs font-semibold text-primary-foreground flex items-center justify-center gap-2">
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            <span>A new version of Mess Manager is ready.</span>
            <button
              onClick={() => pwa.updateApp()}
              className="ml-2 rounded-lg bg-white/20 px-2.5 py-1 text-xs font-bold hover:bg-white/30"
            >
              Update Now
            </button>
          </div>
        )}
        {!online.isOnline && (
          <div className="bg-amber-500/15 border-b border-amber-500/20 px-4 py-2 text-center text-xs font-medium text-amber-800 dark:text-amber-200 flex flex-wrap items-center justify-center gap-2">
            <WifiOff className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span>
              You're currently offline. You can keep adding meals, expenses & payments — changes
              sync automatically when reconnected.
            </span>
            {online.pendingCount > 0 && (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:text-amber-100">
                {online.pendingCount} pending sync
              </span>
            )}
          </div>
        )}
        <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:px-7 sm:py-4">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <img
                src={APP_LOGO}
                className="h-8 w-8 rounded-xl object-cover lg:hidden shrink-0"
                alt="Mess Manager"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = "/logo.png";
                }}
              />
              <div className="min-w-0">
                <h1 className="truncate text-sm font-bold sm:text-lg">
                  {nav.find((n) => active(n.to))?.label ?? "Mess Manager"}
                </h1>
                <p className="truncate text-[10px] text-muted-foreground sm:text-xs">
                  {w.isAdmin ? "Admin" : "Member (View-Only)"} · {w.own?.name ?? "Housemate"}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              {!online.isOnline && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300 sm:px-2.5 sm:py-1 sm:text-xs"
                  title="Offline Mode"
                >
                  <WifiOff className="h-3 w-3" />
                  <span className="hidden sm:inline">Offline</span>
                </span>
              )}
              {online.isOnline && online.pendingCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => online.syncNow()}
                  disabled={online.isSyncing}
                  className="h-8 gap-1 bg-amber-500/10 px-2 text-[11px] font-medium text-amber-700 hover:bg-amber-500/20 sm:h-9 sm:gap-1.5 sm:text-xs"
                  title="Click to sync pending changes now"
                >
                  <RefreshCw
                    className={cn("h-3 w-3 sm:h-3.5 sm:w-3.5", online.isSyncing && "animate-spin")}
                  />
                  <span>{online.isSyncing ? "Syncing..." : `${online.pendingCount} pending`}</span>
                </Button>
              )}
              {pwa.isInstallable && !pwa.isStandalone && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => pwa.promptInstall()}
                  className="hidden sm:inline-flex h-9 gap-1.5 border-primary/30 text-xs font-semibold text-primary hover:bg-primary/5"
                  title="Install Mess Manager as an app"
                >
                  <Download className="h-3.5 w-3.5" />
                  Install App
                </Button>
              )}
              <NotificationDrawer />
              <select
                aria-label="Accounting month"
                value={w.month}
                onChange={(e) => {
                  setMonth(e.target.value);
                }}
                className="h-8 max-w-[90px] rounded-xl border bg-card px-1.5 text-[11px] sm:h-10 sm:max-w-36 sm:px-2 sm:text-sm"
              >
                {months.map((m) => (
                  <option key={m} value={m}>
                    {shortMonthYear(m)}
                  </option>
                ))}
              </select>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 sm:h-9 sm:w-9"
                aria-label={w.isAdmin ? "Sign out" : "Exit mess"}
                title={w.isAdmin ? "Sign out" : "Exit mess"}
                onClick={async () => {
                  await signOut(qc);
                  navigate({ to: "/", replace: true });
                }}
              >
                <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl min-w-0 px-3 pb-28 pt-4 sm:px-7 sm:pt-6 lg:pb-10">
          {children}
        </main>
      </div>
      <nav className="fixed inset-x-2 bottom-2 z-40 grid grid-cols-5 rounded-2xl border bg-card/95 p-1 shadow-card backdrop-blur-xl sm:inset-x-3 sm:bottom-3 sm:p-1.5 lg:hidden">
        {nav.slice(0, 4).map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl px-0.5 py-1.5 text-[9px] font-semibold text-muted-foreground sm:py-2 sm:text-[10px]",
              active(n.to) && "bg-accent text-accent-foreground",
            )}
          >
            <n.icon className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
            <span className="truncate max-w-full">{label(n)}</span>
          </Link>
        ))}
        <Button
          variant="ghost"
          className="h-auto flex-col gap-1 px-0.5 py-1.5 text-[9px] sm:py-2 sm:text-[10px]"
          onClick={() => setMore(true)}
        >
          <MoreHorizontal className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
          <span className="truncate max-w-full">More</span>
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
