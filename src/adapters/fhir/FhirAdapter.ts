/**
 * FHIR R4 read adapter.
 *
 * Pulls recently-changed clinical resources for the configured patient scope
 * from a FHIR server (e.g. the public HAPI test server at
 * https://hapi.fhir.org/baseR4) and normalises them to `SourceEvent`s.
 *
 * Read-only: it issues GET searches and follows `Bundle.link[next]` paging.
 * It never PUTs, POSTs or PATCHes anything back.
 */
import type { SourceEvent } from "@/domain/types";
import type { SourceAdapter, AdapterStatus, MapContext, FetchResult } from "../types";
import type { FhirBundle } from "./r4";
import { mapBundle } from "./bundle";

export interface FhirAdapterOptions {
  baseUrl: string;
  /**
   * Resource types to sweep. Order is preserved; each is a separate search.
   */
  resourceTypes?: string[];
  /**
   * Restrict the search to one patient. A FHIR `Patient/{id}` logical id, or an
   * NHS number (mapped to `?patient.identifier=`). Omit to sweep the whole
   * server (only sensible against a private, place-scoped endpoint).
   */
  patient?: string;
  /** Page size (`_count`). */
  count?: number;
  /** Hard cap on pages followed per resource type, to bound a bad link loop. */
  maxPages?: number;
  /** Per-request timeout (ms). */
  timeoutMs?: number;
  /** Injected for tests. Defaults to global `fetch`. */
  fetchImpl?: typeof fetch;
  /** Bearer token, if the endpoint needs one. */
  token?: string;
}

const DEFAULT_RESOURCE_TYPES = [
  "ServiceRequest",
  "Encounter",
  "Appointment",
  "Communication",
  "DocumentReference",
  "Task",
];

function redactHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "(invalid URL)";
  }
}

export function createFhirAdapter(opts: FhirAdapterOptions, ctx: MapContext): SourceAdapter {
  const baseUrl = opts.baseUrl.replace(/\/+$/, "");
  const resourceTypes = opts.resourceTypes ?? DEFAULT_RESOURCE_TYPES;
  const count = opts.count ?? 50;
  const maxPages = opts.maxPages ?? 10;
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const doFetch = opts.fetchImpl ?? fetch;

  function status(): AdapterStatus {
    return {
      name: "fhir",
      configured: !!baseUrl,
      detail: baseUrl
        ? `FHIR R4 at ${redactHost(baseUrl)} · ${resourceTypes.length} resource types` +
          (opts.patient ? ` · patient-scoped` : ` · whole-endpoint sweep`)
        : "no baseUrl configured",
    };
  }

  function firstSearchUrl(resourceType: string, sinceIso?: string): string {
    const q = new URLSearchParams();
    q.set("_count", String(count));
    q.set("_sort", "-_lastUpdated");
    if (sinceIso) q.set("_lastUpdated", `gt${sinceIso}`);
    if (opts.patient) {
      if (/^\d[\d\s]+$/.test(opts.patient)) q.set("patient.identifier", opts.patient.replace(/\s/g, ""));
      else q.set("patient", opts.patient);
    }
    return `${baseUrl}/${resourceType}?${q.toString()}`;
  }

  async function getBundle(url: string): Promise<FhirBundle> {
    const res = await doFetch(url, {
      method: "GET",
      headers: {
        Accept: "application/fhir+json",
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`FHIR ${res.status} for ${redactHost(url)}${new URL(url).pathname}`);
    const json = (await res.json()) as FhirBundle;
    if (json.resourceType !== "Bundle") throw new Error(`Expected a Bundle, got ${json.resourceType}`);
    return json;
  }

  async function fetchEvents(sinceIso?: string): Promise<FetchResult> {
    if (!baseUrl) return { events: [], unmatched: 0, ignored: 0 };
    const byId = new Map<string, SourceEvent>();
    let unmatched = 0;
    let ignored = 0;

    for (const resourceType of resourceTypes) {
      let url: string | undefined = firstSearchUrl(resourceType, sinceIso);
      let page = 0;
      const seen = new Set<string>();
      while (url && page < maxPages) {
        if (seen.has(url)) break; // guard against a self-referential next link
        seen.add(url);
        let bundle: FhirBundle;
        try {
          bundle = await getBundle(url);
        } catch (err) {
          // One resource type failing (unsupported on the endpoint, etc.) must
          // not sink the whole pull.
          if (page === 0) break;
          throw err;
        }
        const mapped = mapBundle(bundle, ctx);
        for (const evt of mapped.events) byId.set(evt.id, evt);
        unmatched += mapped.unmatched;
        ignored += mapped.ignored;
        url = bundle.link?.find((l) => l.relation === "next")?.url;
        page += 1;
      }
    }

    const events = [...byId.values()].sort((a, b) => a.at.localeCompare(b.at));
    return { events, unmatched, ignored };
  }

  return { name: "fhir", status, fetchEvents };
}
