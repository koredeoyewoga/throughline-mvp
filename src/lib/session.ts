/**
 * Server-side session accessors (Node runtime — reads the request cookie).
 *
 * The identity comes from a signed `throughline_session` cookie
 * (`lib/auth/session.ts`), set by `/api/auth/login` (the demo credential
 * provider) or, in production, by the OIDC callback. Middleware (`middleware.ts`)
 * guarantees a valid session on every non-public route, so `currentUser()` is
 * non-null there; the fallbacks below only apply when auth is disabled
 * (`THROUGHLINE_AUTH=off`) or outside the middleware's matcher.
 */
import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE, type SessionUser } from "./auth/session";

export type Role = "coordinator" | "oversight";

const FALLBACK_USER: SessionUser = {
  sub: "u-anonymous",
  name: "Care coordinator (demo)",
  role: "coordinator",
  placeId: "place-meadowford",
  orgId: "org-mch",
};

export async function currentUser(): Promise<SessionUser> {
  const store = await cookies();
  const user = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (user) return user;
  // Auth disabled, or a context the middleware does not cover.
  const envRole = process.env.THROUGHLINE_DEFAULT_ROLE === "oversight" ? "oversight" : "coordinator";
  return {
    ...FALLBACK_USER,
    role: envRole,
    name: envRole === "oversight" ? "Place oversight (demo)" : "Care coordinator (demo)",
    placeId: process.env.THROUGHLINE_PLACE_ID || FALLBACK_USER.placeId,
  };
}

export async function currentRole(): Promise<Role> {
  return (await currentUser()).role;
}

/** The place (tenant) the current session is scoped to. */
export async function currentPlaceId(): Promise<string> {
  return (await currentUser()).placeId;
}

/** Name to attribute an audit entry to. */
export async function currentActor(): Promise<string> {
  return (await currentUser()).name;
}

export function actorLabel(role: Role): string {
  return role === "oversight" ? "Place oversight (demo)" : "Care coordinator (demo)";
}
