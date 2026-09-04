import { NextResponse } from "next/server";
import { recordDecision } from "@/store/db";
import { currentPlaceId, currentActor } from "@/lib/session";
import { authorize } from "@/lib/apiAuth";
import type { DecisionKind } from "@/domain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID: DecisionKind[] = ["approve", "modify", "reject", "escalate", "close"];

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { kind?: string; note?: string; amendedAction?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!body.kind || !VALID.includes(body.kind as DecisionKind)) {
    return NextResponse.json({ error: `kind must be one of ${VALID.join(", ")}` }, { status: 400 });
  }

  const auth = await authorize("exception:decide");
  if ("response" in auth) return auth.response;

  const result = await recordDecision(id, {
    kind: body.kind as DecisionKind,
    actor: await currentActor(),
    note: typeof body.note === "string" ? body.note.slice(0, 500) : undefined,
    amendedAction: typeof body.amendedAction === "string" ? body.amendedAction.slice(0, 1000) : undefined,
    placeId: await currentPlaceId(),
  });

  if (!result) return NextResponse.json({ error: "exception not found" }, { status: 404 });
  return NextResponse.json({ ok: true, exception: result.exception });
}
