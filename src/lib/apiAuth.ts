import { NextResponse } from "next/server";
import { currentRole, type Role } from "./session";
import { can, denyReason, type Permission } from "./rbac";

/**
 * Gate an API route on a permission. Returns the caller's role, or a ready-made
 * 403 response to return straight from the handler:
 *
 *   const auth = await authorize("config:edit");
 *   if ("response" in auth) return auth.response;
 *   // ... auth.role is usable here
 */
export async function authorize(
  permission: Permission,
): Promise<{ role: Role } | { response: NextResponse }> {
  const role = await currentRole();
  if (!can(role, permission)) {
    return {
      response: NextResponse.json(
        { error: "forbidden", permission, detail: denyReason(role, permission) },
        { status: 403 },
      ),
    };
  }
  return { role };
}
