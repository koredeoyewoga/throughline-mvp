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
import type { Task } from "@/domain/types";
import { buildSeed } from "@/data/seed";
import { runDetection } from "@/engine/run";
import { getConfig } from "@/config";
import { getConfiguredAdapter } from "@/adapters";
import { mergeEvents } from "@/adapters/merge";
import type { IngestResult } from "@/adapters/types";
import { inPlace, visibleInPlace, writableInPlace } from "@/lib/tenancy";
import {
  createTaskFromException,
  sweepTasks,
  applyTaskAction,
  taskSlaHours,
  type TaskActionKind,
} from "@/engine/tasks";
import { dataDir } from "@/lib/dataDir";

const DATA_DIR = dataDir();
const FILE = path.join(DATA_DIR, "state.json");

let cache: AppState | null = null;

function persist(state: AppState): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(state, null, 2), "utf8");
  } catch {
    // Read-only or full filesystem (serverless). The in-memory `cache` still
    // serves this instance; a cold start re-seeds from the synthetic world.
  }
}

const HOUR = 3600 * 1000;

async function freshState(): Promise<AppState> {
  const seed = buildSeed();
  const base: AppState = {
    ...seed,
    exceptions: [],
    tasks: [],
    audit: [],
    lastRunAt: new Date().toISOString(),
  };
  base.exceptions = await runDetection(base);
  seedTasks(base);
  base.audit = [auditEntry("system", "Ran coordination detection on the synthetic dataset", "detection", {
    exceptionsFound: base.exceptions.length,
    tasksSeeded: base.tasks.length,
  })];
  return base;
}

/**
 * Seed a few in-flight tasks so the worklist is not empty on a fresh demo:
 * one already auto-escalated, one nearing its SLA, one just dispatched.
 */
function seedTasks(state: AppState): void {
  const wf = getConfig().workflow;
  const now = Date.now();
  // Seed from mid/lower queue items so the headline failures stay freshly
  // actionable in a demo while the worklist is still populated.
  const plan: { pattern: string; ageHours: number; assignee?: string; status?: Task["status"] }[] = [
    { pattern: "loop_not_closed", ageHours: 40, assignee: "R. Odele (rehab scheduling)", status: "in_progress" },
    { pattern: "dna_no_rebook", ageHours: 16 },
    { pattern: "handover_gap", ageHours: 3, assignee: "J. Marsh (CMHT liaison)" },
  ];
  for (const p of plan) {
    const ex = state.exceptions.find((e) => e.pattern === p.pattern);
    if (!ex) continue;
    const createdAt = new Date(now - p.ageHours * HOUR).toISOString();
    const task = createTaskFromException(ex, {
      id: `task-seed-${ex.id}`,
      now: createdAt,
      actor: "Care coordinator (demo)",
      slaHours: taskSlaHours(ex.owner.functionArea, wf),
    });
    if (p.assignee) {
      task.assignee = p.assignee;
      task.activity.push({
        id: `act-${createdAt}-assigned-seed`,
        at: new Date(now - (p.ageHours - 1) * HOUR).toISOString(),
        actor: "Care coordinator (demo)",
        kind: "assigned",
        detail: `Assigned to ${p.assignee}`,
      });
    }
    if (p.status) task.status = p.status;
    state.tasks.push(task);
    ex.status = "in_progress";
  }
  const swept = sweepTasks(state.tasks, new Date().toISOString(), wf);
  state.tasks = swept.tasks;
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
  const swept = sweepTasks(state.tasks ?? [], new Date().toISOString(), getConfig().workflow);
  state.tasks = swept.tasks;
  state.lastRunAt = new Date().toISOString();
  state.audit.unshift(auditEntry(actor, "Re-ran coordination detection", "detection", {
    exceptions: state.exceptions.length,
    tasksEscalated: swept.changed,
  }));
  persist(state);
  return state;
}

/** Dev helper: pull every task's clock back so escalation can be shown live. */
export async function advanceTaskClock(hours: number, actor = "system"): Promise<AppState> {
  const state = await getState();
  const shift = Math.max(1, Math.min(240, Math.round(hours))) * HOUR;
  state.tasks = (state.tasks ?? []).map((t) => ({
    ...t,
    createdAt: new Date(Date.parse(t.createdAt) - shift).toISOString(),
    dueAt: new Date(Date.parse(t.dueAt) - shift).toISOString(),
  }));
  const swept = sweepTasks(state.tasks, new Date().toISOString(), getConfig().workflow);
  state.tasks = swept.tasks;
  state.audit.unshift(
    auditEntry(actor, `Advanced the task clock by ${Math.round(hours)}h`, "tasks", { tasksEscalated: swept.changed }),
  );
  persist(state);
  return state;
}

/**
 * Pull events from the configured external source adapter (FHIR / e-RS / ToC),
 * merge the new ones into state, and re-run detection. Read-only against the
 * source. A no-op when `THROUGHLINE_SOURCE=synthetic`.
 */
export async function ingestFromSource(actor = "system"): Promise<IngestResult> {
  const state = await getState();
  const adapter = getConfiguredAdapter(state);
  const base = { added: 0, skipped: 0, unmatched: 0, ignored: 0, exceptions: state.exceptions.length };

  if (!adapter) {
    return { adapter: "synthetic", ...base, note: "No external source configured (THROUGHLINE_SOURCE=synthetic)." };
  }

  let pulled;
  try {
    pulled = await adapter.fetchEvents(state.lastIngestAt);
  } catch (err) {
    return { adapter: adapter.name, ...base, note: `Pull failed: ${(err as Error).message}` };
  }

  const merged = mergeEvents(state.events, pulled.events);
  state.events = merged.events;
  state.lastIngestAt = new Date().toISOString();
  state.exceptions = await runDetection(state);
  const swept = sweepTasks(state.tasks ?? [], new Date().toISOString(), getConfig().workflow);
  state.tasks = swept.tasks;
  state.lastRunAt = new Date().toISOString();

  state.audit.unshift(
    auditEntry(actor, `Ingested events from the ${adapter.name} adapter`, "ingest", {
      adapter: adapter.name,
      added: merged.added,
      skippedDuplicates: merged.skipped,
      unmatchedPatients: pulled.unmatched,
      ignoredRecords: pulled.ignored,
      exceptions: state.exceptions.length,
    }),
  );
  persist(state);

  return {
    adapter: adapter.name,
    added: merged.added,
    skipped: merged.skipped,
    unmatched: pulled.unmatched,
    ignored: pulled.ignored,
    exceptions: state.exceptions.length,
  };
}

// ---------------------------------------------------------------- reads
//
// Every read takes an optional `placeId` — the tenant the caller is scoped to
// (`currentPlaceId()`). When given, entities outside that place are invisible,
// so a cross-tenant id read returns "not found" rather than another place's row.

export async function listExceptions(placeId?: string): Promise<Exception[]> {
  return inPlace((await getState()).exceptions, placeId);
}

export async function getException(id: string, placeId?: string): Promise<Exception | undefined> {
  return visibleInPlace(
    (await getState()).exceptions.find((e) => e.id === id),
    placeId,
  );
}

export async function listTasks(placeId?: string): Promise<Task[]> {
  return inPlace((await getState()).tasks ?? [], placeId);
}

export async function getTask(id: string, placeId?: string): Promise<Task | undefined> {
  return visibleInPlace(
    (await getState()).tasks?.find((t) => t.id === id),
    placeId,
  );
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
  cancellation_no_rebook: {
    type: "appointment_scheduled",
    pathway: "outpatient",
    summary: "Appointment rebooked with the patient (recorded via Throughline after coordinator action)",
  },
  package_of_care_delay: {
    type: "care_package_started",
    pathway: "discharge:social_care",
    summary: "Home-care package started with first call completed (recorded via Throughline after coordinator action)",
  },
  onward_referral_not_made: {
    type: "referral_made",
    pathway: "",
    summary: "Onward referral made to the named service (recorded via Throughline after coordinator action)",
  },
  virtual_ward_step_down_stalled: {
    type: "virtual_ward_discharge",
    pathway: "virtual_ward",
    summary: "Virtual-ward discharge completed with GP handback (recorded via Throughline after coordinator action)",
  },
};

export async function recordDecision(
  exceptionId: string,
  input: { kind: DecisionKind; actor: string; note?: string; amendedAction?: string; placeId?: string },
): Promise<{ state: AppState; exception: Exception } | null> {
  const state = await getState();
  const exception = state.exceptions.find((e) => e.id === exceptionId);
  if (!exception) return null;
  if (!writableInPlace(exception, input.placeId)) return null; // cross-tenant guard

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

  let dispatchedTaskId: string | null = null;

  switch (input.kind) {
    case "approve":
    case "modify": {
      exception.status = "in_progress";
      // Dispatch the work to the owning team as a tracked task. The exception
      // closes when that task is marked done (see actOnTask).
      const existing = (state.tasks ?? []).find((t) => t.exceptionId === exception.id && t.status !== "cancelled");
      if (!existing) {
        const task = createTaskFromException(exception, {
          id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          now: decision.at,
          actor: input.actor,
          slaHours: taskSlaHours(exception.owner.functionArea, getConfig().workflow),
          detail: input.kind === "modify" ? input.amendedAction : undefined,
        });
        state.tasks = [...(state.tasks ?? []), task];
        dispatchedTaskId = task.id;
      } else {
        dispatchedTaskId = existing.id;
      }
      break;
    }
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
      taskDispatched: dispatchedTaskId,
    }),
  );

  persist(state);

  const updated = state.exceptions.find((e) => e.id === exceptionId) ?? exception;
  return { state, exception: updated };
}

export async function actOnTask(
  taskId: string,
  input: { kind: TaskActionKind; actor: string; value?: string; note?: string; placeId?: string },
): Promise<{ state: AppState; task: Task } | null> {
  const state = await getState();
  const idx = (state.tasks ?? []).findIndex((t) => t.id === taskId);
  if (idx < 0) return null;
  if (!writableInPlace(state.tasks[idx], input.placeId)) return null; // cross-tenant guard

  const now = new Date().toISOString();
  const { task, completed } = applyTaskAction(state.tasks[idx], { ...input, now });
  state.tasks = state.tasks.map((t, i) => (i === idx ? task : t));

  state.audit.unshift(
    auditEntry(input.actor, `Task ${input.kind}: "${task.title}"`, `task:${task.id}`, {
      patient: task.patientId,
      exception: task.exceptionId,
      status: task.status,
      assignee: task.assignee ?? null,
      escalationLevel: task.escalationLevel,
      note: input.note ?? null,
    }),
  );

  // Completing the task feeds the resolving update back to the source data, which
  // closes the originating coordination failure on the next detection run.
  if (completed) {
    const exception = state.exceptions.find((e) => e.id === task.exceptionId);
    if (exception) applyResolvingEvent(state, exception, undefined);
    persist(state);
    state.exceptions = await runDetection(state);
    state.lastRunAt = now;
  }

  persist(state);
  const updated = state.tasks.find((t) => t.id === taskId) ?? task;
  return { state, task: updated };
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
