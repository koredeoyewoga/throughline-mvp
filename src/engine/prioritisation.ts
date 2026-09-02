/**
 * Prioritisation Agent (deterministic, explainable).
 * There is no hidden model in the ranking path. Every point is attributable to
 * a named factor so a coordinator can see why one item sits above another.
 * The pattern weights, overdue rate/cap and severity cut-offs come from the
 * place config (Settings screen).
 */
import type { Severity } from "@/domain/types";
import type { Candidate } from "./coordinationAgent";
import { DEFAULT_CONFIG, type PlaceConfig } from "@/config/schema";

export interface ScoreResult {
  score: number;
  severity: Severity;
  breakdown: { factor: string; points: number }[];
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
function bool(v: unknown): boolean {
  return v === true;
}

export function score(candidate: Candidate, cfg: PlaceConfig["scoring"] = DEFAULT_CONFIG.scoring): ScoreResult {
  const s = candidate.signals;
  const breakdown: { factor: string; points: number }[] = [];
  const add = (factor: string, points: number) => {
    if (points !== 0) breakdown.push({ factor, points });
  };

  add(`Failure type — ${candidate.pattern.replace(/_/g, " ")}`, cfg.patternBase[candidate.pattern]);

  // Time overdue: N points per day past the expected point, capped.
  const overdueHours = num(s.overdueHours) || num(s.loopAgeHours);
  if (overdueHours > 0) {
    const pts = Math.min(cfg.overdueCap, Math.round((overdueHours / 24) * cfg.overduePointsPerDay));
    add(`Overdue by ${Math.round(overdueHours / 24)} day(s)`, pts);
  }

  // Consequence signals.
  if (bool(s.stillInBed)) add("Patient still occupying an acute bed", 20);
  if (bool(s.clinicalWindowBreached)) add("Clinical timeframe in the summary has passed", 10);
  if (num(s.rejectionCount) >= 2) add("Referral rejected two or more times", 12);
  if (bool(s.hasWardEscalation) || bool(s.hasGpEscalation) || bool(s.hasCarerConcern) || bool(s.hasPatientComplaint))
    add("A person has already raised this", 6);
  if (bool(s.livesAlone)) add("Patient lives alone", 5);
  if (bool(s.recurrentFalls)) add("Recurrent falls — injury risk", 5);
  if (bool(s.vulnerable)) add("Additional vulnerability flags", 4);
  if (bool(s.capacityBlocked)) add("A virtual-ward place is blocked", 8);
  if (bool(s.providerFault)) add("The service, not the patient, caused the gap", 6);

  let total = breakdown.reduce((sum, b) => sum + b.points, 0);

  // Low detector confidence tempers the score.
  if (candidate.confidence === "low") {
    const before = total;
    total = Math.round(total * 0.8);
    add("Detector confidence is low", total - before);
  } else if (candidate.confidence === "medium") {
    const before = total;
    total = Math.round(total * 0.92);
    add("Detector confidence is medium", total - before);
  }

  const clamped = Math.max(0, Math.min(100, total));
  const severity: Severity =
    clamped >= cfg.severityHighAt ? "high" : clamped >= cfg.severityMediumAt ? "medium" : "low";
  return { score: clamped, severity, breakdown };
}
