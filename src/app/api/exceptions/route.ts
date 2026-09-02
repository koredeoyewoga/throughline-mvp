import { NextResponse } from "next/server";
import { listExceptions } from "@/store/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const exceptions = await listExceptions();
  return NextResponse.json({ count: exceptions.length, exceptions });
}
