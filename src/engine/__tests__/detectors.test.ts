import { describe, it, expect, beforeEach } from "vitest";
import { buildPathwayStates } from "@/engine/dataIntelligence";
import { detect, type Candidate } from "@/engine/coordinationAgent";
import type { Patient, SourceEvent } from "@/domain/types";
import { ev, mkPatient, daysBefore, resetSeq, T0 } from "./helpers";

function run(patients: Patient[], events: SourceEvent[]): Candidate[] {
  const states = buildPathwayStates(patients, events, T0);
  return detect(patients, events, states, T0);
}

function patterns(cands: Candidate[]): string[] {
  return cands.map((c) => c.pattern).sort();
}

beforeEach(resetSeq);

describe("referral_unactioned", () => {
  it("fires when a discharge:frailty referral is made but never accepted past SLA", () => {
    const p = mkPatient("p1", { flags: ["lives alone"] });
    const events = [
      ev("p1", "admission", daysBefore(9), "org-mft", { toOrgId: "org-mft" }),
      ev("p1", "discharge_ready", daysBefore(6), "org-mft", { pathway: "discharge:frailty" }),
      ev("p1", "referral_made", daysBefore(6), "org-mft", { pathway: "discharge:frailty", toOrgId: "org-mch" }),
    ];
    const cands = run([p], events);
    const c = cands.find((x) => x.pattern === "referral_unactioned");
    expect(c).toBeTruthy();
    expect(c!.severityHint).toBe("high"); // still in a bed (admission, no visit_completed)
    expect(c!.owner.orgId).toBe("org-mch");
    expect(c!.signals.stillInBed).toBe(true);
  });

  it("does not fire once the referral has been accepted", () => {
    const p = mkPatient("p2");
    const events = [
      ev("p2", "discharge_ready", daysBefore(6), "org-mft", { pathway: "discharge:frailty" }),
      ev("p2", "referral_made", daysBefore(6), "org-mft", { pathway: "discharge:frailty", toOrgId: "org-mch" }),
      ev("p2", "referral_accepted", daysBefore(5), "org-mch", { pathway: "discharge:frailty" }),
    ];
    expect(patterns(run([p], events))).not.toContain("referral_unactioned");
  });
});

describe("discharge_task_dropped", () => {
  it("fires when a district-nursing task is extracted but never picked up", () => {
    const p = mkPatient("p3");
    const events = [
      ev("p3", "discharge_summary_issued", daysBefore(4), "org-mft", {
        pathway: "discharge:district_nursing",
        toOrgId: "org-mch",
        documentText: "District nurse to review the wound dressing within 48-72 hours.",
      }),
      ev("p3", "task_expected", daysBefore(4), "org-mft", {
        pathway: "discharge:district_nursing",
        toOrgId: "org-mch",
        data: { timeframeHours: 72 },
      }),
    ];
    const c = run([p], events).find((x) => x.pattern === "discharge_task_dropped");
    expect(c).toBeTruthy();
    expect(c!.signals.clinicalWindowBreached).toBe(true); // task is 96h old, window 72h
    expect(c!.owner.functionArea).toBe("district_nursing");
  });

  it("does not fire when district nursing picked the task up in time", () => {
    const p = mkPatient("p4");
    const events = [
      ev("p4", "discharge_summary_issued", daysBefore(4), "org-mft", { pathway: "discharge:district_nursing" }),
      ev("p4", "task_expected", daysBefore(4), "org-mft", { pathway: "discharge:district_nursing", toOrgId: "org-mch" }),
      ev("p4", "referral_accepted", daysBefore(3), "org-mch", { pathway: "discharge:district_nursing" }),
    ];
    expect(patterns(run([p], events))).not.toContain("discharge_task_dropped");
  });
});

describe("referral_ping_pong", () => {
  it("requires at least two rejections with no acceptance afterwards", () => {
    const p = mkPatient("p5", { flags: ["recurrent falls"] });
    const events = [
      ev("p5", "referral_made", daysBefore(19), "org-rpcn", { pathway: "falls", toOrgId: "org-mch" }),
      ev("p5", "referral_rejected", daysBefore(15), "org-mch", { pathway: "falls" }),
      ev("p5", "referral_made", daysBefore(14), "org-rpcn", { pathway: "falls", toOrgId: "org-mft" }),
      ev("p5", "referral_rejected", daysBefore(9), "org-mft", { pathway: "falls" }),
    ];
    const c = run([p], events).find((x) => x.pattern === "referral_ping_pong");
    expect(c).toBeTruthy();
    expect(c!.signals.rejectionCount).toBe(2);
    expect(Number(c!.signals.loopAgeHours)).toBeGreaterThan(18 * 24);
  });

  it("does not fire after a single rejection", () => {
    const p = mkPatient("p6");
    const events = [
      ev("p6", "referral_made", daysBefore(10), "org-rpcn", { pathway: "falls", toOrgId: "org-mch" }),
      ev("p6", "referral_rejected", daysBefore(6), "org-mch", { pathway: "falls" }),
    ];
    expect(patterns(run([p], events))).not.toContain("referral_ping_pong");
  });

  it("does not fire once a service accepts after the last rejection", () => {
    const p = mkPatient("p7");
    const events = [
      ev("p7", "referral_made", daysBefore(19), "org-rpcn", { pathway: "falls", toOrgId: "org-mch" }),
      ev("p7", "referral_rejected", daysBefore(15), "org-mch", { pathway: "falls" }),
      ev("p7", "referral_rejected", daysBefore(9), "org-mft", { pathway: "falls" }),
      ev("p7", "referral_accepted", daysBefore(3), "org-mch", { pathway: "falls" }),
    ];
    expect(patterns(run([p], events))).not.toContain("referral_ping_pong");
  });
});

describe("duplicate_assessment", () => {
  it("fires for two same-domain assessments by different orgs within 10 days", () => {
    const p = mkPatient("p8");
    const events = [
      ev("p8", "assessment_completed", daysBefore(8), "org-mch", { data: { domain: "reablement" } }),
      ev("p8", "assessment_completed", daysBefore(4), "org-council", { data: { domain: "reablement" } }),
    ];
    const c = run([p], events).find((x) => x.pattern === "duplicate_assessment");
    expect(c).toBeTruthy();
    expect(c!.confidence).toBe("medium");
    expect(c!.signals.gapDays).toBe(4);
  });

  it("does not fire for the same org, different domains, or a wide gap", () => {
    const sameOrg = mkPatient("p9");
    const diffDomain = mkPatient("p10");
    const wideGap = mkPatient("p11");
    const events = [
      ev("p9", "assessment_completed", daysBefore(8), "org-mch", { data: { domain: "reablement" } }),
      ev("p9", "assessment_completed", daysBefore(4), "org-mch", { data: { domain: "reablement" } }),
      ev("p10", "assessment_completed", daysBefore(8), "org-mch", { data: { domain: "reablement" } }),
      ev("p10", "assessment_completed", daysBefore(4), "org-council", { data: { domain: "mental health" } }),
      ev("p11", "assessment_completed", daysBefore(30), "org-mch", { data: { domain: "reablement" } }),
      ev("p11", "assessment_completed", daysBefore(4), "org-council", { data: { domain: "reablement" } }),
    ];
    expect(patterns(run([sameOrg, diffDomain, wideGap], events))).not.toContain("duplicate_assessment");
  });
});

describe("loop_not_closed vs referral_unactioned are mutually exclusive", () => {
  it("emits loop_not_closed (not referral_unactioned) when accepted + booked but not completed", () => {
    const p = mkPatient("p12");
    const events = [
      ev("p12", "discharge_ready", daysBefore(10), "org-mft", { pathway: "discharge:frailty" }),
      ev("p12", "referral_made", daysBefore(10), "org-mft", { pathway: "discharge:frailty", toOrgId: "org-mch" }),
      ev("p12", "referral_accepted", daysBefore(8), "org-mch", { pathway: "discharge:frailty" }),
      ev("p12", "visit_booked", daysBefore(7), "org-mch", { pathway: "discharge:frailty" }),
    ];
    const p2 = patterns(run([p], events));
    expect(p2).toContain("loop_not_closed");
    expect(p2).not.toContain("referral_unactioned");
  });
});

describe("dna_no_rebook", () => {
  it("fires for a DNA with no follow-up, and not when rebooked", () => {
    const missed = mkPatient("p13");
    const rebooked = mkPatient("p14");
    const events = [
      ev("p13", "appointment_scheduled", daysBefore(20), "org-mft", { pathway: "outpatient" }),
      ev("p13", "appointment_dna", daysBefore(8), "org-mft", { pathway: "outpatient" }),
      ev("p14", "appointment_scheduled", daysBefore(20), "org-mft", { pathway: "outpatient" }),
      ev("p14", "appointment_dna", daysBefore(8), "org-mft", { pathway: "outpatient" }),
      ev("p14", "appointment_scheduled", daysBefore(7), "org-mft", { pathway: "outpatient" }),
    ];
    const got = patterns(run([missed, rebooked], events));
    expect(got.filter((x) => x === "dna_no_rebook")).toHaveLength(1);
  });
});

describe("handover_gap", () => {
  it("fires when a known caseload patient is admitted with no handover", () => {
    const p = mkPatient("p15");
    const events = [
      ev("p15", "assessment_completed", daysBefore(25), "org-lakeside", { data: { domain: "mental health review" } }),
      ev("p15", "status_note", daysBefore(12), "org-lakeside"),
      ev("p15", "admission", daysBefore(2), "org-mft", { toOrgId: "org-mft" }),
    ];
    const c = run([p], events).find((x) => x.pattern === "handover_gap");
    expect(c).toBeTruthy();
    expect(c!.owner.orgId).toBe("org-lakeside");
    expect(c!.confidence).toBe("medium");
  });

  it("does not fire when the caseload team posts a handover after admission", () => {
    const p = mkPatient("p16");
    const events = [
      ev("p16", "assessment_completed", daysBefore(25), "org-lakeside", { data: { domain: "mental health review" } }),
      ev("p16", "admission", daysBefore(2), "org-mft", { toOrgId: "org-mft" }),
      ev("p16", "status_note", daysBefore(1), "org-lakeside", { toOrgId: "org-mft" }),
    ];
    expect(patterns(run([p], events))).not.toContain("handover_gap");
  });
});

describe("cancellation_no_rebook", () => {
  it("fires for a provider cancellation past the rebooking SLA with no follow-up", () => {
    const p = mkPatient("p17");
    const events = [
      ev("p17", "appointment_scheduled", daysBefore(24), "org-mft"),
      ev("p17", "appointment_cancelled", daysBefore(10), "org-mft", { data: { reason: "consultant unavailable" } }),
    ];
    const c = run([p], events).find((x) => x.pattern === "cancellation_no_rebook");
    expect(c).toBeTruthy();
    expect(c!.signals.providerFault).toBe(true);
    expect(c!.owner.orgId).toBe("org-mft");
  });

  it("does not fire when a new appointment is scheduled after the cancellation", () => {
    const p = mkPatient("p18");
    const events = [
      ev("p18", "appointment_cancelled", daysBefore(10), "org-mft", { data: { reason: "x" } }),
      ev("p18", "appointment_scheduled", daysBefore(7), "org-mft"),
    ];
    expect(patterns(run([p], events))).not.toContain("cancellation_no_rebook");
  });
});

describe("package_of_care_delay", () => {
  it("fires when a requested home-care package has not started, high if still in a bed", () => {
    const p = mkPatient("p19", { flags: ["lives alone"] });
    const events = [
      ev("p19", "admission", daysBefore(12), "org-mft", { toOrgId: "org-mft" }),
      ev("p19", "care_package_requested", daysBefore(5), "org-mft", {
        pathway: "discharge:social_care",
        toOrgId: "org-council",
      }),
    ];
    const c = run([p], events).find((x) => x.pattern === "package_of_care_delay");
    expect(c).toBeTruthy();
    expect(c!.severityHint).toBe("high");
    expect(c!.signals.stillInBed).toBe(true);
    expect(c!.owner.orgId).toBe("org-council");
  });

  it("does not fire once the package has started", () => {
    const p = mkPatient("p20");
    const events = [
      ev("p20", "care_package_requested", daysBefore(6), "org-mft", {
        pathway: "discharge:social_care",
        toOrgId: "org-council",
      }),
      ev("p20", "care_package_started", daysBefore(4), "org-council", { pathway: "discharge:social_care" }),
    ];
    expect(patterns(run([p], events))).not.toContain("package_of_care_delay");
  });
});

describe("onward_referral_not_made", () => {
  it("fires when a documented onward referral is overdue and never made", () => {
    const p = mkPatient("p21");
    const events = [
      ev("p21", "discharge_summary_issued", daysBefore(12), "org-mft", {
        toOrgId: "org-rpcn",
        documentText: "GP to refer to the memory assessment service.",
      }),
      ev("p21", "task_expected", daysBefore(12), "org-mft", {
        toOrgId: "org-rpcn",
        data: { action: "onward_referral", target: "the memory assessment service", slaHours: 168 },
      }),
    ];
    const c = run([p], events).find((x) => x.pattern === "onward_referral_not_made");
    expect(c).toBeTruthy();
    expect(c!.owner.orgId).toBe("org-rpcn");
    expect(c!.signals.target).toBe("the memory assessment service");
  });

  it("does not fire once the responsible org makes the referral", () => {
    const p = mkPatient("p22");
    const events = [
      ev("p22", "task_expected", daysBefore(12), "org-mft", {
        toOrgId: "org-rpcn",
        data: { action: "onward_referral", target: "the memory assessment service", slaHours: 168 },
      }),
      ev("p22", "referral_made", daysBefore(3), "org-rpcn"),
    ];
    expect(patterns(run([p], events))).not.toContain("onward_referral_not_made");
  });
});

describe("virtual_ward_step_down_stalled", () => {
  it("fires when a step-down-ready patient has no virtual-ward discharge", () => {
    const p = mkPatient("p23");
    const events = [
      ev("p23", "virtual_ward_admission", daysBefore(8), "org-mch"),
      ev("p23", "virtual_ward_step_down_ready", daysBefore(4), "org-mch", { pathway: "virtual_ward" }),
    ];
    const c = run([p], events).find((x) => x.pattern === "virtual_ward_step_down_stalled");
    expect(c).toBeTruthy();
    expect(c!.signals.capacityBlocked).toBe(true);
    expect(c!.owner.functionArea).toBe("virtual_ward");
  });

  it("does not fire once the virtual-ward discharge is recorded", () => {
    const p = mkPatient("p24");
    const events = [
      ev("p24", "virtual_ward_step_down_ready", daysBefore(4), "org-mch", { pathway: "virtual_ward" }),
      ev("p24", "virtual_ward_discharge", daysBefore(3), "org-mch", { pathway: "virtual_ward" }),
    ];
    expect(patterns(run([p], events))).not.toContain("virtual_ward_step_down_stalled");
  });
});
