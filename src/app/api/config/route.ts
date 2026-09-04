import { NextResponse } from "next/server";
import { getConfigWithErrors, saveConfig, resetConfig } from "@/config";
import { DEFAULT_CONFIG } from "@/config/schema";
import { slaRows } from "@/config/apply";
import { PATHWAYS } from "@/domain/pathways";
import { refreshDetection } from "@/store/db";
import { actorLabel } from "@/lib/session";
import { authorize } from "@/lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function payload() {
  const { config, errors } = getConfigWithErrors();
  return {
    config,
    defaults: DEFAULT_CONFIG,
    errors,
    slaRows: slaRows(PATHWAYS, config),
  };
}

export async function GET() {
  return NextResponse.json(payload());
}

export async function PUT(req: Request) {
  const auth = await authorize("config:edit");
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const { config, errors } = saveConfig(body);
  await refreshDetection(actorLabel(auth.role) + " (config change)");
  return NextResponse.json({ ok: true, config, errors, slaRows: slaRows(PATHWAYS, config), defaults: DEFAULT_CONFIG });
}

export async function DELETE() {
  const auth = await authorize("config:reset");
  if ("response" in auth) return auth.response;

  resetConfig();
  await refreshDetection(actorLabel(auth.role) + " (config reset)");
  return NextResponse.json({ ok: true, ...payload() });
}
