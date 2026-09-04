/**
 * Blocker engine (deterministic, pure).
 *
 * Unlike the twelve failure-pattern detectors, a Blocker is not inferred from
 * events — it is a person naming an obstacle explicitly, so it can be tracked
 * and resolved independently of whatever automated detection is or is not
 * running against the underlying pathway.
 */
import type { Blocker, BlockerCategory, Team } from "@/domain/types";

export interface CreateBlockerInput {
  id: string;
  now: string;
  actor: string;
  placeId: string;
  owner: { functionArea: Team["functionArea"]; orgId: string; label: string };
  title: string;
  category: BlockerCategory;
  description: string;
  exceptionId?: string;
  taskId?: string;
  externalDependency?: string;
}

export function createBlocker(input: CreateBlockerInput): Blocker {
  return {
    id: input.id,
    placeId: input.placeId,
    exceptionId: input.exceptionId,
    taskId: input.taskId,
    title: input.title.trim(),
    category: input.category,
    description: input.description.trim(),
    owner: input.owner,
    status: "open",
    externalDependency: input.externalDependency?.trim() || undefined,
    createdAt: input.now,
    createdBy: input.actor,
    updatedAt: input.now,
  };
}

export function resolveBlocker(
  blocker: Blocker,
  input: { actor: string; now: string; note?: string },
): Blocker {
  return {
    ...blocker,
    status: "resolved",
    updatedAt: input.now,
    resolvedAt: input.now,
    resolvedBy: input.actor,
    resolutionNote: input.note?.trim() || undefined,
  };
}

/** Toggle between the two non-terminal states — e.g. once the external party has been chased. */
export function setBlockerAwaitingResponse(blocker: Blocker, now: string): Blocker {
  return { ...blocker, status: "awaiting_response", updatedAt: now };
}
