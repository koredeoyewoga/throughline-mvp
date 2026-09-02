/**
 * Place configuration — the operational knobs a place / ICB would tune to match
 * its own operating procedures. In production this is held per place with an
 * approval trail; in the MVP it lives in `.data/config.json` and is edited from
 * the Settings screen.
 *
 * `validateConfig` is pure and always returns a usable config: unknown keys are
 * dropped, out-of-range numbers are clamped, and every correction is reported so
 * the UI can show what it changed.
 */
import type { FailurePattern } from "@/domain/types";

export interface PlaceConfig {
  version: number;
  /** Per-step SLA overrides, keyed "<pathwayKey>/<stepKey>" -> hours. */
  pathwaySlaOverrides: Record<string, number>;
  thresholds: {
    duplicateAssessmentWindowDays: number;
    pingPongMinRejections: number;
    loopNotClosedMinOverdueHours: number;
    cancellationRebookSlaHours: number;
    onwardReferralDefaultSlaHours: number;
    handoverAdmissionWindowDays: number;
    caseloadLookbackDays: number;
  };
  scoring: {
    patternBase: Record<FailurePattern, number>;
    overduePointsPerDay: number;
    overdueCap: number;
    severityHighAt: number;
    severityMediumAt: number;
  };
  kpi: {
    coordinatorHoursPerResolvedItem: number;
    shareOfDelayAvoided: number;
  };
}

export const DEFAULT_CONFIG: PlaceConfig = {
  version: 1,
  pathwaySlaOverrides: {},
  thresholds: {
    duplicateAssessmentWindowDays: 10,
    pingPongMinRejections: 2,
    loopNotClosedMinOverdueHours: 48,
    cancellationRebookSlaHours: 120,
    onwardReferralDefaultSlaHours: 168,
    handoverAdmissionWindowDays: 7,
    caseloadLookbackDays: 200,
  },
  scoring: {
    patternBase: {
      referral_unactioned: 30,
      referral_ping_pong: 30,
      package_of_care_delay: 30,
      discharge_task_dropped: 28,
      onward_referral_not_made: 24,
      loop_not_closed: 22,
      virtual_ward_step_down_stalled: 22,
      follow_up_missed: 20,
      cancellation_no_rebook: 20,
      dna_no_rebook: 18,
      handover_gap: 18,
      duplicate_assessment: 10,
    },
    overduePointsPerDay: 6,
    overdueCap: 25,
    severityHighAt: 65,
    severityMediumAt: 40,
  },
  kpi: {
    coordinatorHoursPerResolvedItem: 0.5,
    shareOfDelayAvoided: 0.5,
  },
};

const FAILURE_PATTERNS = Object.keys(DEFAULT_CONFIG.scoring.patternBase) as FailurePattern[];

interface NumRule {
  min: number;
  max: number;
  integer?: boolean;
}

const THRESHOLD_RULES: Record<keyof PlaceConfig["thresholds"], NumRule> = {
  duplicateAssessmentWindowDays: { min: 1, max: 60, integer: true },
  pingPongMinRejections: { min: 1, max: 5, integer: true },
  loopNotClosedMinOverdueHours: { min: 0, max: 336 },
  cancellationRebookSlaHours: { min: 24, max: 720 },
  onwardReferralDefaultSlaHours: { min: 24, max: 1440 },
  handoverAdmissionWindowDays: { min: 1, max: 30, integer: true },
  caseloadLookbackDays: { min: 30, max: 365, integer: true },
};

const SCORING_RULES: Record<Exclude<keyof PlaceConfig["scoring"], "patternBase">, NumRule> = {
  overduePointsPerDay: { min: 0, max: 20 },
  overdueCap: { min: 0, max: 60 },
  severityHighAt: { min: 1, max: 100, integer: true },
  severityMediumAt: { min: 0, max: 99, integer: true },
};

function coerceNumber(
  value: unknown,
  rule: NumRule,
  fallback: number,
  label: string,
  errors: string[],
): number {
  let n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    errors.push(`${label}: not a number — kept ${fallback}`);
    return fallback;
  }
  if (rule.integer) n = Math.round(n);
  if (n < rule.min) {
    errors.push(`${label}: ${n} below minimum ${rule.min} — clamped`);
    n = rule.min;
  }
  if (n > rule.max) {
    errors.push(`${label}: ${n} above maximum ${rule.max} — clamped`);
    n = rule.max;
  }
  return n;
}

export function validateConfig(raw: unknown): { config: PlaceConfig; errors: string[] } {
  const errors: string[] = [];
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: PlaceConfig = structuredClone(DEFAULT_CONFIG);

  // thresholds
  const t = (input.thresholds ?? {}) as Record<string, unknown>;
  for (const key of Object.keys(THRESHOLD_RULES) as (keyof PlaceConfig["thresholds"])[]) {
    if (key in t) {
      out.thresholds[key] = coerceNumber(t[key], THRESHOLD_RULES[key], DEFAULT_CONFIG.thresholds[key], `thresholds.${key}`, errors);
    }
  }

  // scoring scalars
  const sc = (input.scoring ?? {}) as Record<string, unknown>;
  for (const key of Object.keys(SCORING_RULES) as (keyof typeof SCORING_RULES)[]) {
    if (key in sc) {
      out.scoring[key] = coerceNumber(sc[key], SCORING_RULES[key], DEFAULT_CONFIG.scoring[key], `scoring.${key}`, errors);
    }
  }
  if (out.scoring.severityMediumAt >= out.scoring.severityHighAt) {
    errors.push("scoring.severityMediumAt must be below severityHighAt — reset both to defaults");
    out.scoring.severityHighAt = DEFAULT_CONFIG.scoring.severityHighAt;
    out.scoring.severityMediumAt = DEFAULT_CONFIG.scoring.severityMediumAt;
  }

  // pattern base weights
  const pb = (sc.patternBase ?? {}) as Record<string, unknown>;
  for (const pattern of FAILURE_PATTERNS) {
    if (pattern in pb) {
      out.scoring.patternBase[pattern] = coerceNumber(
        pb[pattern],
        { min: 0, max: 60, integer: true },
        DEFAULT_CONFIG.scoring.patternBase[pattern],
        `scoring.patternBase.${pattern}`,
        errors,
      );
    }
  }

  // kpi assumptions
  const k = (input.kpi ?? {}) as Record<string, unknown>;
  if ("coordinatorHoursPerResolvedItem" in k) {
    out.kpi.coordinatorHoursPerResolvedItem = coerceNumber(
      k.coordinatorHoursPerResolvedItem,
      { min: 0, max: 8 },
      DEFAULT_CONFIG.kpi.coordinatorHoursPerResolvedItem,
      "kpi.coordinatorHoursPerResolvedItem",
      errors,
    );
  }
  if ("shareOfDelayAvoided" in k) {
    out.kpi.shareOfDelayAvoided = coerceNumber(
      k.shareOfDelayAvoided,
      { min: 0, max: 1 },
      DEFAULT_CONFIG.kpi.shareOfDelayAvoided,
      "kpi.shareOfDelayAvoided",
      errors,
    );
  }

  // pathway SLA overrides
  const ov = (input.pathwaySlaOverrides ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(ov)) {
    if (!/^[a-z][a-z0-9:_-]*\/[a-z][a-z0-9_-]*$/i.test(key)) {
      errors.push(`pathwaySlaOverrides: ignored malformed key "${key}"`);
      continue;
    }
    const n = coerceNumber(value, { min: 1, max: 2160 }, NaN, `pathwaySlaOverrides.${key}`, errors);
    if (Number.isFinite(n)) out.pathwaySlaOverrides[key] = n;
  }

  out.version = 1;
  return { config: out, errors };
}
