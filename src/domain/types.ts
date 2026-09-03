/**
 * Throughline Coordinate — domain model.
 *
 * The platform reasons over a *pathway-state model*: for each patient, what has
 * happened across every organisation, what is expected to happen next, and by
 * when. Coordination failures are deviations from that expected state.
 *
 * SYNTHETIC DATA ONLY. No real patient information exists anywhere in this MVP.
 */

// --- Reference data --------------------------------------------------------

export type OrgKind =
  | "acute_trust"
  | "community_provider"
  | "primary_care"
  | "mental_health"
  | "social_care"
  | "voluntary";

export interface Organisation {
  id: string;
  name: string;
  kind: OrgKind;
  /** Free-text description of what this org does in the neighbourhood. */
  role: string;
}

export interface Team {
  id: string;
  orgId: string;
  name: string;
  /** Inbox this team's coordination work lands in. */
  functionArea:
    | "discharge_hub"
    | "transfer_of_care"
    | "neighbourhood_team"
    | "single_point_of_access"
    | "district_nursing"
    | "therapies"
    | "social_work"
    | "gp_practice"
    | "mental_health"
    | "voluntary"
    | "virtual_ward";
}

export interface Patient {
  /** Stable Throughline id (entity-resolved across source systems). */
  id: string;
  /** Synthetic display name. */
  name: string;
  /** Synthetic NHS number (all begin 999 — reserved test range style). */
  nhsNumber: string;
  yearOfBirth: number;
  /** Local system identifiers this patient was resolved from, per org. */
  sourceIds: { orgId: string; localId: string; confidence: number }[];
  /** Neighbourhood / place footprint the patient belongs to. */
  placeId: string;
  /** Short synthetic context a coordinator would find useful. */
  summary: string;
  flags: string[];
}

// --- Events: the raw material the platform ingests ------------------------

export type EventType =
  | "referral_made"
  | "referral_acknowledged"
  | "referral_accepted"
  | "referral_rejected"
  | "assessment_completed"
  | "discharge_ready"
  | "discharge_summary_issued"
  | "task_expected" // a discrete next-step extracted from a document
  | "visit_booked"
  | "visit_completed"
  | "contact_attempt"
  | "appointment_scheduled"
  | "appointment_dna" // patient did not attend
  | "appointment_cancelled" // cancelled by the provider
  | "care_package_requested" // home-care package requested from social care
  | "care_package_started"
  | "virtual_ward_admission"
  | "virtual_ward_step_down_ready" // clinically ready to leave the virtual ward
  | "virtual_ward_discharge"
  | "admission"
  | "readmission"
  | "status_note";

export interface SourceEvent {
  id: string;
  patientId: string;
  type: EventType;
  /** ISO date-time. All synthetic timestamps are relative to a fixed "now". */
  at: string;
  /** Organisation the event originated from. */
  fromOrgId: string;
  /** Organisation the event is directed at (referrals, tasks, handovers). */
  toOrgId?: string;
  /** Pathway this event belongs to (e.g. "discharge:frailty", "falls"). */
  pathway?: string;
  /** Human-readable one-liner. */
  summary: string;
  /** Structured payload, shape depends on type. */
  data?: Record<string, unknown>;
  /** If this event is a document, its (synthetic) text. */
  documentText?: string;
}

// --- Pathway-state model (derived) --------------------------------------

export interface ExpectedStep {
  key: string;
  /** What should happen. */
  description: string;
  /** Which team is expected to act. */
  owningFunction: Team["functionArea"];
  /** Hours after the trigger event by which it should be satisfied. */
  slaHours: number;
  /** Event type(s) that satisfy this step. */
  satisfiedBy: EventType[];
}

export interface PathwayState {
  patientId: string;
  pathway: string;
  /** The event that opened this pathway. */
  triggeredBy: string; // event id
  triggeredAt: string;
  steps: {
    step: ExpectedStep;
    satisfied: boolean;
    satisfiedByEventId?: string;
    dueAt: string;
    overdueHours: number;
  }[];
}

// --- Exceptions: what requires attention now ---------------------------

export type FailurePattern =
  | "referral_unactioned"
  | "discharge_task_dropped"
  | "follow_up_missed"
  | "referral_ping_pong"
  | "duplicate_assessment"
  | "loop_not_closed"
  | "dna_no_rebook"
  | "handover_gap"
  | "cancellation_no_rebook"
  | "package_of_care_delay"
  | "onward_referral_not_made"
  | "virtual_ward_step_down_stalled";

export type Severity = "high" | "medium" | "low";

export interface EvidenceItem {
  eventId: string;
  at: string;
  label: string;
  detail: string;
  /** Direct quote from a source document, where relevant. */
  quote?: string;
}

export type DecisionKind =
  | "approve" // accept the recommended action as-is
  | "modify" // accept but with an amended action (note carries the change)
  | "reject" // the recommendation is wrong / not needed
  | "escalate" // send up a level
  | "close"; // work is done / no longer relevant

export interface Decision {
  id: string;
  kind: DecisionKind;
  actor: string; // role or name of the human
  at: string;
  note?: string;
  /** For modify: the action the human actually chose. */
  amendedAction?: string;
}

export type ExceptionStatus = "open" | "in_progress" | "escalated" | "closed";

export interface Exception {
  id: string;
  patientId: string;
  placeId: string;
  pattern: FailurePattern;
  severity: Severity;
  /** Deterministic 0–100 priority score. */
  score: number;
  scoreBreakdown: { factor: string; points: number }[];
  title: string;
  /** Plain-language explanation of the coordination failure and its consequence. */
  why: string;
  /** How the "why" was produced. */
  whySource: "deterministic" | "model" | "model+deterministic";
  evidence: EvidenceItem[];
  /** The pre-drafted next step. */
  recommendedAction: string;
  /** Team / org that should own the fix. */
  owner: { functionArea: Team["functionArea"]; orgId: string; label: string };
  /** Confidence the detector has in this being a real failure. */
  confidence: "high" | "medium" | "low";
  status: ExceptionStatus;
  createdAt: string;
  updatedAt: string;
  decisions: Decision[];
  /** Governance checks run against the recommended action before a human sees it. */
  governance: GovernanceCheck[];
  /** True when a step below the SLA-derived confidence threshold needs a human to confirm the underlying facts. */
  needsFactCheck: boolean;
}

export interface GovernanceCheck {
  rule: string;
  outcome: "pass" | "flag";
  detail: string;
}

// --- Tasks: the work an approved recommendation dispatches --------------

export type TaskStatus = "open" | "in_progress" | "blocked" | "done" | "cancelled";

export type TaskActivityKind =
  | "created"
  | "assigned"
  | "status"
  | "nudge" // a chase / reminder to the owning team
  | "escalate"
  | "note"
  | "reminder"; // a notification the system would send (human-approved in production)

export interface TaskActivity {
  id: string;
  at: string;
  actor: string;
  kind: TaskActivityKind;
  detail: string;
}

export interface Task {
  id: string;
  /** The coordination failure this task was dispatched from. */
  exceptionId: string;
  patientId: string;
  placeId: string;
  pattern: FailurePattern;
  title: string;
  /** The action to carry out — the exception's recommended action, or the coordinator's amendment. */
  detail: string;
  owner: { functionArea: Team["functionArea"]; orgId: string; label: string };
  /** Named person, or undefined for the team inbox. */
  assignee?: string;
  status: TaskStatus;
  priority: Severity;
  createdAt: string;
  createdBy: string;
  /** createdAt + the SLA hours for this owning function. */
  dueAt: string;
  /** 0 = with the owning team · 1 = team lead · 2 = place / ICB. */
  escalationLevel: 0 | 1 | 2;
  activity: TaskActivity[];
}

// --- Audit --------------------------------------------------------------

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  /** What the AI identified / recommended, and what the human decided. */
  context?: Record<string, unknown>;
}

// --- KPI --------------------------------------------------------------

export interface Kpi {
  key: string;
  label: string;
  value: string;
  /** measured = derived from events in this system. estimated = illustrative. */
  basis: "measured" | "estimated";
  note: string;
}

// --- Place ----------------------------------------------------------------

export interface Place {
  id: string;
  name: string;
  description: string;
}

// --- The whole synthetic world + derived state --------------------------

export interface WorldSeed {
  now: string;
  places: Place[];
  organisations: Organisation[];
  teams: Team[];
  patients: Patient[];
  events: SourceEvent[];
}

export interface AppState extends WorldSeed {
  exceptions: Exception[];
  tasks: Task[];
  audit: AuditEntry[];
  /** When detection was last run. */
  lastRunAt: string;
  /** When events were last pulled from an external source adapter (Phase 8). */
  lastIngestAt?: string;
}
