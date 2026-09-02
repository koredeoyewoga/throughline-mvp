import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { acceptModelText, aiEnabled, rephraseExplanation } from "@/engine/llm";

describe("acceptModelText — the guard on model output", () => {
  it("keeps a normal rephrased sentence", () => {
    const s = "Ada's referral has not been accepted after four days and she is still in a hospital bed.";
    expect(acceptModelText(s)).toBe(s);
  });

  it("rejects empty / whitespace / nullish", () => {
    expect(acceptModelText("")).toBeNull();
    expect(acceptModelText("   \n ")).toBeNull();
    expect(acceptModelText(null)).toBeNull();
    expect(acceptModelText(undefined)).toBeNull();
  });

  it("honours the 'insufficient information' contract", () => {
    expect(acceptModelText("Insufficient information available.")).toBeNull();
    expect(acceptModelText("insufficient information available")).toBeNull();
    expect(acceptModelText("  Insufficient information available  ")).toBeNull();
  });

  it("rejects output that drifts into a clinical directive", () => {
    expect(acceptModelText("Tell the GP to prescribe amoxicillin and review in a week.")).toBeNull();
    expect(acceptModelText("The team should increase the dose and titrate to response.")).toBeNull();
    expect(acceptModelText("Consider a DNR discussion with the family.")).toBeNull();
  });

  it("rejects chat preamble", () => {
    expect(acceptModelText("Here's the rephrased explanation: the referral is overdue.")).toBeNull();
    expect(acceptModelText("Sure, the follow-up has not happened.")).toBeNull();
  });
});

describe("aiEnabled / rephraseExplanation gating", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    delete process.env.THROUGHLINE_AI_EXPLANATIONS;
    delete process.env.ANTHROPIC_API_KEY;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("is off unless both the flag and a key are set", () => {
    expect(aiEnabled()).toBe(false);
    process.env.THROUGHLINE_AI_EXPLANATIONS = "on";
    expect(aiEnabled()).toBe(false);
    process.env.ANTHROPIC_API_KEY = "sk-test";
    expect(aiEnabled()).toBe(true);
  });

  it("returns null without any network call when disabled", async () => {
    const out = await rephraseExplanation({
      pattern: "referral_unactioned",
      deterministicWhy: "x",
      facts: ["a", "b"],
      recommendedAction: "y",
    });
    expect(out).toBeNull();
  });
});
