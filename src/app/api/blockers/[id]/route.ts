import { NextResponse } from "next/server";
import { getBlocker } from "@/store/db";
import { currentPlaceId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const blocker = await getBlocker(id, await currentPlaceId());
  if (!blocker) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(blocker);
}
