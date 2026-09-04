/**
 * Role-based access control.
 *
 * The MVP has two roles (see `session.ts`); this is the permission matrix a
 * real deployment would drive from CIS2 / NHS login group membership. Every
 * privileged API action checks `can(role, permission)` before it runs
 * (`lib/apiAuth.ts`), and the UI hides controls a role cannot use — the two are
 * kept in sync from this one table.
 */
import type { Role } from "./session";

export type Permission =
  | "queue:view"
  | "exception:decide" // approve / modify / reject / escalate / close
  | "task:act" // assign / status / nudge / escalate / note
  | "blocker:manage" // report / resolve a blocker
  | "handoff:manage" // hand off / acknowledge a handoff
  | "detection:refresh"
  | "demo:reset" // rebuild demo state from the seed
  | "demo:advanceClock" // dev helper on the worklist
  | "config:edit" // change place configuration
  | "config:reset" // restore built-in defaults
  | "source:ingest"; // pull from an external source adapter

const COORDINATOR: Permission[] = [
  "queue:view",
  "exception:decide",
  "task:act",
  "blocker:manage",
  "handoff:manage",
  "detection:refresh",
  "demo:reset",
  "demo:advanceClock",
];

const OVERSIGHT: Permission[] = [...COORDINATOR, "config:edit", "config:reset", "source:ingest"];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  coordinator: COORDINATOR,
  oversight: OVERSIGHT,
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Human-readable reason for a 403, shown in the UI and the API response. */
export function denyReason(role: Role, permission: Permission): string {
  const labels: Record<Permission, string> = {
    "queue:view": "view the queue",
    "exception:decide": "make a decision on a coordination item",
    "task:act": "act on a task",
    "blocker:manage": "report or resolve a blocker",
    "handoff:manage": "hand off or acknowledge ownership of a task",
    "detection:refresh": "re-run detection",
    "demo:reset": "reset the demo",
    "demo:advanceClock": "advance the demo clock",
    "config:edit": "change place configuration",
    "config:reset": "reset place configuration",
    "source:ingest": "pull from an external source",
  };
  return `The ${role} role cannot ${labels[permission]}. This action needs place oversight.`;
}
