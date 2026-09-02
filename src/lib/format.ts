import { NOW } from "@/data/events";
import type { FailurePattern } from "@/domain/types";

const HOUR = 3600 * 1000;

/** Relative time against the synthetic "now", not the wall clock. */
export function sinceNow(iso: string): string {
  if (iso.startsWith("gap:")) return "";
  const diffH = (Date.parse(NOW) - Date.parse(iso)) / HOUR;
  if (Number.isNaN(diffH)) return iso;
  if (diffH < 0) {
    const ahead = Math.abs(diffH);
    if (ahead < 48) return `in ${Math.round(ahead)}h`;
    return `in ${Math.round(ahead / 24)}d`;
  }
  if (diffH < 1) return "just now";
  if (diffH < 48) return `${Math.round(diffH)}h ago`;
  return `${Math.round(diffH / 24)}d ago`;
}

/** Relative time against the real wall clock — for decisions, audit, "surfaced" times. */
export function realSince(iso: string): string {
  const diffMs = Date.now() - Date.parse(iso);
  if (Number.isNaN(diffMs)) return iso;
  const m = diffMs / 60000;
  if (m < 1) return "just now";
  if (m < 60) return `${Math.round(m)} min ago`;
  const h = m / 60;
  if (h < 24) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

const PATTERN_LABELS: Record<FailurePattern, string> = {
  referral_unactioned: "Referral not actioned",
  discharge_task_dropped: "Discharge task dropped",
  follow_up_missed: "Follow-up missed",
  referral_ping_pong: "Referral ping-pong",
  duplicate_assessment: "Duplicate assessment",
  loop_not_closed: "Loop not closed",
  dna_no_rebook: "DNA — no rebooking",
  handover_gap: "Handover gap",
  cancellation_no_rebook: "Cancellation — no rebooking",
  package_of_care_delay: "Care package delay",
  onward_referral_not_made: "Onward referral not made",
  virtual_ward_step_down_stalled: "Virtual ward step-down stalled",
};

export const FAILURE_PATTERNS = Object.keys(PATTERN_LABELS) as FailurePattern[];

export function patternLabel(pattern: string): string {
  return PATTERN_LABELS[pattern as FailurePattern] ?? pattern;
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    open: "Open",
    in_progress: "In progress",
    escalated: "Escalated",
    closed: "Closed",
  };
  return map[status] ?? status;
}
