/**
 * Ingestion adapters.
 *
 * The engine reasons over a single `SourceEvent[]`. A real deployment feeds that
 * array from live systems; each system gets an adapter that normalises its
 * payloads into `SourceEvent`s and nothing more. Adapters are **read-only** —
 * they never write back to a source system — and the mapping is deterministic:
 * free text in a referral or discharge document lands verbatim in
 * `SourceEvent.documentText` and never influences the event `type`, `pathway`
 * or routing (see `docs/AI-SAFETY.md`).
 */
import type { SourceEvent } from "@/domain/types";

/**
 * Resolve a source-system patient reference (a FHIR `Patient/…` reference, an
 * NHS number, or a local MRN) to a Throughline patient id. Returns `null` when
 * the patient is not known to this place — the caller counts these as
 * "unmatched" rather than inventing a patient.
 */
export type ResolvePatient = (ref: {
  reference?: string;
  nhsNumber?: string;
  localId?: string;
  orgId?: string;
}) => string | null;

/**
 * Resolve a source-system organisation reference to a Throughline org id.
 * Falls back to the adapter's configured default when unknown.
 */
export type ResolveOrg = (ref: { reference?: string; identifier?: string; name?: string }) => string;

export interface MapContext {
  resolvePatient: ResolvePatient;
  resolveOrg: ResolveOrg;
  /** Org id to attribute events to when the source does not name one. */
  defaultOrgId: string;
}

export interface AdapterStatus {
  name: string;
  /** Enough config present to attempt a real pull. */
  configured: boolean;
  /** Human-readable, with any credentials/host redacted. */
  detail: string;
}

export interface FetchResult {
  events: SourceEvent[];
  /** Source records whose patient did not resolve to this place. */
  unmatched: number;
  /** Source records this adapter does not turn into an event (type/status). */
  ignored: number;
}

export interface SourceAdapter {
  name: string;
  status(): AdapterStatus;
  /**
   * Pull events changed since `sinceIso` (ISO 8601). Implementations must be
   * idempotent — returning an event already in state is fine; the merge step
   * de-duplicates by `SourceEvent.id`.
   */
  fetchEvents(sinceIso?: string): Promise<FetchResult>;
}

export interface IngestResult {
  adapter: string;
  /** New events merged into state. */
  added: number;
  /** Events already present (same id) — skipped. */
  skipped: number;
  /** Source records whose patient could not be resolved to this place. */
  unmatched: number;
  /** Source records the adapter does not map to an event. */
  ignored: number;
  /** Exception count after re-running detection. */
  exceptions: number;
  note?: string;
}
