/**
 * Build a `MapContext` — the patient/org resolvers the mappers need — from the
 * place's own reference data. Entity resolution here is deliberately strict:
 * an unrecognised patient reference returns `null` (the ingest step counts it
 * as "unmatched") rather than creating a patient from an external feed.
 */
import type { Organisation, Patient } from "@/domain/types";
import type { MapContext, ResolveOrg, ResolvePatient } from "./types";

/**
 * Synthetic ODS-style codes for the Meadowford organisations, so FHIR/e-RS
 * `identifier` values in fixtures resolve. A real deployment loads these from
 * ODS / the local directory of services.
 */
export const SYNTHETIC_ODS: Record<string, string> = {
  RA9: "org-mft", // Meadowford Acute NHS FT
  RY7: "org-mch", // Meadowford Community Health
  A81001: "org-rpcn", // Riverside Primary Care Network
  MEA: "org-council", // Meadowford Council Adult Social Care
  RXL: "org-lakeside", // Lakeside Mental Health Partnership
  VOL01: "org-carers", // Meadowford Carers & Community
};

function normNhs(n?: string): string | undefined {
  const d = n?.replace(/\D/g, "");
  return d && d.length === 10 ? d : undefined;
}

export function buildMapContext(
  patients: Patient[],
  organisations: Organisation[],
  defaultOrgId: string,
): MapContext {
  const byId = new Map(patients.map((p) => [p.id, p]));
  const byNhs = new Map<string, string>();
  const byLocalId = new Map<string, string>();
  for (const p of patients) {
    const nhs = normNhs(p.nhsNumber);
    if (nhs) byNhs.set(nhs, p.id);
    for (const s of p.sourceIds) byLocalId.set(s.localId.toUpperCase(), p.id);
  }

  const orgIds = new Set(organisations.map((o) => o.id));

  const resolvePatient: ResolvePatient = (ref) => {
    if (ref.reference) {
      const raw = ref.reference.replace(/^Patient\//, "").trim();
      if (byId.has(raw)) return raw;
      if (byLocalId.has(raw.toUpperCase())) return byLocalId.get(raw.toUpperCase())!;
    }
    const nhs = normNhs(ref.nhsNumber);
    if (nhs && byNhs.has(nhs)) return byNhs.get(nhs)!;
    if (ref.localId && byLocalId.has(ref.localId.toUpperCase())) return byLocalId.get(ref.localId.toUpperCase())!;
    return null;
  };

  const resolveOrg: ResolveOrg = (ref) => {
    if (ref.reference) {
      const raw = ref.reference.replace(/^Organization\//, "").trim();
      if (orgIds.has(raw)) return raw;
    }
    if (ref.identifier) {
      const code = ref.identifier.trim().toUpperCase();
      if (SYNTHETIC_ODS[code]) return SYNTHETIC_ODS[code];
      if (orgIds.has(ref.identifier.trim())) return ref.identifier.trim();
    }
    if (ref.name) {
      const hit = organisations.find(
        (o) => o.name.toLowerCase().includes(ref.name!.toLowerCase()) || ref.name!.toLowerCase().includes(o.name.toLowerCase()),
      );
      if (hit) return hit.id;
    }
    return defaultOrgId;
  };

  return { resolvePatient, resolveOrg, defaultOrgId };
}
