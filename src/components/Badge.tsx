import type { Severity, ExceptionStatus } from "@/domain/types";
import { statusLabel } from "@/lib/format";

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
