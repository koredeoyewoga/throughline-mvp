import { listAudit } from "@/store/db";
import { realSince } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const audit = await listAudit();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">Audit trail</h1>
        <p className="mt-1 text-sm text-slate">
          Every detection run, decision, amendment and status change. Each decision entry records what the AI
          identified, what it recommended, and what the human decided.
        </p>
      </div>

      <ul className="space-y-2">
        {audit.map((a) => (
          <li key={a.id} className="card p-3 text-sm">
            <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-slate-muted">
              <span className="font-semibold text-ink">{a.actor}</span>
              <span>· {realSince(a.at)}</span>
              <span>· {a.target}</span>
            </div>
            <p className="mt-0.5 text-slate">{a.action}</p>
            {a.context && Object.keys(a.context).length > 0 && (
              <dl className="mt-2 grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">
                {Object.entries(a.context).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="shrink-0 font-medium text-slate-muted">{k}</dt>
                    <dd className="text-ink">{v === null ? "—" : String(v)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
