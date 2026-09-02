/**
 * Detection pipeline.
 *
 *   ingest events -> pathway-state model -> coordination-failure detection
 *   -> deterministic prioritisation -> explanation/drafting -> governance checks
 *   -> reconcile with existing exceptions (preserve human decisions)
 */
import type { AppState, Exception } from "@/domain/types";
import { buildPathwayStates } from "./dataIntelligence";
import { detect } from "./coordinationAgent";
import { score } from "./prioritisation";
import { explain } from "./explain";
import { checkAction } from "./governance";

export async function runDetection(state: AppState): Promise<Exception[]> {
  const now = state.now;
  const states = buildPathwayStates(state.patients, state.events, now);
  const candidates = detect(state.patients, state.events, states, now);

  const existingByKey = new Map<string, Exception>(
    state.exceptions.map((e) => [`${e.patientId}:${e.pattern}`, e]),
  );

  const nowStamp = new Date().toISOString();
  const next: Exception[] = [];

  for (const c of candidates) {
    const key = `${c.patientId}:${c.pattern}`;
    const prior = existingByKey.get(key);
    const scored = score(c);
    const ex = await explain(c);
    const gov = checkAction(c, ex.recommendedAction);

    // A prior exception the human already dealt with stays dealt with.
    if (prior && (prior.status === "closed" || prior.status === "escalated")) {
      next.push({
        ...prior,
        score: scored.score,
        severity: scored.severity,
        scoreBreakdown: scored.breakdown,
        why: ex.why,
        whySource: ex.whySource,
        evidence: c.evidence,
        recommendedAction: ex.recommendedAction,
        governance: gov.checks,
        needsFactCheck: gov.needsFactCheck,
        updatedAt: nowStamp,
      });
      continue;
    }

    next.push({
      id: prior?.id ?? `exc-${key.replace(/[^a-z0-9]+/gi, "-")}`,
      patientId: c.patientId,
      placeId: c.placeId,
      pattern: c.pattern,
      severity: scored.severity,
      score: scored.score,
      scoreBreakdown: scored.breakdown,
      title: c.title,
      why: ex.why,
      whySource: ex.whySource,
      evidence: c.evidence,
      recommendedAction: ex.recommendedAction,
      owner: c.owner,
      confidence: c.confidence,
      status: prior?.status ?? "open",
      createdAt: prior?.createdAt ?? nowStamp,
      updatedAt: nowStamp,
      decisions: prior?.decisions ?? [],
      governance: gov.checks,
      needsFactCheck: gov.needsFactCheck,
    });
  }

  // Exceptions that had a candidate before but no longer do — the pathway moved on.
  const liveKeys = new Set(candidates.map((c) => `${c.patientId}:${c.pattern}`));
  for (const prior of state.exceptions) {
    const key = `${prior.patientId}:${prior.pattern}`;
    if (liveKeys.has(key)) continue;
    if (prior.status === "closed") {
      next.push(prior);
      continue;
    }
    next.push({
      ...prior,
      status: "closed",
      updatedAt: nowStamp,
      decisions: [
        ...prior.decisions,
        {
          id: `dec-auto-${Date.now()}`,
          kind: "close",
          actor: "system",
          at: nowStamp,
          note: "Auto-closed: the expected step is now satisfied in the source data.",
        },
      ],
    });
  }

  // Highest score first; ties broken by newest.
  next.sort((a, b) => b.score - a.score || b.updatedAt.localeCompare(a.updatedAt));
  return next;
}
