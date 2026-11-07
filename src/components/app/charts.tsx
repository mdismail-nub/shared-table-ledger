import type { ReactNode } from "react";
import { BarChart3 } from "lucide-react";

export const chartColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--muted-foreground)",
];

export const shortTaka = (v: number) =>
  Math.abs(v) >= 1000 ? `৳${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `৳${Math.round(v)}`;
const fullTaka = (v: number) => `৳${Math.round(v).toLocaleString("en-IN")}`;

type P = {
  active?: boolean;
  label?: string | number;
  payload?: {
    name?: string;
    value?: number;
    color?: string;
    fill?: string;
    payload?: { fill?: string };
  }[];
};

/** Friendly tooltip: title, coloured dots, ৳ amounts and an optional total. */
export function ChartTip({
  active,
  payload,
  label,
  unit = "money",
  labelPrefix = "",
  total,
}: P & { unit?: "money" | "count"; labelPrefix?: string; total?: boolean }) {
  if (!active || !payload?.length) return null;
  const fmt = (v: number) => (unit === "money" ? fullTaka(v) : `${v} meals`);
  const sum = payload.reduce((s, p) => s + Number(p.value ?? 0), 0);
  return (
    <div className="glass min-w-36 rounded-xl px-3 py-2 text-xs shadow-card">
      {label !== undefined && label !== "" && (
        <p className="mb-1.5 font-bold">
          {labelPrefix}
          {label}
        </p>
      )}
      <ul className="space-y-1">
        {payload.map((p, i) => (
          <li key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: p.color ?? p.fill ?? p.payload?.fill }}
              />
              {p.name}
            </span>
            <span className="font-semibold">{fmt(Number(p.value ?? 0))}</span>
          </li>
        ))}
      </ul>
      {total && payload.length > 1 && (
        <p className="mt-1.5 flex justify-between border-t pt-1.5 font-bold">
          <span>Total</span>
          <span>{fmt(sum)}</span>
        </p>
      )}
    </div>
  );
}

/** Clickable-looking legend chips shown above charts. */
export function Legend({ items }: { items: { label: string; color: string; value?: string }[] }) {
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {items.map((i) => (
        <span
          key={i.label}
          className="flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium"
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: i.color }} />
          {i.label}
          {i.value && <b className="ml-0.5">{i.value}</b>}
        </span>
      ))}
    </div>
  );
}

export function ChartEmpty({
  text = "No data for this month yet",
  h = "h-56",
}: {
  text?: string;
  h?: string;
}) {
  return (
    <div
      className={`grid ${h} place-items-center rounded-2xl border border-dashed text-center text-sm text-muted-foreground`}
    >
      <div>
        <BarChart3 className="mx-auto mb-2 h-6 w-6 opacity-60" />
        {text}
      </div>
    </div>
  );
}

export const axis = {
  tickLine: false,
  axisLine: false,
  fontSize: 11,
  stroke: "var(--muted-foreground)",
} as const;

export function Skeleton({ className = "h-24" }: { className?: string }): ReactNode {
  return <div className={`animate-pulse rounded-2xl bg-secondary ${className}`} />;
}
