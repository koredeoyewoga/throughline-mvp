import { NextResponse } from "next/server";
import { getState, ingestFromSource } from "@/store/db";
import { describeSource } from "@/adapters";
import { currentRole, actorLabel } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Status of the configured ingestion source. */
export async function GET() {
  const state = await getState();
  return NextResponse.json({
    source: describeSource(state),
    lastIngestAt: state.lastIngestAt ?? null,
    events: state.events.length,
  });
}

/** Pull from the configured source adapter and re-run detection. */
export async function POST() {
  const role = await currentRole();
  const result = await ingestFromSource(actorLabel(role));
  return NextResponse.json({ ok: !result.note || result.added > 0, ...result });
}
