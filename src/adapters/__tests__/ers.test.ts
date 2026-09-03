import { describe, it, expect } from "vitest";
import { mapErsReferral, mapErsWorklist, type ErsReferralRequest } from "../ers/mapErs";
import { ctx, ADA } from "./fixtures";

const baseReferral: ErsReferralRequest = {
  id: "R123",
  ubrn: "0000-0000-0000",
  specialty: "Falls Service",
  creationDateTime: "2026-08-14T09:00:00Z",
  lastEventDateTime: "2026-08-18T11:00:00Z",
  patient: { nhsNumber: ADA.nhsNumber },
  referringOrganisation: { odsCode: "RA9" },
  referredToService: { odsCode: "RY7" },
  clinicalInformation: "Recurrent falls, needs strength & balance assessment.",
};

describe("mapErsReferral", () => {
  it("emits referral_made at creation, routed referrer -> service", () => {
    const events = mapErsReferral(baseReferral, ctx);
    const made = events.find((e) => e.type === "referral_made")!;
    expect(made.at).toBe("2026-08-14T09:00:00.000Z");
    expect(made.fromOrgId).toBe("org-mft");
    expect(made.toOrgId).toBe("org-mch");
    expect(made.documentText).toContain("Recurrent falls");
  });

  it("maps terminal statuses to the follow-up event", () => {
    expect(mapErsReferral({ ...baseReferral, status: "ACCEPTED" }, ctx).some((e) => e.type === "referral_accepted")).toBe(true);
    expect(mapErsReferral({ ...baseReferral, status: "REJECTED" }, ctx).some((e) => e.type === "referral_rejected")).toBe(true);
    expect(mapErsReferral({ ...baseReferral, status: "TRIAGE" }, ctx).some((e) => e.type === "referral_acknowledged")).toBe(true);
  });

  it("drops a referral for a patient not in this place", () => {
    expect(mapErsReferral({ ...baseReferral, patient: { nhsNumber: "9999999999" } }, ctx)).toEqual([]);
  });

  it("worklist mapping de-duplicates and sorts", () => {
    const events = mapErsWorklist([baseReferral, baseReferral, { ...baseReferral, status: "ACCEPTED" }], ctx);
    expect(events.filter((e) => e.type === "referral_made")).toHaveLength(1);
    expect(events).toEqual([...events].sort((a, b) => a.at.localeCompare(b.at)));
  });
});
