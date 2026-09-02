import Link from "next/link";
import { listExceptions, getState } from "@/store/db";
import { computeKpis } from "@/engine/kpis";
import { ExceptionCard } from "@/components/ExceptionCard";
import { KpiStrip } from "@/components/KpiStrip";
import { RefreshButton } from "@/components/RefreshButton";
import { ResetButton } from "@/components/ResetButton";
import { patternLabel, FAILURE_PATTERNS } from "@/lib/format";
import { getConfig } from "@/config";

export const dynamic = "force-dynamic";

const SEVERITIES = ["all", "high", "medium", "low"] as const;

export default async function QueuePage(props: {
  searchParams: Promise<{ sev?: string; show?: string }>;
}) {
  const { sev = "all", show = "open" } = await props.searchParams;
  const [all, state] = await Promise.all([listExceptions(), getState()]);
  const kpis = computeKpis(state, getConfig().kpi);

  const live = all.filter((e) => e.status !== "closed");
  const closed = all.filter((e) => e.status === "closed");

  const filtered = (show === "closed" ? closed : live).filter((e) => sev === "all" || e.severity === sev);

  const counts = {
    high: live.filter((e) => e.severity === "high").length,
    medium: live.filter((e) => e.severity === "medium").length,
    low: live.filter((e) => e.severity === "low").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">What requires attention now?</h1>
          <p className="mt-1 text-sm text-slate">
            {live.length} coordination {live.length === 1 ? "failure" : "failures"} across the Meadowford place —{" "}
            {counts.high} high, {counts.medium} medium, {counts.low} low. Ranked by a transparent priority score.
          </p>
        </div>
        <div className="flex gap-2">
          <RefreshButton />
          <ResetButton />
        </div>
      </div>

      <KpiStrip kpis={kpis} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-line bg-white p-0.5">
          {(["open", "closed"] as const).map((s) => (
            <Link
              key={s}
              href={`/queue?show=${s}&sev=${sev}`}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                show === s ? "bg-teal text-white" : "text-slate hover:bg-mist"
              }`}
            >
              {s === "open" ? `Needs attention (${live.length})` : `Resolved (${closed.length})`}
            </Link>
          ))}
        </div>
        <div className="flex rounded-lg border border-line bg-white p-0.5">
          {SEVERITIES.map((s) => (
            <Link
              key={s}
              href={`/queue?show=${show}&sev=${s}`}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold capitalize ${
                sev === s ? "bg-ink text-white" : "text-slate hover:bg-mist"
              }`}
            >
              {s}
            </Link>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-muted">
          Nothing here. {show === "open" ? "The queue is clear for this filter." : "No resolved items yet."}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((e) => (
            <li key={e.id}>
              <ExceptionCard exception={e} />
            </li>
          ))}
        </ul>
      )}

      <details className="card p-4 text-sm text-slate">
        <summary className="cursor-pointer font-semibold text-ink">How the queue is built</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Synthetic events from every organisation in the place are ingested and resolved to one patient record.</li>
          <li>A pathway-state model is built: what should happen next on each pathway, and by when.</li>
          <li>
            The Coordination Agent detects {FAILURE_PATTERNS.length} deviation types —{" "}
            {FAILURE_PATTERNS.map(patternLabel).join(", ")}.
          </li>
          <li>Each is scored by a deterministic, fully itemised priority formula (no hidden model in the ranking).</li>
          <li>An explanation and a recommended action are drafted; governance checks run before you see it.</li>
          <li>You approve, amend, reject or escalate. Every decision is recorded in the audit trail.</li>
        </ol>
      </details>
    </div>
  );
}
