/**
 * Transfer of Care (ToC) / Inpatient Discharge Summary -> `SourceEvent`s.
 *
 * Accepts the structured form of a ToC document (the shape a FHIR `Composition`
 * document Bundle collapses to once sections are flattened). Produces:
 *   - one `discharge_summary_issued` event carrying the whole document text, and
 *   - one `task_expected` event per line in the "requested actions" section.
 *
 * The requested-actions split is the only place free text drives event
 * creation, and it mirrors the existing Document Agent: the resulting
 * `task_expected` events are low-confidence and are surfaced for a human to
 * confirm (governance `fact-check-required`), never actioned automatically.
 */
import type { SourceEvent } from "@/domain/types";
import type { MapContext } from "../types";

export interface TocSection {
  title: string;
  text: string;
}

export interface TransferOfCareDocument {
  id: string;
  patient?: { nhsNumber?: string; id?: string };
  dischargeDateTime?: string;
  authoringOrganisation?: { odsCode?: string; name?: string };
  /** ODS/name of the practice or team the actions are addressed to. */
  recipientOrganisation?: { odsCode?: string; name?: string };
  pathway?: string;
  sections: TocSection[];
}

const ACTION_SECTION_RE = /(requested actions|actions for|plan and requested|community actions|gp actions|follow[- ]?up actions|actions required)/i;
const BULLET_RE = /^\s*(?:[-*•·]|\d+[.)]|\(\d+\))\s*/;

function toIso(s?: string): string | undefined {
  if (!s) return undefined;
  const t = Date.parse(s);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
}

function actionLines(text: string): string[] {
  return text
    .split(/\r?\n|;(?=\s*[A-Z0-9])/)
    .map((l) => l.replace(BULLET_RE, "").trim())
    .filter((l) => l.length > 3);
}

export function mapTransferOfCare(doc: TransferOfCareDocument, ctx: MapContext): SourceEvent[] {
  const patientId = ctx.resolvePatient({
    nhsNumber: doc.patient?.nhsNumber?.replace(/\s/g, ""),
    localId: doc.patient?.id,
  });
  const at = toIso(doc.dischargeDateTime);
  if (!patientId || !at) return [];

  const fromOrgId = ctx.resolveOrg({
    identifier: doc.authoringOrganisation?.odsCode,
    name: doc.authoringOrganisation?.name,
  });
  const toOrgId = ctx.resolveOrg({
    identifier: doc.recipientOrganisation?.odsCode,
    name: doc.recipientOrganisation?.name,
  });

  const fullText = doc.sections
    .map((s) => `${s.title.toUpperCase()}\n${s.text.trim()}`)
    .join("\n\n")
    .trim();

  const out: SourceEvent[] = [
    {
      id: `toc-${doc.id}-summary`,
      patientId,
      type: "discharge_summary_issued",
      at,
      fromOrgId,
      ...(toOrgId && toOrgId !== fromOrgId ? { toOrgId } : {}),
      ...(doc.pathway ? { pathway: doc.pathway } : {}),
      summary: "Transfer of Care summary issued",
      documentText: fullText || undefined,
    },
  ];

  const actionSection = doc.sections.find((s) => ACTION_SECTION_RE.test(s.title));
  if (actionSection) {
    actionLines(actionSection.text).forEach((line, i) => {
      out.push({
        id: `toc-${doc.id}-action-${i + 1}`,
        patientId,
        type: "task_expected",
        at,
        fromOrgId,
        ...(toOrgId && toOrgId !== fromOrgId ? { toOrgId } : {}),
        ...(doc.pathway ? { pathway: doc.pathway } : {}),
        summary: line.length > 120 ? `${line.slice(0, 117)}…` : line,
        documentText: line,
      });
    });
  }

  return out;
}
