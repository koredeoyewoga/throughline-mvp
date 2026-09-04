import Link from "next/link";
import { listBlockers, listTasks } from "@/store/db";
import { BlockerStatusBadge } from "@/components/Badge";
import { blockerCategoryLabel, realSince, patternLabel } from "@/lib/format";
import { currentPlaceId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function BlockersPage() {
  const placeId = await currentPlaceId();
  const [blockers, tasks] = await Promise.all([listBlockers(placeId), listTasks(placeId)]);
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  const open = blockers.filter((b) => b.status !== "resolved").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const resolved = blockers
    .filter((b) => b.status === "resolved")
    .sort((a, b) => (b.resolvedAt ?? "").localeCompare(a.resolvedAt ?? ""));

  function targetHref(b: (typeof blockers)[number]): string {
    if (b.taskId) return `/worklist/${b.taskId}`;
    if (b.exceptionId) return `/exceptions/${b.exceptionId}`;
    return "/queue";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">Blockers</h1>
        <p className="mt-1 text-sm text-slate">
          Obstacles a person has named explicitly — {open.length} open, {resolved.length} resolved. Report one from
          any coordination item or task.
        </p>
      </div>

      {blockers.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-muted">
          No blockers reported yet. Open an item on the{" "}
          <Link href="/queue" className="text-teal hover:underline">
            attention queue
          </Link>{" "}
          or the{" "}
          <Link href="/worklist" className="text-teal hover:underline">
            worklist
          </Link>{" "}
          to report one.
        </div>
      ) : (
        <>
          {open.length > 0 && (
            <section className="space-y-3">
              <h2 className="label">Open ({open.length})</h2>
              <ul className="space-y-3">
                {open.map((b) => (
                  <li key={b.id}>
                    <Link href={targetHref(b)} className="card block p-4 transition-shadow hover:shadow-md">
                      <div className="flex flex-wrap items-center gap-2">
                        <BlockerStatusBadge status={b.status} />
                        <span className="pill bg-mist text-slate">{blockerCategoryLabel(b.category)}</span>
                        {b.externalDependency && (
                          <span className="pill bg-white text-slate-muted ring-1 ring-inset ring-line">
                            External: {b.externalDependency}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-2 text-[15px] font-semibold text-ink">{b.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-slate">{b.description}</p>
                      <p className="mt-2 text-xs text-slate-muted">
                        {b.owner.label} · reported by {b.createdBy} {realSince(b.createdAt)}
                        {b.taskId && taskById.get(b.taskId) && <> · {patternLabel(taskById.get(b.taskId)!.pattern)}</>}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {resolved.length > 0 && (
            <section className="space-y-3">
              <h2 className="label">Resolved ({resolved.length})</h2>
              <ul className="space-y-3">
                {resolved.map((b) => (
                  <li key={b.id}>
                    <Link href={targetHref(b)} className="card block p-4 opacity-70 transition-shadow hover:shadow-md hover:opacity-100">
                      <div className="flex flex-wrap items-center gap-2">
                        <BlockerStatusBadge status={b.status} />
                        <span className="pill bg-mist text-slate">{blockerCategoryLabel(b.category)}</span>
                      </div>
                      <h3 className="mt-2 text-[15px] font-semibold text-ink">{b.title}</h3>
                      <p className="mt-2 text-xs text-slate-muted">
                        resolved by {b.resolvedBy} {realSince(b.resolvedAt!)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
