import type { Severity, ExceptionStatus, TaskStatus, BlockerStatus, OwnerStatus } from "@/domain/types";
import { statusLabel, escalationLabel, ownerStatusLabel } from "@/lib/format";

const SEV: Record<Severity, string> = {
  high: "bg-amber text-white",
  medium: "bg-amber-soft text-amber",
  low: "bg-mist text-slate",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <span className={`pill ${SEV[severity]}`}>{severity === "high" ? "High" : severity === "medium" ? "Medium" : "Low"}</span>;
}

const STATUS: Record<ExceptionStatus, string> = {
  open: "bg-teal-soft text-teal",
  in_progress: "bg-teal-soft text-teal",
  escalated: "bg-amber-soft text-amber",
  closed: "bg-mist text-slate-muted",
};

export function StatusBadge({ status }: { status: ExceptionStatus }) {
  return <span className={`pill ${STATUS[status]}`}>{statusLabel(status)}</span>;
}

export function ConfidenceBadge({ confidence }: { confidence: "high" | "medium" | "low" }) {
  return (
    <span className="pill bg-white text-slate-muted ring-1 ring-inset ring-line">
      Confidence: {confidence}
    </span>
  );
}

const TASK_STATUS: Record<TaskStatus, string> = {
  open: "bg-teal-soft text-teal",
  in_progress: "bg-teal-soft text-teal",
  blocked: "bg-amber-soft text-amber",
  done: "bg-mist text-slate-muted",
  cancelled: "bg-mist text-slate-muted",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`pill ${TASK_STATUS[status]}`}>{statusLabel(status)}</span>;
}

export function EscalationBadge({ level }: { level: 0 | 1 | 2 }) {
  if (level === 0) return null;
  return (
    <span className={`pill ${level === 2 ? "bg-amber text-white" : "bg-amber-soft text-amber"}`}>
      Escalated · {escalationLabel(level)}
    </span>
  );
}

export function OverdueBadge() {
  return <span className="pill bg-amber text-white">Overdue</span>;
}

const BLOCKER_STATUS: Record<BlockerStatus, string> = {
  open: "bg-amber-soft text-amber",
  awaiting_response: "bg-amber-soft text-amber",
  resolved: "bg-mist text-slate-muted",
};

export function BlockerStatusBadge({ status }: { status: BlockerStatus }) {
  return <span className={`pill ${BLOCKER_STATUS[status]}`}>{statusLabel(status)}</span>;
}

const OWNER_STATUS: Record<OwnerStatus, string> = {
  confirmed: "bg-teal-soft text-teal",
  pending_ack: "bg-amber-soft text-amber",
  unknown: "bg-amber text-white",
};

/** Shown only when ownership needs attention — a confirmed owner is the unremarkable default. */
export function OwnerStatusBadge({ status }: { status: OwnerStatus }) {
  if (status === "confirmed") return null;
  return <span className={`pill ${OWNER_STATUS[status]}`}>{ownerStatusLabel(status)}</span>;
}
