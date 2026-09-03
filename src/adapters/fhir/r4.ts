/**
 * A deliberately small slice of FHIR R4 — only the fields the mapper reads.
 * The shapes follow HL7 FHIR R4 / UK Core; anything not listed here is ignored.
 */

export interface FhirReference {
  reference?: string; // "Patient/123", "Organization/abc"
  identifier?: { system?: string; value?: string };
  display?: string;
}

export interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}

export interface FhirCodeableConcept {
  coding?: FhirCoding[];
  text?: string;
}

export interface FhirIdentifier {
  system?: string;
  value?: string;
}

export interface FhirResource {
  resourceType: string;
  id?: string;
  meta?: { lastUpdated?: string };
  identifier?: FhirIdentifier[];
  subject?: FhirReference;
  patient?: FhirReference;
  text?: { status?: string; div?: string };
  [k: string]: unknown;
}

export interface FhirBundleEntry {
  fullUrl?: string;
  resource?: FhirResource;
}

export interface FhirBundle {
  resourceType: "Bundle";
  type?: string;
  link?: { relation: string; url: string }[];
  entry?: FhirBundleEntry[];
}

/** Narrow a resource by `resourceType`, keeping the extra fields as `unknown`. */
export function isResourceType<T extends string>(
  r: FhirResource | undefined,
  type: T,
): r is FhirResource & { resourceType: T } {
  return !!r && r.resourceType === type;
}
