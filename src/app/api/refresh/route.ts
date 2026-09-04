import { NextResponse } from "next/server";
import { refreshDetection } from "@/store/db";
import { currentActor } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const state = await refreshDetection(await currentActor());
  return NextResponse.json({ ok: true, exceptions: state.exceptions.length, lastRunAt: state.lastRunAt });
}
