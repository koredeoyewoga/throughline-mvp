/**
 * Data Intelligence Agent (deterministic).
 * Builds the pathway-state model: for each patient and each pathway definition,
 * which expected steps are satisfied and by how long each unsatisfied step is
 * overdue.
 *
 * Permissions: read-only over the ingested event set. No free-form access.
 */
import type { PathwayState, SourceEvent, Patient } from "@/domain/types";
import { PATHWAYS, type PathwayDefinition } from "@/domain/pathways";

const HOUR = 3600 * 1000;

export function buildPathwayStates(
  patients: Patient[],
  events: SourceEvent[],
  now: string,
  pathways: PathwayDefinition[] = PATHWAYS,
): PathwayState[] {
  const nowMs = Date.parse(now);
  const states: PathwayState[] = [];

  for (const def of pathways) {
    for (const patient of patients) {
      const pEvents = events
        .filter((e) => e.patientId === patient.id)
        .sort((a, b) => a.at.localeCompare(b.at));

      const triggers = pEvents.filter((e) => e.type === def.triggerEvent && e.pathway === def.key);

      for (const trigger of triggers) {
        const triggerMs = Date.parse(trigger.at);
        const laterEvents = pEvents.filter(
          (e) => e.id !== trigger.id && e.pathway === def.key && Date.parse(e.at) >= triggerMs,
        );

        const steps = def.steps.map((step) => {
          const dueMs = triggerMs + step.slaHours * HOUR;
          const satisfier = laterEvents.find((e) => step.satisfiedBy.includes(e.type));
          const satisfied = Boolean(satisfier);
          const overdueHours = satisfied ? 0 : Math.max(0, Math.round((nowMs - dueMs) / HOUR));
          return {
            step,
            satisfied,
            satisfiedByEventId: satisfier?.id,
            dueAt: new Date(dueMs).toISOString(),
            overdueHours,
          };
        });

        states.push({
          patientId: patient.id,
          pathway: def.key,
          triggeredBy: trigger.id,
          triggeredAt: trigger.at,
          steps,
        });
      }
    }
  }

  return states;
}

/** Entity-resolution summary for display — how confidently this patient was joined across systems. */
export function resolutionSummary(patient: Patient): { systems: number; lowestConfidence: number } {
  const confidences = patient.sourceIds.map((s) => s.confidence);
  return {
    systems: patient.sourceIds.length,
    lowestConfidence: confidences.length ? Math.min(...confidences) : 1,
  };
}
