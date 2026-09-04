import { NextResponse } from "next/server";
import { handOffTask } from "@/store/db";
import { currentPlaceId, currentActor } from "@/lib/session";
import { authorize } from "@/lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authorize("handoff:manage");
  if ("response" in auth) return auth.response;

  const { id } = await ctx.params;
  let body: { toOwner?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!body.toOwner?.trim()) return NextResponse.json({ error: "toOwner is required" }, { status: 400 });
  if (!body.reason?.trim()) return NextResponse.json({ error: "reason is required" }, { status: 400 });

  const result = await handOffTask(id, {
    actor: await currentActor(),
    placeId: await currentPlaceId(),
    toOwner: body.toOwner.slice(0, 200),
    reason: body.reason.slice(0, 500),
  });
  if (!result) return NextResponse.json({ error: "task not found" }, { status: 404 });
  return NextResponse.json({ ok: true, handoff: result.handoff });
}
