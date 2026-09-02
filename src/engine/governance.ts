/**
 * Governance Agent (deterministic).
 * Runs before a human sees the recommended action. It can only pass or flag —
 * it never rewrites the recommendation and never blocks a human from acting.
 */
import type { GovernanceCheck } from "@/domain/types";
import type { Candidate } from "./coordinationAgent";

const CLINICAL_DECISION_RE = /\b(prescribe|diagnos(e|is)|titrate|section|do not resuscitate)\b/i;

export function checkAction(candidate: Candidate, recommendedAction: string): {
  checks: GovernanceCheck[];
  needsFactCheck: boolean;
} {
  const checks: GovernanceCheck[] = [];

  checks.push({
    rule: "human-in-the-loop",
    outcome: "pass",
    detail: "The recommendation is presented for a person to approve, amend, reject or escalate. Nothing is sent automatically.",
  });

  checks.push({
    rule: "no-clinical-decision",
    outcome: CLINICAL_DECISION_RE.test(recommendedAction) ? "flag" : "pass",
    detail: CLINICAL_DECISION_RE.test(recommendedAction)
      ? "The drafted action appears to contain a clinical decision. It must be routed to a clinician, not actioned as coordination."
      : "The drafted action is a coordination step (contact, book, chase, escalate, hand over) — not a clinical decision.",
  });

  checks.push({
    rule: "data-sharing-basis",
    outcome: "pass",
    detail:
      "Cross-organisation coordination for direct care within the Meadowford place. Covered by the place data sharing agreement (synthetic in this MVP).",
  });

  const heuristic = candidate.confidence !== "high" ||
    candidate.pattern === "duplicate_assessment" ||
    candidate.pattern === "handover_gap";
  checks.push({
    rule: "fact-check-required",
    outcome: heuristic ? "flag" : "pass",
    detail: heuristic
      ? "The match relies on a heuristic (e.g. text similarity or an inferred caseload). Confirm the facts with the source teams before acting."
      : "The failure is inferred from structured events with clear expected steps.",
  });

  const needsFactCheck = checks.some((c) => c.rule === "fact-check-required" && c.outcome === "flag");
  return { checks, needsFactCheck };
}
