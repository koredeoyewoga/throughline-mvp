import { describe, it, expect } from "vitest";
import { mapBundle } from "../fhir/bundle";
import type { FhirBundle } from "../fhir/r4";
import { ctx, ADA } from "./fixtures";

const subject = { reference: `Patient/${ADA.id}` };

const bundle: FhirBundle = {
  resourceType: "Bundle",
  type: "searchset",
  entry: [
    {
      resource: {
        resourceType: "ServiceRequest",
        id: "sr1",
        status: "active",
        subject,
        authoredOn: "2026-08-20T10:00:00Z",
        requester: { reference: "Organization/org-mft" },
        performer: [{ reference: "Organization/org-mch" }],
        code: { text: "Rehab referral" },
      },
    },
    {
      // duplicate id -> collapses to one
      resource: {
        resourceType: "ServiceRequest",
        id: "sr1",
        status: "active",
        subject,
        authoredOn: "2026-08-20T10:00:00Z",
        requester: { reference: "Organization/org-mft" },
        performer: [{ reference: "Organization/org-mch" }],
        code: { text: "Rehab referral" },
      },
    },
    {
      resource: {
        resourceType: "Encounter",
        id: "enc1",
        status: "in-progress",
        subject,
        period: { start: "2026-08-10T08:00:00Z" },
      },
    },
    { resource: { resourceType: "ServiceRequest", id: "sr2", status: "active", subject: { reference: "Patient/not-here" } } },
    { resource: { resourceType: "Observation", id: "o1", subject } },
    { resource: { resourceType: "OperationOutcome", id: "oo1" } },
  ],
};

describe("mapBundle", () => {
  const result = mapBundle(bundle, ctx);

  it("de-duplicates by event id and sorts chronologically", () => {
    expect(result.events).toHaveLength(2);
    expect(result.events[0].type).toBe("admission"); // 2026-08-10
    expect(result.events[1].type).toBe("referral_made"); // 2026-08-20
  });

  it("counts an out-of-place patient as unmatched", () => {
    expect(result.unmatched).toBe(1);
  });

  it("counts a resource type it does not handle as ignored (and skips OperationOutcome)", () => {
    expect(result.ignored).toBe(1); // the Observation; OperationOutcome is not counted
  });
});
