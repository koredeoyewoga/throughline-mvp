import Link from "next/link";
import { notFound } from "next/navigation";
import { getTask, getState } from "@/store/db";
import { TaskActions } from "@/components/TaskActions";
import { SeverityBadge, TaskStatusBadge, EscalationBadge, OverdueBadge } from "@/components/Badge";
import { patternLabel, realSince, functionLabel, escalationLabel } from "@/lib/format";
import { patientName } from "@/data/patients";
import { currentPlaceId } from "@/lib/session";

export const dynamic = "force-dynamic";

const KIND_ICON: Record<string, string> = {
  created: "▸",
  assigned: "◆",
  status: "●",
  nudge: "→",
  escalate: "▲",
  note: "–",
  reminder: "✎",
};

export default async function TaskPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const [task, state] = await Promise.all([getTask(id, await currentPlaceId()), getState()]);
  if (!task) notFound();

  const exception = state.exceptions.find((e) => e.id === task.exceptionId);
  const now = Date.now();
  const overdue = task.status !== "done" && task.status !== "cancelled" && now > Date.parse(task.dueAt);

  return (
    <div className="space-y-6">
      <Link href="/worklist" className="text-sm font-medium text-teal hover:underline">
        ← Worklist
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={task.priority} />
          <TaskStatusBadge status={task.status} />
          <EscalationBadge level={task.escalationLevel} />
          {overdue && <OverdueBadge />}
          <span className="pill bg-white text-slate-muted ring-1 ring-inset ring-line">
            {functionLabel(task.owner.functionArea)}
          </span>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-ink">{task.title}</h1>
        <p className="text-sm text-slate-muted">
          {patientName(task.patientId)} · dispatched {realSince(task.createdAt)} by {task.createdBy} ·{" "}
          {task.status === "done"
            ? "completed"
            : overdue
              ? `${Math.round((now - Date.parse(task.dueAt)) / 3600000)}h past SLA`
              : `SLA in ${Math.round((Date.parse(task.dueAt) - now) / 3600000)}h`}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section className="card p-4">
            <h2 className="text-sm font-bold text-ink">What to do</h2>
            <p className="mt-2 text-sm text-ink">{task.detail}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div>
                <dt className="text-slate-muted">Owner</dt>
                <dd className="font-medium text-ink">{task.owner.label}</dd>
              </div>
              <div>
                <dt className="text-slate-muted">Assignee</dt>
                <dd className="font-medium text-ink">{task.assignee ?? "Team inbox"}</dd>
              </div>
              <div>
                <dt className="text-slate-muted">Escalation</dt>
                <dd className="font-medium text-ink">Level {task.escalationLevel} · {escalationLabel(task.escalationLevel)}</dd>
              </div>
              <div>
                <dt className="text-slate-muted">From</dt>
                <dd className="font-medium text-ink">
                  {exception ? (
                    <Link href={`/exceptions/${exception.id}`} className="text-teal hover:underline">
                      {patternLabel(task.pattern)}
                    </Link>
                  ) : (
                    patternLabel(task.pattern)
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <section className="card p-4">
            <h2 className="text-sm font-bold text-ink">Activity</h2>
            <ol className="mt-3 space-y-3">
              {[...task.activity].reverse().map((a) => (
                <li key={a.id} className="flex gap-3 text-sm">
                  <span className="mt-0.5 w-4 shrink-0 text-center text-slate-muted" aria-hidden>
                    {KIND_ICON[a.kind] ?? "•"}
                  </span>
                  <div>
                    <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-slate-muted">
                      <span className="font-semibold text-ink">{a.actor}</span>
                      <span>· {realSince(a.at)}</span>
                      <span className="pill bg-mist text-slate">{a.kind}</span>
                    </div>
                    <p className="mt-0.5 text-slate">{a.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-4">
            <h2 className="text-sm font-bold text-ink">Work this task</h2>
            <div className="mt-3">
              <TaskActions taskId={task.id} status={task.status} assignee={task.assignee} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
