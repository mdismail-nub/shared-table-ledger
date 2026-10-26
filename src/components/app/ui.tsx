import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  primary: "bg-primary-soft text-primary",
  mint: "bg-mint text-mint-foreground",
  peach: "bg-peach text-peach-foreground",
  lime: "bg-lime/40 text-lime-foreground",
  cyan: "bg-cyan-soft text-foreground",
  neutral: "bg-secondary text-foreground",
} as const;
export type Tone = keyof typeof tones;

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("glass rounded-3xl p-4 sm:p-5", className)}>{children}</section>;
}

export function PanelHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-base font-bold">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageIntro({ title, subtitle, actions }: { title: string; subtitle: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-2xl font-extrabold sm:text-3xl">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, tone = "primary", delta, hint }: {
  label: string; value: string; icon: LucideIcon; tone?: Tone; delta?: number; hint?: string;
}) {
  return (
    <div className={cn("rounded-2xl p-4 transition-transform hover:-translate-y-0.5", tones[tone])}>
      <div className="flex items-center justify-between">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-card/70"><Icon className="h-[18px] w-[18px]" /></span>
        {delta !== undefined && (
          <span className="flex items-center gap-1 text-xs font-semibold">
            {delta >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <p className="mt-4 text-xs font-medium text-foreground/70">{label}</p>
      <p className="mt-0.5 text-2xl font-extrabold tracking-tight text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-foreground/60">{hint}</p>}
    </div>
  );
}

const statusStyles = {
  Paid: "bg-mint text-mint-foreground",
  Settled: "bg-secondary text-foreground",
  Pending: "bg-warning-soft text-peach-foreground",
  Overdue: "bg-destructive-soft text-destructive",
  Credit: "bg-primary-soft text-primary",
  Active: "bg-mint text-mint-foreground",
  New: "bg-cyan-soft text-foreground",
  Left: "bg-secondary text-muted-foreground",
  Meal: "bg-mint text-mint-foreground",
  Household: "bg-peach text-peach-foreground",
} as const;
export type Status = keyof typeof statusStyles;

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", statusStyles[status], className)}>{status}</span>;
}

export function Avatar({ name, tone = "primary", size = "md" }: { name: string; tone?: Tone; size?: "sm" | "md" | "lg" }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full font-bold", tones[tone],
      size === "sm" && "h-8 w-8 text-xs", size === "md" && "h-10 w-10 text-sm", size === "lg" && "h-16 w-16 text-xl")}>
      {initials}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card px-6 py-12 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary"><Icon className="h-6 w-6" /></span>
      <p className="mt-4 font-bold">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Money({ value, signed }: { value: number; signed?: boolean }) {
  const s = `৳${Math.abs(value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  if (!signed) return <>{s}</>;
  return <span className={cn("font-semibold", value < 0 ? "text-destructive" : value > 0 ? "text-success" : "text-muted-foreground")}>{value < 0 ? "−" : value > 0 ? "+" : ""}{s}</span>;
}
