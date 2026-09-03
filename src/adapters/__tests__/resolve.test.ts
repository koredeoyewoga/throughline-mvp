import { describe, it, expect } from "vitest";
import { buildMapContext } from "../resolve";
import { PATIENTS } from "@/data/patients";
import { ORGANISATIONS } from "@/data/world";
import { ADA } from "./fixtures";

const ctx = buildMapContext(PATIENTS, ORGANISATIONS, "org-mft");

describe("patient resolution", () => {
  it("resolves a Patient/{throughline id} reference", () => {
    expect(ctx.resolvePatient({ reference: `Patient/${ADA.id}` })).toBe(ADA.id);
  });

  it("resolves a local MRN carried as the reference", () => {
    expect(ctx.resolvePatient({ reference: `Patient/${ADA.mftLocalId}` })).toBe(ADA.id);
    expect(ctx.resolvePatient({ localId: ADA.mftLocalId.toLowerCase() })).toBe(ADA.id);
  });

  it("resolves by NHS number, ignoring spacing", () => {
    expect(ctx.resolvePatient({ nhsNumber: "9990012201" })).toBe(ADA.id);
    expect(ctx.resolvePatient({ nhsNumber: "999 001 2201" })).toBe(ADA.id);
  });

  it("returns null for a patient not in this place (never invents one)", () => {
    expect(ctx.resolvePatient({ reference: "Patient/unknown-999" })).toBeNull();
    expect(ctx.resolvePatient({ nhsNumber: "9999999999" })).toBeNull();
    expect(ctx.resolvePatient({})).toBeNull();
  });
});

describe("organisation resolution", () => {
  it("resolves an Organization/{id} reference", () => {
    expect(ctx.resolveOrg({ reference: "Organization/org-mch" })).toBe("org-mch");
  });

  it("resolves a synthetic ODS code", () => {
    expect(ctx.resolveOrg({ identifier: "RY7" })).toBe("org-mch");
    expect(ctx.resolveOrg({ identifier: "ra9" })).toBe("org-mft");
  });

  it("resolves by name substring", () => {
    expect(ctx.resolveOrg({ name: "Meadowford Community Health" })).toBe("org-mch");
  });

  it("falls back to the default org when nothing matches", () => {
    expect(ctx.resolveOrg({ reference: "Organization/nope" })).toBe("org-mft");
    expect(ctx.resolveOrg({})).toBe("org-mft");
  });
});
