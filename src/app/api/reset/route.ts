import { NextResponse } from "next/server";
import { resetState } from "@/store/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const state = await resetState();
  return NextResponse.json({ ok: true, exceptions: state.exceptions.length });
}
