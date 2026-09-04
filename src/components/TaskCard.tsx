import Link from "next/link";
import type { Task, OwnerStatus } from "@/domain/types";
import { SeverityBadge, TaskStatusBadge, EscalationBadge, OverdueBadge, OwnerStatusBadge } from "./Badge";
import { patternLabel, realSince } from "@/lib/format";
import { patientName } from "@/data/patients";

export function TaskCard({ task, now, ownerStatus }: { task: Task; now: number; ownerStatus?: OwnerStatus }) {
  const overdue = task.status !== "done" && task.status !== "cancelled" && now > Date.parse(task.dueAt);
  const dueDelta = Date.parse(task.dueAt) - now;
  const dueLabel =
    task.status === "done"
      ? "done"
      : overdue
        ? `${Math.round(-dueDelta / 3600000)}h overdue`
        : `due in ${Math.round(dueDelta / 3600000)}h`;

  return (
    <Link href={`/worklist/${task.id}`} className="card block p-4 transition-shadow hover:shadow-md focus-visible:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={task.priority} />
          <TaskStatusBadge status={task.status} />
          <EscalationBadge level={task.escalationLevel} />
          {overdue && <OverdueBadge />}
          {ownerStatus && <OwnerStatusBadge status={ownerStatus} />}
        </div>
        <span className="text-xs font-medium text-slate-muted">{dueLabel}</span>
      </div>

      <h3 className="mt-2 text-[15px] font-semibold text-ink">{task.title}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-slate">{task.detail}</p>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
        <div>
          <dt className="label">Patient</dt>
          <dd className="font-medium text-ink">{patientName(task.patientId)}</dd>
        </div>
        <div>
          <dt className="label">Assignee</dt>
          <dd className="font-medium text-ink">{task.assignee ?? "Team inbox"}</dd>
        </div>
        <div>
          <dt className="label">From</dt>
          <dd className="font-medium text-ink">{patternLabel(task.pattern)}</dd>
        </div>
        <div>
          <dt className="label">Dispatched</dt>
          <dd className="font-medium text-ink">{realSince(task.createdAt)}</dd>
        </div>
      </dl>
    </Link>
  );
}
