import Link from "next/link";
import { listTasks } from "@/store/db";
import { TaskCard } from "@/components/TaskCard";
import { WorklistControls } from "@/components/WorklistControls";
import { RefreshButton } from "@/components/RefreshButton";
import { functionLabel } from "@/lib/format";
import { currentPlaceId } from "@/lib/session";
import type { Task } from "@/domain/types";

export const dynamic = "force-dynamic";

const STATUS_FILTERS = ["all", "open", "in_progress", "blocked", "done"] as const;

export default async function WorklistPage(props: {
  searchParams: Promise<{ fn?: string; status?: string; overdue?: string }>;
}) {
  const { fn = "all", status = "all", overdue } = await props.searchParams;
  const all = await listTasks(await currentPlaceId());
  const now = Date.now();

  const live = all.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const isOverdue = (t: Task) => t.status !== "done" && t.status !== "cancelled" && now > Date.parse(t.dueAt);

  let filtered = all;
  if (status === "all") filtered = filtered.filter((t) => t.status !== "done" && t.status !== "cancelled");
  else filtered = filtered.filter((t) => t.status === status);
  if (fn !== "all") filtered = filtered.filter((t) => t.owner.functionArea === fn);
  if (overdue === "1") filtered = filtered.filter(isOverdue);

  const functions = [...new Set(all.map((t) => t.owner.functionArea))].sort();
  const groups = new Map<string, Task[]>();
  for (const t of [...filtered].sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))) {
    const key = t.owner.functionArea;
    const arr = groups.get(key);
    if (arr) arr.push(t);
    else groups.set(key, [t]);
  }

  const overdueCount = live.filter(isOverdue).length;
  const escalatedCount = live.filter((t) => t.escalationLevel > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">Worklist</h1>
          <p className="mt-1 text-sm text-slate">
            {live.length} task{live.length === 1 ? "" : "s"} in flight across the place — {overdueCount} overdue,{" "}
            {escalatedCount} escalated. Each was dispatched when a coordinator approved a recommendation.
          </p>
        </div>
        <div className="flex gap-2">
          <RefreshButton />
          <WorklistControls />
        </div>
      </div>

      {all.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-muted">
          No tasks yet. Approve a recommendation on the{" "}
          <Link href="/queue" className="text-teal hover:underline">
            attention queue
          </Link>{" "}
          to dispatch one.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap rounded-lg border border-line bg-white p-0.5">
              <Link
                href={`/worklist?status=all&fn=${fn}`}
                className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${status === "all" ? "bg-teal text-white" : "text-slate hover:bg-mist"}`}
              >
                In flight ({live.length})
              </Link>
              {STATUS_FILTERS.slice(1).map((s) => (
                <Link
                  key={s}
                  href={`/worklist?status=${s}&fn=${fn}`}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-semibold capitalize ${status === s ? "bg-ink text-white" : "text-slate hover:bg-mist"}`}
                >
                  {s.replace("_", " ")}
                </Link>
              ))}
            </div>
            <Link
              href={`/worklist?status=${status}&fn=${fn}&overdue=${overdue === "1" ? "" : "1"}`}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${overdue === "1" ? "border-amber bg-amber text-white" : "border-line bg-white text-slate hover:bg-mist"}`}
            >
              Overdue only
            </Link>
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs">
            <Link
              href={`/worklist?status=${status}&fn=all`}
              className={`rounded-full px-2.5 py-1 font-semibold ${fn === "all" ? "bg-ink text-white" : "bg-white text-slate ring-1 ring-inset ring-line hover:bg-mist"}`}
            >
              All teams
            </Link>
            {functions.map((f) => (
              <Link
                key={f}
                href={`/worklist?status=${status}&fn=${f}`}
                className={`rounded-full px-2.5 py-1 font-semibold ${fn === f ? "bg-ink text-white" : "bg-white text-slate ring-1 ring-inset ring-line hover:bg-mist"}`}
              >
                {functionLabel(f)}
              </Link>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="card p-8 text-center text-sm text-slate-muted">No tasks match this filter.</div>
          ) : (
            <div className="space-y-6">
              {[...groups.entries()].map(([key, tasks]) => (
                <section key={key}>
                  <h2 className="label mb-2">
                    {functionLabel(key)} · {tasks.length}
                  </h2>
                  <ul className="space-y-3">
                    {tasks.map((t) => (
                      <li key={t.id}>
                        <TaskCard task={t} now={now} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
