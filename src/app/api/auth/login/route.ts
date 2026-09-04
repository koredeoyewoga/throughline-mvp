import { NextResponse } from "next/server";
import { signSession, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/auth/session";
import { findDemoUser } from "@/lib/auth/users";
import { oidcConfigured } from "@/lib/auth/oidc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Demo credential provider — sign a session for the chosen demo user. */
export async function POST(req: Request) {
  if (oidcConfigured()) {
    return NextResponse.json(
      { error: "oidc_enabled", detail: "This deployment uses NHS CIS2 — begin at /api/auth/start." },
      { status: 400 },
    );
  }

  let body: { userId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const user = body.userId ? findDemoUser(body.userId) : undefined;
  if (!user) return NextResponse.json({ error: "unknown user" }, { status: 400 });

  const token = await signSession({
    sub: user.sub,
    name: user.name,
    role: user.role,
    placeId: user.placeId,
    orgId: user.orgId,
  });

  const res = NextResponse.json({
    ok: true,
    user: { name: user.name, role: user.role, placeId: user.placeId },
  });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
