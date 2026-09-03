/**
 * Walk a FHIR searchset `Bundle`, map every entry, and return a clean,
 * de-duplicated, chronologically sorted `SourceEvent[]`.
 */
import type { SourceEvent } from "@/domain/types";
import type { MapContext } from "../types";
import type { FhirBundle } from "./r4";
import { mapResource, resolveResourcePatient, HANDLED_RESOURCE_TYPES } from "./map";

export interface MapBundleResult {
  events: SourceEvent[];
  /** Entries whose patient did not resolve to this place. */
  unmatched: number;
  /** Entries this mapper does not turn into an event (resource type or status). */
  ignored: number;
}

const HANDLED = new Set<string>(HANDLED_RESOURCE_TYPES);

export function mapBundle(bundle: FhirBundle, ctx: MapContext): MapBundleResult {
  const entries = Array.isArray(bundle.entry) ? bundle.entry : [];
  let n = 0;
  const seq = () => `e${(n += 1)}`;

  const byId = new Map<string, SourceEvent>();
  let unmatched = 0;
  let ignored = 0;

  for (const entry of entries) {
    const resource = entry.resource;
    if (!resource || resource.resourceType === "OperationOutcome") continue;
    if (!HANDLED.has(resource.resourceType)) {
      ignored += 1;
      continue;
    }
    if (!resolveResourcePatient(resource, ctx)) {
      unmatched += 1;
      continue;
    }
    const mapped = mapResource(resource, ctx, seq);
    if (mapped.length === 0) {
      // handled type, patient in place, but nothing to emit (e.g. a status we
      // don't act on).
      ignored += 1;
      continue;
    }
    for (const evt of mapped) byId.set(evt.id, evt);
  }

  const events = [...byId.values()].sort((a, b) => a.at.localeCompare(b.at));
  return { events, unmatched, ignored };
}
