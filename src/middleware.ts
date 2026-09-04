/**
 * Auth gate. Every route outside the public allow-list needs a valid session
 * cookie; a browser request without one is redirected to `/login`, an API
 * request gets `401`. Set `THROUGHLINE_AUTH=off` to disable the gate (the app
 * then runs as the demo coordinator — see `lib/session.ts`).
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth/session";

const PUBLIC = [
  /^\/login(?:\/|$)/,
  /^\/api\/auth\//,
  /^\/offline(?:\/|$)/,
  /^\/manifest\.webmanifest$/,
  /^\/sw\.js$/,
  /^\/icons\//,
];

export async function middleware(req: NextRequest) {
  if (process.env.THROUGHLINE_AUTH === "off") return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();

  const user = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (user) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (pathname !== "/") url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
