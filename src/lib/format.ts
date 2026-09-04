import { NOW } from "@/data/events";
import type { FailurePattern, BlockerCategory, OwnerStatus } from "@/domain/types";

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
    blocked: "Blocked",
    done: "Done",
    cancelled: "Cancelled",
    awaiting_response: "Awaiting response",
    resolved: "Resolved",
  };
  return map[status] ?? status;
}

const BLOCKER_CATEGORY_LABELS: Record<BlockerCategory, string> = {
  awaiting_other_team: "Awaiting another team",
  awaiting_external_organisation: "Awaiting an external organisation",
  missing_information: "Missing information",
  capacity_constraint: "Capacity constraint",
  patient_or_family_factor: "Patient or family factor",
  system_or_access_issue: "System or access issue",
  other: "Other",
};

export function blockerCategoryLabel(category: string): string {
  return BLOCKER_CATEGORY_LABELS[category as BlockerCategory] ?? category;
}

const OWNER_STATUS_LABELS: Record<OwnerStatus, string> = {
  confirmed: "Owner confirmed",
  pending_ack: "Pending acknowledgement",
  unknown: "Owner unknown",
};

export function ownerStatusLabel(status: OwnerStatus): string {
  return OWNER_STATUS_LABELS[status];
}

export const FUNCTION_LABELS: Record<string, string> = {
  discharge_hub: "Discharge hub",
  transfer_of_care: "Transfer of care",
  neighbourhood_team: "Neighbourhood team",
  single_point_of_access: "Single point of access",
  district_nursing: "District nursing",
  therapies: "Community rehab / therapies",
  social_work: "Social work",
  gp_practice: "GP practice",
  mental_health: "Mental health",
  voluntary: "Voluntary sector",
  virtual_ward: "Virtual ward",
};

export function functionLabel(fn: string): string {
  return FUNCTION_LABELS[fn] ?? fn;
}

export function escalationLabel(level: number): string {
  return ["With the team", "Team lead", "Place / ICB"][level] ?? `Level ${level}`;
}
