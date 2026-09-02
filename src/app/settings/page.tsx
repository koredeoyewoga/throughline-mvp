import { getConfigWithErrors } from "@/config";
import { DEFAULT_CONFIG } from "@/config/schema";
import { slaRows } from "@/config/apply";
import { PATHWAYS } from "@/domain/pathways";
import { ConfigForm } from "@/components/ConfigForm";
import { currentRole } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const role = await currentRole();
  const { config } = getConfigWithErrors();
  const rows = slaRows(PATHWAYS, config);

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

      <ConfigForm config={config} defaults={DEFAULT_CONFIG} slaRows={rows} />
    </div>
  );
}
