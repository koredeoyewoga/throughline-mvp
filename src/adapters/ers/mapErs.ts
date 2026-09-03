/**
 * NHS e-Referral Service (e-RS) -> `SourceEvent` mapping.
 *
 * The e-RS FHIR/REST APIs need an integration agreement, a smartcard-backed
 * client and an HSCN/API-gateway connection, so there is no open sandbox to
 * poll here. This module implements the **mapping** against the documented
 * Referral Request shape; wiring it to a live endpoint is a credentials +
 * transport change only (mirror `FhirAdapter`).
 *
 * Pure and deterministic — status drives the event type; free text goes to
 * `documentText`.
 */
import type { SourceEvent, EventType } from "@/domain/types";
import type { MapContext } from "../types";

export interface ErsReferralRequest {
  id: string;
  ubrn?: string;
  /** e-RS worklist status, upper-snake. */
  status?: string;
  priority?: string;
  specialty?: string;
  creationDateTime?: string;
  lastEventDateTime?: string;
  patient?: { nhsNumber?: string; id?: string };
  referringOrganisation?: { odsCode?: string; name?: string };
  referredToService?: { odsCode?: string; name?: string; id?: string };
  clinicalInformation?: string;
  /** Our pathway key, if the interface layer supplies it. */
  pathway?: string;
}

const ACCEPTED = new Set(["ACCEPTED", "APPOINTMENT_BOOKED", "BOOKED", "APPOINTMENT_REQUESTED"]);
const REJECTED = new Set(["REJECTED", "RETURNED", "CANCELLED", "WITHDRAWN", "DID_NOT_ATTEND_DISCHARGED"]);
const WITH_PROVIDER = new Set(["TRIAGE", "REFERRAL_ASSESSMENT", "ASSESSMENT", "AWAITING_ACCEPTANCE"]);

function toIso(s?: string): string | undefined {
  if (!s) return undefined;
  const t = Date.parse(s);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
}

export function mapErsReferral(r: ErsReferralRequest, ctx: MapContext): SourceEvent[] {
  const resolved = ctx.resolvePatient({
    nhsNumber: r.patient?.nhsNumber?.replace(/\s/g, ""),
    localId: r.patient?.id,
  });
  if (!resolved) return [];
  const patientId: string = resolved;

  const fromOrgId = ctx.resolveOrg({
    identifier: r.referringOrganisation?.odsCode,
    name: r.referringOrganisation?.name,
  });
  const toOrgId = ctx.resolveOrg({
    identifier: r.referredToService?.odsCode,
    name: r.referredToService?.name,
    reference: r.referredToService?.id ? `Organization/${r.referredToService.id}` : undefined,
  });
  const label = r.specialty ? `e-RS referral — ${r.specialty}` : "e-RS referral";
  const status = String(r.status ?? "").toUpperCase();
  const out: SourceEvent[] = [];

  const madeAt = toIso(r.creationDateTime);
  if (madeAt) {
    out.push(base("referral_made", madeAt, `${label} (UBRN ${r.ubrn ?? r.id})`, r.clinicalInformation));
  }

  const eventAt = toIso(r.lastEventDateTime) ?? madeAt;
  let followType: EventType | undefined;
  if (ACCEPTED.has(status)) followType = "referral_accepted";
  else if (REJECTED.has(status)) followType = "referral_rejected";
  else if (WITH_PROVIDER.has(status)) followType = "referral_acknowledged";
  if (followType && eventAt) {
    out.push(base(followType, eventAt, `${label} — ${status.toLowerCase().replace(/_/g, " ")}`));
  }

  return out.filter((e, i, a) => a.findIndex((x) => x.id === e.id) === i);

  function base(type: EventType, at: string, summary: string, documentText?: string): SourceEvent {
    const evt: SourceEvent = {
      id: `ers-${r.id}-${type}`,
      patientId,
      type,
      at,
      fromOrgId: type === "referral_made" ? fromOrgId : toOrgId || fromOrgId,
      summary,
    };
    const directedAt = type === "referral_made" ? toOrgId : fromOrgId;
    if (directedAt && directedAt !== evt.fromOrgId) evt.toOrgId = directedAt;
    if (r.pathway) evt.pathway = r.pathway;
    if (documentText) evt.documentText = documentText;
    return evt;
  }
}

export function mapErsWorklist(list: ErsReferralRequest[], ctx: MapContext): SourceEvent[] {
  const byId = new Map<string, SourceEvent>();
  for (const r of list) for (const e of mapErsReferral(r, ctx)) byId.set(e.id, e);
  return [...byId.values()].sort((a, b) => a.at.localeCompare(b.at));
}
