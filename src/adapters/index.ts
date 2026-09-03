/**
 * Adapter selection.
 *
 * `THROUGHLINE_SOURCE` picks the ingestion path:
 *   - `synthetic` (default) — no external adapter; the seed is the source.
 *   - `fhir`      — live FHIR R4 read adapter (`THROUGHLINE_FHIR_BASE_URL`, …).
 *   - `ers`       — e-RS Referral Request mapper over a captured payload
 *                   (`THROUGHLINE_ERS_FILE`).
 *   - `toc`       — Transfer-of-Care document mapper over a captured payload
 *                   (`THROUGHLINE_TOC_FILE`).
 *
 * All adapters are read-only.
 */
import type { Organisation, Patient } from "@/domain/types";
import type { SourceAdapter, AdapterStatus } from "./types";
import { buildMapContext } from "./resolve";
import { createFhirAdapter } from "./fhir/FhirAdapter";
import { createFileAdapter } from "./fileAdapter";
import { mapErsReferral, type ErsReferralRequest } from "./ers/mapErs";
import { mapTransferOfCare, type TransferOfCareDocument } from "./toc/mapTransferOfCare";

export type SourceKind = "synthetic" | "fhir" | "ers" | "toc";

export function configuredSourceKind(): SourceKind {
  const v = (process.env.THROUGHLINE_SOURCE ?? "synthetic").toLowerCase();
  return v === "fhir" || v === "ers" || v === "toc" ? v : "synthetic";
}

export interface World {
  patients: Patient[];
  organisations: Organisation[];
}

/** The default org to attribute an event to when the source names none. */
const DEFAULT_ORG_ID = "org-mft";

/**
 * Returns the configured adapter, or `null` for the synthetic source (in which
 * case there is nothing to pull — the seed stands alone).
 */
export function getConfiguredAdapter(world: World): SourceAdapter | null {
  const kind = configuredSourceKind();
  if (kind === "synthetic") return null;

  const ctx = buildMapContext(world.patients, world.organisations, DEFAULT_ORG_ID);

  if (kind === "fhir") {
    const baseUrl = process.env.THROUGHLINE_FHIR_BASE_URL ?? "";
    return createFhirAdapter(
      {
        baseUrl,
        patient: process.env.THROUGHLINE_FHIR_PATIENT || undefined,
        token: process.env.THROUGHLINE_FHIR_TOKEN || undefined,
      },
      ctx,
    );
  }

  if (kind === "ers") {
    return createFileAdapter<ErsReferralRequest>({
      name: "ers",
      file: process.env.THROUGHLINE_ERS_FILE ?? "",
      mapOne: mapErsReferral,
      ctx,
    });
  }

  return createFileAdapter<TransferOfCareDocument>({
    name: "toc",
    file: process.env.THROUGHLINE_TOC_FILE ?? "",
    mapOne: mapTransferOfCare,
    ctx,
  });
}

export function describeSource(world: World): AdapterStatus {
  const adapter = getConfiguredAdapter(world);
  if (!adapter) {
    return {
      name: "synthetic",
      configured: true,
      detail: "Synthetic seed — no external feed. Set THROUGHLINE_SOURCE to fhir | ers | toc to ingest.",
    };
  }
  return adapter.status();
}
