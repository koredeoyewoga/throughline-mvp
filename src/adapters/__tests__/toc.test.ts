import { describe, it, expect } from "vitest";
import { mapTransferOfCare, type TransferOfCareDocument } from "../toc/mapTransferOfCare";
import { ctx, ADA } from "./fixtures";

const doc: TransferOfCareDocument = {
  id: "TOC-9",
  patient: { nhsNumber: ADA.nhsNumber },
  dischargeDateTime: "2026-08-15T16:00:00Z",
  authoringOrganisation: { odsCode: "RA9" },
  recipientOrganisation: { odsCode: "A81001" },
  sections: [
    { title: "Diagnoses", text: "1. Left wrist fracture. 2. Frailty." },
    {
      title: "Plan and requested actions",
      text: "- District nurse to review leg-ulcer dressing within 72 hours\n- GP to review antihypertensives in 2 weeks\n- Refer to falls clinic if further unsteadiness",
    },
    { title: "Information given to patient", text: "Cast care leaflet provided." },
  ],
};

describe("mapTransferOfCare", () => {
  const events = mapTransferOfCare(doc, ctx);

  it("emits one discharge_summary_issued carrying the whole document", () => {
    const summary = events.filter((e) => e.type === "discharge_summary_issued");
    expect(summary).toHaveLength(1);
    expect(summary[0].at).toBe("2026-08-15T16:00:00.000Z");
    expect(summary[0].fromOrgId).toBe("org-mft");
    expect(summary[0].toOrgId).toBe("org-rpcn");
    expect(summary[0].documentText).toContain("PLAN AND REQUESTED ACTIONS");
    expect(summary[0].documentText).toContain("Cast care leaflet");
  });

  it("emits a task_expected per requested-action line", () => {
    const tasks = events.filter((e) => e.type === "task_expected");
    expect(tasks).toHaveLength(3);
    expect(tasks[0].summary).toContain("leg-ulcer dressing");
    expect(tasks[0].documentText).toBe("District nurse to review leg-ulcer dressing within 72 hours");
  });

  it("returns nothing when the patient is unknown or there is no discharge time", () => {
    expect(mapTransferOfCare({ ...doc, patient: { nhsNumber: "9999999999" } }, ctx)).toEqual([]);
    expect(mapTransferOfCare({ ...doc, dischargeDateTime: undefined }, ctx)).toEqual([]);
  });

  it("does not extract actions from a document with no requested-actions section", () => {
    const noActions = mapTransferOfCare({ ...doc, sections: [doc.sections[0], doc.sections[2]] }, ctx);
    expect(noActions.every((e) => e.type === "discharge_summary_issued")).toBe(true);
  });
});
