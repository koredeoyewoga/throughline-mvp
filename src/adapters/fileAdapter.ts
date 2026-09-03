/**
 * A `SourceAdapter` backed by a local JSON file — a captured test payload from
 * e-RS or a Transfer-of-Care feed. This is how the e-RS and ToC mappers are
 * exercised "against a test endpoint" without an HSCN connection: point the
 * adapter at a saved response.
 */
import fs from "node:fs";
import type { SourceEvent } from "@/domain/types";
import type { SourceAdapter, AdapterStatus, FetchResult, MapContext } from "./types";

export function createFileAdapter<T>(args: {
  name: string;
  file: string;
  mapOne: (record: T, ctx: MapContext) => SourceEvent[];
  ctx: MapContext;
}): SourceAdapter {
  const { name, file, mapOne, ctx } = args;

  function status(): AdapterStatus {
    const exists = !!file && fs.existsSync(file);
    return {
      name,
      configured: exists,
      detail: file
        ? exists
          ? `${name} mapper · reading captured payload from ${file.split(/[\\/]/).pop()}`
          : `${name} mapper · file not found (${file})`
        : `${name} mapper · no file configured`,
    };
  }

  async function fetchEvents(): Promise<FetchResult> {
    if (!file || !fs.existsSync(file)) return { events: [], unmatched: 0, ignored: 0 };
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    const records: T[] = Array.isArray(raw) ? raw : Array.isArray(raw?.records) ? raw.records : [raw];

    const byId = new Map<string, SourceEvent>();
    let unmatched = 0;
    for (const rec of records) {
      const mapped = mapOne(rec, ctx);
      if (mapped.length === 0) unmatched += 1;
      for (const evt of mapped) byId.set(evt.id, evt);
    }
    return {
      events: [...byId.values()].sort((a, b) => a.at.localeCompare(b.at)),
      unmatched,
      ignored: 0,
    };
  }

  return { name, status, fetchEvents };
}
