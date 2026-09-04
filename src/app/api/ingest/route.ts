import { NextResponse } from "next/server";
import { getState, ingestFromSource } from "@/store/db";
import { describeSource } from "@/adapters";
import { actorLabel } from "@/lib/session";
import { authorize } from "@/lib/apiAuth";

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
  const auth = await authorize("source:ingest");
  if ("response" in auth) return auth.response;
  const result = await ingestFromSource(actorLabel(auth.role));
  return NextResponse.json({ ok: !result.note || result.added > 0, ...result });
}
