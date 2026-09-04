import { NextResponse } from "next/server";
import { actOnTask } from "@/store/db";
import { currentPlaceId, actorLabel } from "@/lib/session";
import { authorize } from "@/lib/apiAuth";
import type { TaskActionKind } from "@/engine/tasks";
import type { TaskStatus } from "@/domain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS: TaskActionKind[] = ["assign", "status", "nudge", "escalate", "note"];
const STATUSES: TaskStatus[] = ["open", "in_progress", "blocked", "done", "cancelled"];

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { kind?: string; value?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!body.kind || !KINDS.includes(body.kind as TaskActionKind)) {
    return NextResponse.json({ error: `kind must be one of ${KINDS.join(", ")}` }, { status: 400 });
  }
  if (body.kind === "status" && !STATUSES.includes(body.value as TaskStatus)) {
    return NextResponse.json({ error: `status must be one of ${STATUSES.join(", ")}` }, { status: 400 });
  }

  const auth = await authorize("task:act");
  if ("response" in auth) return auth.response;

  const result = await actOnTask(id, {
    kind: body.kind as TaskActionKind,
    actor: actorLabel(auth.role),
    value: typeof body.value === "string" ? body.value.slice(0, 200) : undefined,
    note: typeof body.note === "string" ? body.note.slice(0, 500) : undefined,
    placeId: await currentPlaceId(),
  });
  if (!result) return NextResponse.json({ error: "task not found" }, { status: 404 });
  return NextResponse.json({ ok: true, task: result.task });
}
