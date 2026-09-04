import { NextResponse } from "next/server";
import { listBlockers, reportBlocker } from "@/store/db";
import { currentPlaceId, currentActor } from "@/lib/session";
import { authorize } from "@/lib/apiAuth";
import { BLOCKER_CATEGORIES, type BlockerCategory } from "@/domain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const blockers = await listBlockers(await currentPlaceId());
  return NextResponse.json({ count: blockers.length, blockers });
}

export async function POST(req: Request) {
  const auth = await authorize("blocker:manage");
  if ("response" in auth) return auth.response;

  let body: {
    exceptionId?: string;
    taskId?: string;
    title?: string;
    category?: string;
    description?: string;
    externalDependency?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!body.exceptionId && !body.taskId) {
    return NextResponse.json({ error: "exceptionId or taskId is required" }, { status: 400 });
  }
  if (!body.title?.trim() || !body.description?.trim()) {
    return NextResponse.json({ error: "title and description are required" }, { status: 400 });
  }
  if (!body.category || !BLOCKER_CATEGORIES.includes(body.category as BlockerCategory)) {
    return NextResponse.json({ error: `category must be one of ${BLOCKER_CATEGORIES.join(", ")}` }, { status: 400 });
  }

  const result = await reportBlocker({
    actor: await currentActor(),
    placeId: await currentPlaceId(),
    exceptionId: body.exceptionId,
    taskId: body.taskId,
    title: body.title.slice(0, 200),
    category: body.category as BlockerCategory,
    description: body.description.slice(0, 1000),
    externalDependency: body.externalDependency?.slice(0, 200),
  });

  if (!result) return NextResponse.json({ error: "target not found" }, { status: 404 });
  return NextResponse.json({ ok: true, blocker: result.blocker });
}
