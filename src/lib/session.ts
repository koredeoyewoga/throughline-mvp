/**
 * Demo identity. The MVP has NO real authentication — this is a stand-in shaped
 * like the RBAC that a real deployment would enforce (CIS2 / NHS login, roles
 * per organisation, per-place tenancy). The role only changes what the UI
 * offers; it is not a security boundary.
 */
import { cookies } from "next/headers";

export type Role = "coordinator" | "oversight";

export async function currentRole(): Promise<Role> {
  const store = await cookies();
  const fromCookie = store.get("throughline_role")?.value;
  if (fromCookie === "coordinator" || fromCookie === "oversight") return fromCookie;
  const fromEnv = process.env.THROUGHLINE_DEFAULT_ROLE;
  return fromEnv === "oversight" ? "oversight" : "coordinator";
}

export function actorLabel(role: Role): string {
  return role === "oversight" ? "Place oversight (demo)" : "Care coordinator (demo)";
}

/**
 * The place (tenant) the current session is scoped to. In production this comes
 * from the authenticated identity's organisation → place mapping; here it is a
 * single fixed place, but every place-scoped read and write goes through this
 * so the tenancy boundary is enforced by construction, not by convention.
 */
export async function currentPlaceId(): Promise<string> {
  const store = await cookies();
  return store.get("throughline_place")?.value || process.env.THROUGHLINE_PLACE_ID || "place-meadowford";
}
