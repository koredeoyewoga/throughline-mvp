import type { Kpi } from "@/domain/types";

export function KpiStrip({ kpis }: { kpis: Kpi[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {kpis.slice(0, 4).map((k) => (
        <div key={k.key} className="card p-3">
          <dt className="text-xs font-medium text-slate-muted">{k.label}</dt>
          <dd className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">{k.value}</span>
            <span
              className={`pill ${k.basis === "measured" ? "bg-teal-soft text-teal" : "bg-amber-soft text-amber"}`}
              title={k.note}
            >
              {k.basis}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
