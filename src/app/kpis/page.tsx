import { getState } from "@/store/db";
import { computeKpis } from "@/engine/kpis";
import { patternLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function KpisPage() {
  const state = await getState();
  const kpis = computeKpis(state);

  const byPattern = new Map<string, { total: number; closed: number }>();
  for (const e of state.exceptions) {
    const row = byPattern.get(e.pattern) ?? { total: 0, closed: 0 };
    row.total += 1;
    if (e.status === "closed") row.closed += 1;
    byPattern.set(e.pattern, row);
  }

  const measured = kpis.filter((k) => k.basis === "measured");
  const estimated = kpis.filter((k) => k.basis === "estimated");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">Impact</h1>
        <p className="mt-1 text-sm text-slate">
          Measurement is built into the product. Figures are split into what this system can{" "}
          <span className="font-semibold text-teal">measure</span> from its own events and what is only an{" "}
          <span className="font-semibold text-amber">estimate</span> using a stated assumption.
        </p>
      </div>

      <section>
        <h2 className="label">Measured</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {measured.map((k) => (
            <div key={k.key} className="card p-4">
              <p className="text-sm font-medium text-slate-muted">{k.label}</p>
              <p className="mt-1 text-3xl font-bold text-ink">{k.value}</p>
              <p className="mt-1 text-xs text-slate-muted">{k.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="label">Estimated — illustrative, to be validated with a design partner</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {estimated.map((k) => (
            <div key={k.key} className="card border-amber-soft p-4">
              <p className="text-sm font-medium text-slate-muted">{k.label}</p>
              <p className="mt-1 text-3xl font-bold text-amber">{k.value}</p>
              <p className="mt-1 text-xs text-slate-muted">{k.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-4">
        <h2 className="text-sm font-bold text-ink">Coordination failures by type</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-muted">
              <th className="pb-2 font-medium">Pattern</th>
              <th className="pb-2 font-medium">Detected</th>
              <th className="pb-2 font-medium">Resolved</th>
            </tr>
          </thead>
          <tbody>
            {[...byPattern.entries()].map(([pattern, row]) => (
              <tr key={pattern} className="border-t border-line">
                <td className="py-2 text-ink">{patternLabel(pattern)}</td>
                <td className="py-2 text-slate">{row.total}</td>
                <td className="py-2 text-slate">{row.closed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
