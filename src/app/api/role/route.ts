import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const role = body.role === "oversight" ? "oversight" : "coordinator";
  const res = NextResponse.json({ ok: true, role });
  res.cookies.set("throughline_role", role, { httpOnly: false, sameSite: "lax", path: "/" });
  return res;
}
