/**
 * Task engine (deterministic, pure).
 * Approving a recommendation dispatches a Task to the owning team. Tasks carry
 * their own SLA and an escalation ladder that is evaluated on read (there is no
 * scheduler in the MVP) — `sweepTasks` bumps overdue tasks up the ladder and
 * records the notification that *would* be sent (human-approved in production).
 */
import type { Exception, Task, TaskActivity, TaskActivityKind, TaskStatus } from "@/domain/types";
import type { PlaceConfig } from "@/config/schema";
import { patientName } from "@/data/patients";

const HOUR = 3600 * 1000;

const LEVEL_LABEL = ["the owning team", "a team lead", "place / ICB"] as const;
export function escalationLabel(level: 0 | 1 | 2): string {
  return LEVEL_LABEL[level];
}

const TASK_VERB: Record<Exception["pattern"], string> = {
  referral_unactioned: "Chase & escalate the community referral",
  discharge_task_dropped: "Get the district-nursing task booked",
  follow_up_missed: "Make the complex-case follow-up contact",
  referral_ping_pong: "Route the falls referral to one accountable service",
  duplicate_assessment: "De-conflict the duplicate assessments",
  loop_not_closed: "Re-book the stalled first visit",
  dna_no_rebook: "Review urgency and rebook the missed appointment",
  handover_gap: "Send the handover to the admitting ward",
  cancellation_no_rebook: "Rebook the provider-cancelled appointment",
  package_of_care_delay: "Get the home-care package started",
  onward_referral_not_made: "Make the requested onward referral",
  virtual_ward_step_down_stalled: "Complete the virtual-ward step-down",
};

export function taskTitle(ex: Exception): string {
  return `${TASK_VERB[ex.pattern]} — ${patientName(ex.patientId)}`;
}

function act(kind: TaskActivityKind, actor: string, detail: string, at: string): TaskActivity {
  return { id: `act-${at}-${kind}-${Math.random().toString(36).slice(2, 6)}`, at, actor, kind, detail };
}

export function createTaskFromException(
  ex: Exception,
  opts: { id: string; now: string; actor: string; slaHours: number; detail?: string },
): Task {
  const detail = opts.detail?.trim() || ex.recommendedAction;
  return {
    id: opts.id,
    exceptionId: ex.id,
    patientId: ex.patientId,
    placeId: ex.placeId,
    pattern: ex.pattern,
    title: taskTitle(ex),
    detail,
    owner: ex.owner,
    assignee: undefined,
    status: "open",
    priority: ex.severity,
    createdAt: opts.now,
    createdBy: opts.actor,
    dueAt: new Date(Date.parse(opts.now) + opts.slaHours * HOUR).toISOString(),
    escalationLevel: 0,
    activity: [act("created", opts.actor, `Dispatched to ${ex.owner.label} from "${ex.title}"`, opts.now)],
  };
}

/** Bump overdue tasks up the escalation ladder. Returns a new array + count changed. */
export function sweepTasks(
  tasks: Task[],
  now: string,
  wf: PlaceConfig["workflow"],
): { tasks: Task[]; changed: number } {
  const nowMs = Date.parse(now);
  let changed = 0;

  const next = tasks.map((t) => {
    if (t.status === "done" || t.status === "cancelled") return t;
    const hoursPastDue = (nowMs - Date.parse(t.dueAt)) / HOUR;
    const target: 0 | 1 | 2 =
      hoursPastDue >= wf.escalateToLevel2AfterHours ? 2 : hoursPastDue >= wf.escalateToLevel1AfterHours ? 1 : 0;
    if (target <= t.escalationLevel) return t;

    changed += 1;
    return {
      ...t,
      escalationLevel: target,
      activity: [
        ...t.activity,
        act(
          "escalate",
          "system",
          `Auto-escalated to level ${target} (${escalationLabel(target)}) — ${Math.round(hoursPastDue)}h past due`,
          now,
        ),
        act(
          "reminder",
          "system",
          `A notification to ${escalationLabel(target)} would be sent here (human-approved in production)`,
          now,
        ),
      ],
    };
  });

  return { tasks: next, changed };
}

export type TaskActionKind = "assign" | "status" | "nudge" | "escalate" | "note";

export interface TaskActionInput {
  kind: TaskActionKind;
  actor: string;
  now: string;
  value?: string;
  note?: string;
}

/** Apply a human action to a task. Returns the updated task + whether it just completed. */
export function applyTaskAction(task: Task, input: TaskActionInput): { task: Task; completed: boolean } {
  const activity = [...task.activity];
  let { assignee, status, escalationLevel } = task;
  let completed = false;

  switch (input.kind) {
    case "assign": {
      const who = input.value?.trim();
      assignee = who || undefined;
      activity.push(act("assigned", input.actor, who ? `Assigned to ${who}` : "Returned to the team inbox", input.now));
      break;
    }
    case "status": {
      const s = input.value as TaskStatus;
      status = s;
      activity.push(act("status", input.actor, `Status → ${s.replace("_", " ")}`, input.now));
      if (s === "done") completed = true;
      break;
    }
    case "nudge":
      activity.push(act("nudge", input.actor, input.note?.trim() || `Chased ${task.owner.label}`, input.now));
      break;
    case "escalate": {
      escalationLevel = Math.min(2, task.escalationLevel + 1) as 0 | 1 | 2;
      activity.push(
        act("escalate", input.actor, `Manually escalated to level ${escalationLevel} (${escalationLabel(escalationLevel)})`, input.now),
      );
      break;
    }
    case "note":
      activity.push(act("note", input.actor, input.note?.trim() || "(no note)", input.now));
      break;
  }

  return { task: { ...task, assignee, status, escalationLevel, activity }, completed };
}

/** SLA hours for a task owned by a given function area (a single value in this MVP). */
export function taskSlaHours(_functionArea: string, wf: PlaceConfig["workflow"]): number {
  return wf.taskSlaHours;
}

export function isOverdue(task: Task, now: string): boolean {
  if (task.status === "done" || task.status === "cancelled") return false;
  return Date.parse(now) > Date.parse(task.dueAt);
}
