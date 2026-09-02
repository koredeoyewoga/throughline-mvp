import { describe, it, expect } from "vitest";
import { score } from "@/engine/prioritisation";
import type { Candidate } from "@/engine/coordinationAgent";

function candidate(overrides: Partial<Candidate>): Candidate {
  return {
    key: "p:referral_unactioned",
    patientId: "p",
    placeId: "place-meadowford",
    pattern: "referral_unactioned",
    title: "t",
    severityHint: "high",
    confidence: "high",
    owner: { functionArea: "therapies", orgId: "org-mch", label: "x" },
    evidence: [],
    signals: {},
    ...overrides,
  };
}

describe("prioritisation.score", () => {
  it("is deterministic and fully itemised", () => {
    const c = candidate({ signals: { overdueHours: 96, stillInBed: true, livesAlone: true } });
    const a = score(c);
    const b = score(c);
    expect(a).toEqual(b);
    const summed = a.breakdown.reduce((s, x) => s + x.points, 0);
    expect(summed).toBe(a.score);
  });

  it("ranks a patient stuck in a bed above a low-consequence overdue item", () => {
    const stuck = score(candidate({ signals: { overdueHours: 96, stillInBed: true, hasWardEscalation: true } }));
    const mild = score(
      candidate({ pattern: "dna_no_rebook", severityHint: "medium", signals: { overdueHours: 72 } }),
    );
    expect(stuck.score).toBeGreaterThan(mild.score);
    expect(stuck.severity).toBe("high");
  });

  it("caps the overdue contribution", () => {
    const a = score(candidate({ signals: { overdueHours: 5 * 24 } }));
    const b = score(candidate({ signals: { overdueHours: 60 * 24 } }));
    const aOverdue = a.breakdown.find((x) => /Overdue/.test(x.factor))?.points ?? 0;
    const bOverdue = b.breakdown.find((x) => /Overdue/.test(x.factor))?.points ?? 0;
    expect(bOverdue).toBeLessThanOrEqual(25);
    expect(bOverdue).toBeGreaterThanOrEqual(aOverdue);
  });

  it("tempers the score when detector confidence is low", () => {
    const hi = score(candidate({ confidence: "high", signals: { overdueHours: 96 } }));
    const lo = score(candidate({ confidence: "low", signals: { overdueHours: 96 } }));
    expect(lo.score).toBeLessThan(hi.score);
    expect(lo.breakdown.some((x) => /confidence is low/i.test(x.factor))).toBe(true);
  });

  it("clamps to 0..100", () => {
    const c = candidate({
      signals: {
        overdueHours: 999,
        stillInBed: true,
        clinicalWindowBreached: true,
        rejectionCount: 3,
        hasWardEscalation: true,
        livesAlone: true,
        recurrentFalls: true,
        vulnerable: true,
      },
    });
    const s = score(c);
    expect(s.score).toBeLessThanOrEqual(100);
    expect(s.score).toBeGreaterThanOrEqual(0);
  });
});
