/**
 * MVP persistence.
 *
 * Coordination state (exceptions, decisions, audit) is held in a single JSON
 * file under `.data/`. This is deliberately the simplest thing that works: the
 * repository functions below are the seam. Swapping to PostgreSQL / Prisma in a
 * later phase is a change contained to this file.
 *
 * Node.js runtime only (uses the fs API). API routes and server components that
 * import this must not run on the Edge runtime.
 */
import fs from "node:fs";
import path from "node:path";
import type {
  AppState,
  Exception,
  Decision,
  DecisionKind,
  AuditEntry,
  SourceEvent,
  EventType,
} from "@/domain/types";
import { buildSeed } from "@/data/seed";
import { runDetection } from "@/engine/run";

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "state.json");

let cache: AppState | null = null;

function persist(state: AppState): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(state, null, 2), "utf8");
}

async function freshState(): Promise<AppState> {
  const seed = buildSeed();
  const base: AppState = {
    ...seed,
    exceptions: [],
    audit: [],
    lastRunAt: new Date().toISOString(),
  };
  base.exceptions = await runDetection(base);
  base.audit = [auditEntry("system", "Ran coordination detection on the synthetic dataset", "detection", {
    exceptionsFound: base.exceptions.length,
  })];
  return base;
}

export async function getState(): Promise<AppState> {
  if (cache) return cache;
  if (fs.existsSync(FILE)) {
    try {
      cache = JSON.parse(fs.readFileSync(FILE, "utf8")) as AppState;
      return cache;
    } catch {
      // fall through to a fresh seed if the file is corrupt
    }
  }
  cache = await freshState();
  persist(cache);
  return cache;
}

export async function resetState(): Promise<AppState> {
  cache = await freshState();
  cache.audit.unshift(auditEntry("system", "Reset to the synthetic seed", "state", {}));
  persist(cache);
  return cache;
}

/** Re-run detection against the current events without wiping human decisions. */
export async function refreshDetection(actor = "system"): Promise<AppState> {
  const state = await getState();
  state.exceptions = await runDetection(state);
  state.lastRunAt = new Date().toISOString();
  state.audit.unshift(auditEntry(actor, "Re-ran coordination detection", "detection", {
    exceptions: state.exceptions.length,
  }));
  persist(state);
  return state;
}

// ---------------------------------------------------------------- reads

export async function listExceptions(): Promise<Exception[]> {
  return (await getState()).exceptions;
}

export async function getException(id: string): Promise<Exception | undefined> {
  return (await getState()).exceptions.find((e) => e.id === id);
}

export async function listAudit(): Promise<AuditEntry[]> {
  return (await getState()).audit;
}

// ---------------------------------------------------------------- writes

const RESOLVING_EVENT: Partial<
  Record<Exception["pattern"], { type: EventType; pathway: string; summary: string }>
> = {
  referral_unactioned: {
    type: "referral_accepted",
    pathway: "discharge:frailty",
    summary: "Referral accepted by the community provider (recorded via Throughline after coordinator action)",
  },
  discharge_task_dropped: {
    type: "visit_booked",
    pathway: "discharge:district_nursing",
    summary: "District nursing booked a visit (recorded via Throughline after coordinator action)",
  },
  follow_up_missed: {
    type: "contact_attempt",
    pathway: "neighbourhood:complex",
    summary: "Neighbourhood team made follow-up contact (recorded via Throughline after coordinator action)",
  },
  referral_ping_pong: {
    type: "referral_accepted",
    pathway: "falls",
    summary: "Single accountable service accepted the referral (recorded via Throughline after coordinator action)",
  },
  loop_not_closed: {
    type: "visit_completed",
    pathway: "discharge:frailty",
    summary: "First rehab visit completed (recorded via Throughline after coordinator action)",
  },
  dna_no_rebook: {
    type: "appointment_scheduled",
    pathway: "outpatient",
    summary: "Appointment rebooked with the patient (recorded via Throughline after coordinator action)",
  },
  handover_gap: {
    type: "status_note",
    pathway: "",
    summary: "Handover sent to the admitting ward (recorded via Throughline after coordinator action)",
  },
};

export async function recordDecision(
  exceptionId: string,
  input: { kind: DecisionKind; actor: string; note?: string; amendedAction?: string },
): Promise<{ state: AppState; exception: Exception } | null> {
  const state = await getState();
  const exception = state.exceptions.find((e) => e.id === exceptionId);
  if (!exception) return null;

  const decision: Decision = {
    id: `dec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    kind: input.kind,
    actor: input.actor,
    at: new Date().toISOString(),
    note: input.note,
    amendedAction: input.amendedAction,
  };
  exception.decisions.push(decision);
  exception.updatedAt = decision.at;

  switch (input.kind) {
    case "approve":
    case "modify":
      exception.status = "in_progress";
      applyResolvingEvent(state, exception, input.kind === "modify" ? input.amendedAction : undefined);
      break;
    case "escalate":
      exception.status = "escalated";
      break;
    case "reject":
    case "close":
      exception.status = "closed";
      break;
  }

  state.audit.unshift(
    auditEntry(input.actor, `Decision: ${input.kind} on "${exception.title}"`, `exception:${exception.id}`, {
      patient: exception.patientId,
      pattern: exception.pattern,
      aiIdentified: exception.title,
      aiRecommended: exception.recommendedAction,
      humanDecision: input.kind,
      note: input.note ?? null,
      amendedAction: input.amendedAction ?? null,
    }),
  );

  persist(state);

  // Re-run detection so an approved fix visibly closes the loop.
  if (input.kind === "approve" || input.kind === "modify") {
    state.exceptions = await runDetection(state);
    state.lastRunAt = new Date().toISOString();
    persist(state);
  }

  const updated = state.exceptions.find((e) => e.id === exceptionId) ?? exception;
  return { state, exception: updated };
}

function applyResolvingEvent(state: AppState, exception: Exception, amendedAction?: string): void {
  const spec = RESOLVING_EVENT[exception.pattern];
  if (!spec) return; // duplicate_assessment etc. are resolved manually
  const patient = state.patients.find((p) => p.id === exception.patientId);
  if (!patient) return;

  const newEvent: SourceEvent = {
    id: `evt-act-${Date.now()}`,
    patientId: exception.patientId,
    type: spec.type,
    at: new Date().toISOString(),
    fromOrgId: exception.owner.orgId,
    toOrgId: exception.pattern === "handover_gap" ? "org-mft" : undefined,
    pathway: spec.pathway || undefined,
    summary: amendedAction ? `${spec.summary}. Coordinator note: ${amendedAction}` : spec.summary,
  };
  state.events.push(newEvent);
  state.events.sort((a, b) => a.at.localeCompare(b.at));
}

// ---------------------------------------------------------------- helpers

export function auditEntry(
  actor: string,
  action: string,
  target: string,
  context?: Record<string, unknown>,
): AuditEntry {
  return {
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    actor,
    action,
    target,
    context,
  };
}
