import { NextResponse } from "next/server";
import { listExceptions } from "@/store/db";
import { currentPlaceId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const exceptions = await listExceptions(await currentPlaceId());
  return NextResponse.json({ count: exceptions.length, exceptions });
}
