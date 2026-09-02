import { describe, it, expect } from "vitest";
import { runDetection } from "@/engine/run";
import { buildSeed } from "@/data/seed";
import type { AppState, SourceEvent } from "@/domain/types";

function freshState(): AppState {
  return { ...buildSeed(), exceptions: [], audit: [], lastRunAt: new Date().toISOString() };
}

describe("runDetection on the synthetic seed", () => {
  it("finds exactly the eight seeded coordination failures", async () => {
    const state = freshState();
    const exceptions = await runDetection(state);
    const patterns = exceptions.map((e) => e.pattern).sort();
    expect(patterns).toEqual(
      [
        "discharge_task_dropped",
        "dna_no_rebook",
        "duplicate_assessment",
        "follow_up_missed",
        "handover_gap",
        "loop_not_closed",
        "referral_ping_pong",
        "referral_unactioned",
      ].sort(),
    );
  });

  it("produces no exception for the four healthy-pathway patients", async () => {
    const state = freshState();
    const exceptions = await runDetection(state);
    const healthy = ["pat-brian-ashworth", "pat-yvonne-clarke", "pat-nasrin-khan", "pat-leonard-price"];
    for (const id of healthy) {
      expect(exceptions.some((e) => e.patientId === id)).toBe(false);
    }
  });

  it("ranks the patient stuck in an acute bed first, and it is high severity", async () => {
    const exceptions = await runDetection(freshState());
    const top = exceptions[0];
    expect(top.pattern).toBe("referral_unactioned");
    expect(top.severity).toBe("high");
    expect(top.score).toBeGreaterThanOrEqual(80);
  });

  it("uses the deterministic explanation engine when the AI layer is off", async () => {
    const exceptions = await runDetection(freshState());
    expect(exceptions.every((e) => e.whySource === "deterministic")).toBe(true);
  });

  it("attaches governance checks and flags heuristic matches for fact-checking", async () => {
    const exceptions = await runDetection(freshState());
    for (const e of exceptions) {
      expect(e.governance.length).toBeGreaterThanOrEqual(4);
    }
    const dup = exceptions.find((e) => e.pattern === "duplicate_assessment")!;
    expect(dup.needsFactCheck).toBe(true);
    const stuck = exceptions.find((e) => e.pattern === "referral_unactioned")!;
    expect(stuck.needsFactCheck).toBe(false);
  });
});

describe("runDetection reconciliation with prior decisions", () => {
  it("auto-closes an exception once the resolving event appears, preserving id and createdAt", async () => {
    const state = freshState();
    state.exceptions = await runDetection(state);

    const target = state.exceptions.find((e) => e.pattern === "referral_unactioned")!;
    const originalId = target.id;
    const originalCreatedAt = target.createdAt;
    const otherIdsBefore = state.exceptions.filter((e) => e.id !== originalId).map((e) => e.id).sort();

    // Simulate the community provider accepting the referral (what "approve" injects).
    const resolving: SourceEvent = {
      id: "t-resolve-1",
      patientId: target.patientId,
      type: "referral_accepted",
      at: new Date().toISOString(),
      fromOrgId: "org-mch",
      pathway: "discharge:frailty",
      summary: "accepted",
    };
    state.events.push(resolving);
    state.events.sort((a, b) => a.at.localeCompare(b.at));

    state.exceptions = await runDetection(state);

    const after = state.exceptions.find((e) => e.id === originalId)!;
    expect(after).toBeTruthy();
    expect(after.status).toBe("closed");
    expect(after.createdAt).toBe(originalCreatedAt);
    expect(after.decisions.some((d) => d.actor === "system" && d.kind === "close")).toBe(true);

    // Every other exception is untouched.
    const otherIdsAfter = state.exceptions.filter((e) => e.id !== originalId).map((e) => e.id).sort();
    expect(otherIdsAfter).toEqual(otherIdsBefore);
  });

  it("does not reopen an item a human already closed", async () => {
    const state = freshState();
    state.exceptions = await runDetection(state);
    const target = state.exceptions.find((e) => e.pattern === "follow_up_missed")!;
    target.status = "closed";
    target.decisions.push({ id: "d1", kind: "reject", actor: "Care coordinator (demo)", at: new Date().toISOString() });

    state.exceptions = await runDetection(state);
    const after = state.exceptions.find((e) => e.id === target.id)!;
    expect(after.status).toBe("closed");
    expect(after.decisions.some((d) => d.kind === "reject")).toBe(true);
  });
});
