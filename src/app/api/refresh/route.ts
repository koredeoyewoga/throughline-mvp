import { NextResponse } from "next/server";
import { refreshDetection } from "@/store/db";
import { currentRole, actorLabel } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const role = await currentRole();
  const state = await refreshDetection(actorLabel(role));
  return NextResponse.json({ ok: true, exceptions: state.exceptions.length, lastRunAt: state.lastRunAt });
}
