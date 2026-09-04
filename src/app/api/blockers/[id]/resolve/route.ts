import { NextResponse } from "next/server";
import { resolveBlockerById } from "@/store/db";
import { currentPlaceId, currentActor } from "@/lib/session";
import { authorize } from "@/lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authorize("blocker:manage");
  if ("response" in auth) return auth.response;

  const { id } = await ctx.params;
  let body: { note?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* note is optional */
  }

  const result = await resolveBlockerById(id, {
    actor: await currentActor(),
    placeId: await currentPlaceId(),
    note: typeof body.note === "string" ? body.note.slice(0, 500) : undefined,
  });
  if (!result) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, blocker: result.blocker });
}
