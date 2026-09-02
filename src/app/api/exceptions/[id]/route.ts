import { NextResponse } from "next/server";
import { getException } from "@/store/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const exception = await getException(id);
  if (!exception) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(exception);
}
