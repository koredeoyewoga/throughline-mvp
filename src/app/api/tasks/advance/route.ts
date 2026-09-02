import { NextResponse } from "next/server";
import { advanceTaskClock } from "@/store/db";
import { currentRole, actorLabel } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Dev helper — pull the task clock back so SLA breaches and escalation show live. */
export async function POST(req: Request) {
  let hours = 12;
  try {
    const body = (await req.json()) as { hours?: number };
    if (typeof body.hours === "number") hours = body.hours;
  } catch {
    /* default 12h */
  }
  const role = await currentRole();
  const state = await advanceTaskClock(hours, actorLabel(role));
  return NextResponse.json({ ok: true, hours, tasks: state.tasks.length });
}
