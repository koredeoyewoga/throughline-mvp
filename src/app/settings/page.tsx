import { getConfigWithErrors } from "@/config";
import { DEFAULT_CONFIG } from "@/config/schema";
import { slaRows } from "@/config/apply";
import { PATHWAYS } from "@/domain/pathways";
import { ConfigForm } from "@/components/ConfigForm";
import { IngestButton } from "@/components/IngestButton";
import { currentRole } from "@/lib/session";
import { getState } from "@/store/db";
import { describeSource } from "@/adapters";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const role = await currentRole();
  const { config } = getConfigWithErrors();
  const rows = slaRows(PATHWAYS, config);
  const state = await getState();
  const source = describeSource(state);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">Place configuration</h1>
        <p className="mt-1 text-sm text-slate">
          The operating knobs a place or ICB tunes to match its own procedures — pathway SLAs, when each failure
          pattern flags, how items are prioritised, and the KPI assumptions. Saving re-runs detection immediately.
          {role !== "oversight" && (
            <> This screen is intended for a place oversight role; you are viewing as a coordinator.</>
          )}
        </p>
        <p className="mt-1 text-xs text-slate-muted">
          In this MVP the config is stored in <code>.data/config.json</code> and applies to everyone. In production it
          would be per place with an approval trail.
        </p>
      </div>

      <section className="card p-4">
        <h2 className="text-sm font-bold text-ink">Data source</h2>
        <p className="mt-1 text-xs text-slate-muted">
          Where events are ingested from. The MVP boots from the synthetic seed; set{" "}
          <code>THROUGHLINE_SOURCE</code> to <code>fhir</code>, <code>ers</code> or <code>toc</code> to pull from an
          adapter. Adapters are read-only — nothing is written back to a source system.
        </p>
        <dl className="mt-3 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-xs">
          <dt className="text-slate-muted">Adapter</dt>
          <dd className="font-medium text-ink">{source.name}</dd>
          <dt className="text-slate-muted">State</dt>
          <dd className={source.configured ? "text-ink" : "text-amber"}>
            {source.configured ? "configured" : "not configured"} — {source.detail}
          </dd>
          <dt className="text-slate-muted">Events held</dt>
          <dd className="text-ink">{state.events.length}</dd>
          <dt className="text-slate-muted">Last pull</dt>
          <dd className="text-ink">{state.lastIngestAt ? new Date(state.lastIngestAt).toLocaleString() : "—"}</dd>
        </dl>
        <div className="mt-3">
          <IngestButton disabled={source.name === "synthetic"} />
        </div>
      </section>

      <ConfigForm config={config} defaults={DEFAULT_CONFIG} slaRows={rows} />
    </div>
  );
}
