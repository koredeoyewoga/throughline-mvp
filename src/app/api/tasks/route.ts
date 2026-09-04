import { NextResponse } from "next/server";
import { listTasks } from "@/store/db";
import { currentPlaceId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fn = url.searchParams.get("function");
  const status = url.searchParams.get("status");
  let tasks = await listTasks(await currentPlaceId());
  if (fn) tasks = tasks.filter((t) => t.owner.functionArea === fn);
  if (status) tasks = tasks.filter((t) => t.status === status);
  return NextResponse.json({ count: tasks.length, tasks });
}
