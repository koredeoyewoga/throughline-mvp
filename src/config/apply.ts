/**
 * Pure helpers that apply a PlaceConfig to the in-code defaults.
 */
import type { PlaceConfig } from "./schema";
import type { PathwayDefinition } from "@/domain/pathways";

/** Return a copy of the pathway list with any per-step SLA overrides applied. */
export function applySlaOverrides(
  pathways: PathwayDefinition[],
  overrides: PlaceConfig["pathwaySlaOverrides"],
): PathwayDefinition[] {
  return pathways.map((p) => ({
    ...p,
    steps: p.steps.map((s) => {
      const override = overrides[`${p.key}/${s.key}`];
      return typeof override === "number" ? { ...s, slaHours: override } : s;
    }),
  }));
}

/** Flatten the pathway list into rows the Settings UI can render. */
export function slaRows(pathways: PathwayDefinition[], config: PlaceConfig) {
  return pathways.flatMap((p) =>
    p.steps.map((s) => {
      const key = `${p.key}/${s.key}`;
      return {
        key,
        pathwayKey: p.key,
        pathwayLabel: p.label,
        stepKey: s.key,
        stepDescription: s.description,
        defaultHours: s.slaHours,
        currentHours: config.pathwaySlaOverrides[key] ?? s.slaHours,
        overridden: key in config.pathwaySlaOverrides,
      };
    }),
  );
}
