import { describe, it, expect } from "vitest";
import { DEFAULT_CONFIG, validateConfig } from "@/config/schema";
import { applySlaOverrides } from "@/config/apply";
import { PATHWAYS } from "@/domain/pathways";
import { buildPathwayStates } from "@/engine/dataIntelligence";
import { detect } from "@/engine/coordinationAgent";
import { PATIENTS } from "@/data/patients";
import { EVENTS, NOW } from "@/data/events";

describe("validateConfig", () => {
  it("returns the defaults for empty or junk input", () => {
    expect(validateConfig({}).config).toEqual(DEFAULT_CONFIG);
    expect(validateConfig(null).config).toEqual(DEFAULT_CONFIG);
    expect(validateConfig("nope").config).toEqual(DEFAULT_CONFIG);
    expect(validateConfig({}).errors).toEqual([]);
  });

  it("clamps an out-of-range threshold and reports it", () => {
    const { config, errors } = validateConfig({ thresholds: { pingPongMinRejections: 99 } });
    expect(config.thresholds.pingPongMinRejections).toBe(5);
    expect(errors.some((e) => /pingPongMinRejections/.test(e))).toBe(true);
  });

  it("rejects a medium cut-off at or above the high cut-off", () => {
    const { config, errors } = validateConfig({ scoring: { severityHighAt: 40, severityMediumAt: 50 } });
    expect(config.scoring.severityHighAt).toBe(DEFAULT_CONFIG.scoring.severityHighAt);
    expect(config.scoring.severityMediumAt).toBe(DEFAULT_CONFIG.scoring.severityMediumAt);
    expect(errors.some((e) => /severityMediumAt/.test(e))).toBe(true);
  });

  it("keeps known pattern weights and ignores unknown ones", () => {
    const { config } = validateConfig({
      scoring: { patternBase: { referral_unactioned: 45, not_a_pattern: 99 } },
    });
    expect(config.scoring.patternBase.referral_unactioned).toBe(45);
    expect((config.scoring.patternBase as Record<string, number>).not_a_pattern).toBeUndefined();
  });

  it("resets the escalation thresholds if level 1 is not below level 2", () => {
    const { config, errors } = validateConfig({
      workflow: { escalateToLevel1AfterHours: 50, escalateToLevel2AfterHours: 20 },
    });
    expect(config.workflow.escalateToLevel1AfterHours).toBe(DEFAULT_CONFIG.workflow.escalateToLevel1AfterHours);
    expect(config.workflow.escalateToLevel2AfterHours).toBe(DEFAULT_CONFIG.workflow.escalateToLevel2AfterHours);
    expect(errors.some((e) => /escalateToLevel1AfterHours/.test(e))).toBe(true);
  });

  it("clamps the task SLA to its allowed range", () => {
    const { config, errors } = validateConfig({ workflow: { taskSlaHours: 5000 } });
    expect(config.workflow.taskSlaHours).toBe(720);
    expect(errors.some((e) => /taskSlaHours/.test(e))).toBe(true);
  });

  it("keeps valid SLA overrides and drops malformed keys", () => {
    const { config, errors } = validateConfig({
      pathwaySlaOverrides: { "discharge:frailty/referral_accepted": 96, "bad key!!": 10 },
    });
    expect(config.pathwaySlaOverrides["discharge:frailty/referral_accepted"]).toBe(96);
    expect(config.pathwaySlaOverrides["bad key!!"]).toBeUndefined();
    expect(errors.some((e) => /malformed key/.test(e))).toBe(true);
  });
});

describe("SLA overrides flow through to the pathway-state model", () => {
  it("a longer SLA removes the overdue state for a step", () => {
    const overridden = applySlaOverrides(PATHWAYS, { "discharge:district_nursing/dn_task_received": 500 });
    const states = buildPathwayStates(PATIENTS, EVENTS, NOW, overridden);
    const dn = states.find(
      (s) => s.patientId === "pat-george-fenwick" && s.pathway === "discharge:district_nursing",
    )!;
    const step = dn.steps.find((x) => x.step.key === "dn_task_received")!;
    expect(step.satisfied).toBe(false);
    expect(step.overdueHours).toBe(0); // no longer overdue with a 500h SLA
  });
});

describe("threshold overrides change detection", () => {
  it("raising the ping-pong minimum stops Derek's referral from flagging", () => {
    const states = buildPathwayStates(PATIENTS, EVENTS, NOW, PATHWAYS);
    const strict = { ...DEFAULT_CONFIG.thresholds, pingPongMinRejections: 3 };
    const candidates = detect(PATIENTS, EVENTS, states, NOW, strict);
    expect(candidates.some((c) => c.pattern === "referral_ping_pong")).toBe(false);
  });
});
