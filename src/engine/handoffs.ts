/**
 * Handoff engine (deterministic, pure).
 *
 * A handoff records a change of ownership as its own auditable event, distinct
 * from the quick "assign to the team inbox" action. Creating a handoff does
 * NOT change `Task.assignee` — the new owner must acknowledge it first
 * (`acknowledgeHandoff`). Until then `ownerStatus` reports the task as
 * "pending_ack", and past a confirmation window, "unknown" — a coordination
 * risk in its own right, surfaced alongside the twelve failure patterns.
 */
import type { Handoff, Task } from "@/domain/types";

const HOUR = 3600 * 1000;

export function createHandoff(
  task: Task,
  input: { id: string; now: string; actor: string; toOwner: string; reason: string },
): Handoff {
  return {
    id: input.id,
    placeId: task.placeId,
    taskId: task.id,
    fromOwner: task.assignee ?? null,
    toOwner: input.toOwner.trim(),
    reason: input.reason.trim(),
    at: input.now,
    by: input.actor,
  };
}

export function acknowledgeHandoff(handoff: Handoff, actor: string, now: string): Handoff {
  return { ...handoff, acknowledgedAt: now, acknowledgedBy: actor };
}

/**
 * The most recent handoff for a task, or undefined if it has never been
 * handed off (its ownership is whatever `Task.assignee`/team-inbox says).
 */
export function latestHandoff(taskId: string, handoffs: Handoff[]): Handoff | undefined {
  return handoffs
    .filter((h) => h.taskId === taskId)
    .sort((a, b) => b.at.localeCompare(a.at))[0];
}

/**
 * Confirmed: no open handoff, or the latest one was acknowledged.
 * Pending: a handoff is open and still inside the confirmation window.
 * Unknown: a handoff has sat unacknowledged past the confirmation window —
 * nobody has confirmed they own this. Surfaced as a coordination risk.
 */
export function ownerStatus(
  taskId: string,
  handoffs: Handoff[],
  now: string,
  confirmationWindowHours: number,
): "confirmed" | "pending_ack" | "unknown" {
  const latest = latestHandoff(taskId, handoffs);
  if (!latest || latest.acknowledgedAt) return "confirmed";
  const hoursSince = (Date.parse(now) - Date.parse(latest.at)) / HOUR;
  return hoursSince >= confirmationWindowHours ? "unknown" : "pending_ack";
}
