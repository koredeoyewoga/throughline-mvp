import { NextResponse } from "next/server";
import { getConfigWithErrors, saveConfig, resetConfig } from "@/config";
import { DEFAULT_CONFIG } from "@/config/schema";
import { slaRows } from "@/config/apply";
import { PATHWAYS } from "@/domain/pathways";
import { refreshDetection } from "@/store/db";
import { currentRole, actorLabel } from "@/lib/session";

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
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const { config, errors } = saveConfig(body);
  const role = await currentRole();
  await refreshDetection(actorLabel(role) + " (config change)");
  return NextResponse.json({ ok: true, config, errors, slaRows: slaRows(PATHWAYS, config), defaults: DEFAULT_CONFIG });
}

export async function DELETE() {
  resetConfig();
  const role = await currentRole();
  await refreshDetection(actorLabel(role) + " (config reset)");
  return NextResponse.json({ ok: true, ...payload() });
}
