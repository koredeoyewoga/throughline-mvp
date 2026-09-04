import { NextResponse } from "next/server";
import { acknowledgeHandoffById } from "@/store/db";
import { currentPlaceId, currentActor } from "@/lib/session";
import { authorize } from "@/lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authorize("handoff:manage");
  if ("response" in auth) return auth.response;

  const { id } = await ctx.params;
  const result = await acknowledgeHandoffById(id, {
    actor: await currentActor(),
    placeId: await currentPlaceId(),
  });
  if (!result) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, handoff: result.handoff });
}
