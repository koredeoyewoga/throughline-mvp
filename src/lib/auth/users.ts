/**
 * Demo credential provider.
 *
 * With no OIDC issuer configured, `/login` lets you pick one of these identities
 * — a one-click stand-in for CIS2 / NHS login. Each carries the role and place
 * that RBAC (`lib/rbac.ts`) and tenancy (`lib/tenancy.ts`) enforce against.
 */
import type { SessionUser } from "./session";

export interface DemoUser extends SessionUser {
  /** Shown on the login screen. */
  blurb: string;
}

export const DEMO_USERS: DemoUser[] = [
  {
    sub: "u-coordinator",
    name: "Priya Shah",
    role: "coordinator",
    placeId: "place-meadowford",
    orgId: "org-mch",
    blurb: "Care coordinator, Meadowford — works the queue and the worklist.",
  },
  {
    sub: "u-oversight",
    name: "Alan Reeve",
    role: "oversight",
    placeId: "place-meadowford",
    orgId: "org-mch",
    blurb: "Place oversight, Meadowford — can also tune configuration and pull from a source.",
  },
  {
    sub: "u-riverside",
    name: "Nadia Kern",
    role: "coordinator",
    placeId: "place-riverside",
    orgId: "org-rpcn",
    blurb: "Coordinator for a different place — sees only Riverside's items (none in this synthetic seed).",
  },
];

export function findDemoUser(id: string): DemoUser | undefined {
  return DEMO_USERS.find((u) => u.sub === id);
}
