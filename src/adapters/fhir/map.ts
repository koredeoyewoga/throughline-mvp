/**
 * FHIR R4 resource -> Throughline `SourceEvent` mapping.
 *
 * Pure and deterministic. The event `type`, `pathway` and org routing are
 * derived only from **structured** fields (resource type, `status`, recognised
 * codes, explicit pathway extension). Free text — notes, narrative `text.div`,
 * document bodies — is copied verbatim into `SourceEvent.documentText` and is
 * never inspected to decide what kind of event this is or who it is routed to.
 */
import type { SourceEvent, EventType } from "@/domain/types";
import type { MapContext } from "../types";
import type { FhirReference, FhirResource, FhirCodeableConcept } from "./r4";

const NHS_NUMBER_SYSTEM = "https://fhir.nhs.uk/Id/nhs-number";
const ODS_SYSTEM = "https://fhir.nhs.uk/Id/ods-organization-code";
const PATHWAY_EXTENSION = "https://throughline.health/fhir/StructureDefinition/pathway";

/**
 * Recognised referral/service codes -> pathway key. Structured input only.
 * A real interface maps its local code set here; unknown codes leave the
 * pathway unset and the engine still reasons over the event.
 */
const PATHWAY_BY_CODE: Record<string, string> = {
  // SNOMED CT (illustrative — synthetic mapping)
  "306136006": "discharge:district_nursing", // Referral to district nursing service
  "306239005": "discharge:frailty", // Referral to community rehabilitation
  "306285006": "falls", // Referral to falls clinic
  "770912009": "neighbourhood:complex", // Referral to integrated neighbourhood team
  "308440001": "outpatient", // Referral to outpatient service
  "737771008": "discharge:social_care", // Referral to social services
  "1231000175100": "virtual_ward", // Admission to virtual ward / hospital at home
};

function stripTags(html?: string): string | undefined {
  if (!html) return undefined;
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text || undefined;
}

function conceptText(c?: FhirCodeableConcept): string | undefined {
  if (!c) return undefined;
  return c.text || c.coding?.find((x) => x.display)?.display || c.coding?.find((x) => x.code)?.code;
}

function pathwayFromResource(r: FhirResource): string | undefined {
  const ext = Array.isArray(r.extension) ? (r.extension as { url?: string; valueString?: string }[]) : [];
  const explicit = ext.find((e) => e.url === PATHWAY_EXTENSION)?.valueString;
  if (explicit) return explicit;
  const concepts: (FhirCodeableConcept | undefined)[] = [
    r.code as FhirCodeableConcept | undefined,
    ...(Array.isArray(r.category) ? (r.category as FhirCodeableConcept[]) : [r.category as FhirCodeableConcept | undefined]),
  ];
  for (const c of concepts) {
    for (const coding of c?.coding ?? []) {
      if (coding.code && PATHWAY_BY_CODE[coding.code]) return PATHWAY_BY_CODE[coding.code];
    }
  }
  return undefined;
}

/** Resource types this mapper turns into events. */
export const HANDLED_RESOURCE_TYPES = [
  "ServiceRequest",
  "Encounter",
  "Appointment",
  "Communication",
  "DocumentReference",
  "Task",
] as const;

function patientRef(r: FhirResource): FhirReference | undefined {
  const direct = (r.subject as FhirReference) || (r.patient as FhirReference);
  if (direct) return direct;
  // Appointment / Encounter carry the patient in `participant[].actor`.
  const participants = Array.isArray(r.participant) ? (r.participant as { actor?: FhirReference }[]) : [];
  return participants.map((p) => p.actor).find((a) => a?.reference?.startsWith("Patient/") || a?.identifier);
}

function resolvePatientId(ref: FhirReference | undefined, ctx: MapContext): string | null {
  if (!ref) return null;
  const nhsNumber =
    ref.identifier?.system === NHS_NUMBER_SYSTEM ? ref.identifier.value?.replace(/\s/g, "") : undefined;
  return ctx.resolvePatient({ reference: ref.reference, nhsNumber });
}

/** The Throughline patient id a resource is about, or `null` if not in this place. */
export function resolveResourcePatient(r: FhirResource, ctx: MapContext): string | null {
  return resolvePatientId(patientRef(r), ctx);
}

function resolveOrgId(ref: FhirReference | undefined, ctx: MapContext): string | undefined {
  if (!ref) return undefined;
  const identifier =
    ref.identifier?.system === ODS_SYSTEM ? ref.identifier.value : ref.identifier?.value;
  return ctx.resolveOrg({ reference: ref.reference, identifier, name: ref.display });
}

function firstText(...parts: (string | undefined)[]): string {
  return parts.find((p) => p && p.trim().length > 0)?.trim() || "";
}

function decodeAttachment(att: { contentType?: string; data?: string; title?: string; url?: string } | undefined): string | undefined {
  if (!att) return undefined;
  if (att.data && (att.contentType?.startsWith("text/") || !att.contentType)) {
    try {
      return Buffer.from(att.data, "base64").toString("utf8").replace(/\s+/g, " ").trim() || undefined;
    } catch {
      /* fall through */
    }
  }
  return att.title || undefined;
}

interface Emit {
  type: EventType;
  at?: string;
  fromRef?: FhirReference;
  toRef?: FhirReference;
  summary: string;
  documentText?: string;
  pathway?: string;
}

/** Map one FHIR resource to zero or more `SourceEvent`s. */
export function mapResource(r: FhirResource, ctx: MapContext, seq: () => string): SourceEvent[] {
  const patientId = resolvePatientId(patientRef(r), ctx);
  if (!patientId) return []; // unmatched patient — caller counts these

  const narrative = stripTags(r.text?.div);
  const lastUpdated = r.meta?.lastUpdated;
  const emits: Emit[] = [];

  switch (r.resourceType) {
    case "ServiceRequest": {
      const status = String(r.status ?? "").toLowerCase();
      const type: EventType | undefined =
        status === "active" || status === "draft"
          ? "referral_made"
          : status === "on-hold"
            ? "referral_acknowledged"
            : status === "completed"
              ? "referral_accepted"
              : status === "revoked" || status === "entered-in-error"
                ? "referral_rejected"
                : undefined;
      if (!type) return [];
      const label = firstText(conceptText(r.code as FhirCodeableConcept), "Referral");
      emits.push({
        type,
        at: (r.authoredOn as string) || lastUpdated,
        fromRef: r.requester as FhirReference,
        toRef: Array.isArray(r.performer) ? (r.performer[0] as FhirReference) : (r.performer as FhirReference),
        summary: firstText(`${label} — ${status}`, label),
        documentText: firstText(
          (Array.isArray(r.note) ? (r.note as { text?: string }[]).map((n) => n.text).filter(Boolean).join("\n") : undefined),
          narrative,
        ) || undefined,
        pathway: pathwayFromResource(r),
      });
      break;
    }

    case "Encounter": {
      const status = String(r.status ?? "").toLowerCase();
      const period = (r.period as { start?: string; end?: string }) || {};
      const cls = conceptText(r.class as FhirCodeableConcept) || (r.class as { code?: string })?.code;
      if (period.start) {
        emits.push({
          type: "admission",
          at: period.start,
          fromRef: r.serviceProvider as FhirReference,
          summary: firstText(`Admission${cls ? ` (${cls})` : ""}`, "Admission"),
          documentText: narrative,
          pathway: pathwayFromResource(r),
        });
      }
      if (status === "finished" && period.end) {
        emits.push({
          type: "discharge_ready",
          at: period.end,
          fromRef: r.serviceProvider as FhirReference,
          summary: "Encounter finished — discharged",
          pathway: pathwayFromResource(r),
        });
      }
      if (emits.length === 0) return [];
      break;
    }

    case "Appointment": {
      const status = String(r.status ?? "").toLowerCase();
      const type: EventType | undefined =
        status === "booked" || status === "pending" || status === "proposed" || status === "waitlist"
          ? "appointment_scheduled"
          : status === "cancelled"
            ? "appointment_cancelled"
            : status === "noshow"
              ? "appointment_dna"
              : status === "fulfilled"
                ? "visit_completed"
                : undefined;
      if (!type) return [];
      const actors = Array.isArray(r.participant) ? (r.participant as { actor?: FhirReference }[]) : [];
      const orgActor = actors
        .map((p) => p.actor)
        .find((a) => a?.reference?.startsWith("Organization/") || a?.reference?.startsWith("Location/"));
      emits.push({
        type,
        at: (r.start as string) || lastUpdated,
        fromRef: orgActor,
        summary: firstText(conceptText(r.serviceType as FhirCodeableConcept), `Appointment — ${status}`),
        documentText: firstText(r.description as string, r.comment as string, narrative) || undefined,
        pathway: pathwayFromResource(r),
      });
      break;
    }

    case "Communication": {
      const category = conceptText(
        Array.isArray(r.category) ? (r.category[0] as FhirCodeableConcept) : (r.category as FhirCodeableConcept),
      );
      const isContact = /contact|outreach|follow.?up|call/i.test(category ?? "");
      const payloadText = Array.isArray(r.payload)
        ? (r.payload as { contentString?: string }[]).map((p) => p.contentString).filter(Boolean).join("\n")
        : undefined;
      emits.push({
        type: isContact ? "contact_attempt" : "status_note",
        at: (r.sent as string) || (r.received as string) || lastUpdated,
        fromRef: r.sender as FhirReference,
        toRef: Array.isArray(r.recipient) ? (r.recipient[0] as FhirReference) : (r.recipient as FhirReference),
        summary: firstText(category, isContact ? "Contact attempt" : "Communication note"),
        documentText: firstText(payloadText, narrative) || undefined,
        pathway: pathwayFromResource(r),
      });
      break;
    }

    case "DocumentReference": {
      const typeText = conceptText(r.type as FhirCodeableConcept) ?? "";
      const isDischarge = /discharge|transfer of care|inpatient summary/i.test(typeText);
      const content = Array.isArray(r.content) ? (r.content as { attachment?: Parameters<typeof decodeAttachment>[0] }[]) : [];
      const body = content.map((c) => decodeAttachment(c.attachment)).find((t) => t && t.length > 0);
      emits.push({
        type: isDischarge ? "discharge_summary_issued" : "status_note",
        at: (r.date as string) || lastUpdated,
        fromRef: (r.custodian as FhirReference) || (Array.isArray(r.author) ? (r.author[0] as FhirReference) : undefined),
        summary: firstText(typeText || (r.description as string), "Document"),
        documentText: firstText(body, r.description as string, narrative) || undefined,
        pathway: pathwayFromResource(r),
      });
      break;
    }

    case "Task": {
      const status = String(r.status ?? "").toLowerCase();
      const type: EventType | undefined =
        ["requested", "received", "accepted", "ready", "in-progress"].includes(status)
          ? "task_expected"
          : status === "completed"
            ? "visit_completed"
            : undefined;
      if (!type) return [];
      emits.push({
        type,
        at: (r.authoredOn as string) || (r.lastModified as string) || lastUpdated,
        fromRef: r.requester as FhirReference,
        toRef: r.owner as FhirReference,
        summary: firstText(conceptText(r.code as FhirCodeableConcept), r.description as string, "Task"),
        documentText: firstText(r.description as string, narrative) || undefined,
        pathway: pathwayFromResource(r),
      });
      break;
    }

    default:
      return [];
  }

  return emits
    .filter((e) => !!e.at)
    .map((e) => {
      const fromOrgId = resolveOrgId(e.fromRef, ctx) ?? ctx.defaultOrgId;
      const toOrgId = resolveOrgId(e.toRef, ctx);
      const evt: SourceEvent = {
        id: `fhir-${r.resourceType}-${r.id ?? seq()}-${e.type}`,
        patientId,
        type: e.type,
        at: new Date(e.at as string).toISOString(),
        fromOrgId,
        summary: e.summary,
      };
      if (toOrgId && toOrgId !== fromOrgId) evt.toOrgId = toOrgId;
      if (e.pathway) evt.pathway = e.pathway;
      if (e.documentText) evt.documentText = e.documentText;
      return evt;
    });
}
