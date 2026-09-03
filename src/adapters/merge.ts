import type { SourceEvent } from "@/domain/types";

/**
 * Merge freshly-pulled events into the existing set. De-duplication is by
 * `SourceEvent.id` — an adapter re-sending an event it sent before is a no-op.
 * The result stays sorted by `at` so the pathway-state model reads it in order.
 */
export function mergeEvents(
  existing: SourceEvent[],
  incoming: SourceEvent[],
): { events: SourceEvent[]; added: number; skipped: number } {
  const ids = new Set(existing.map((e) => e.id));
  const out = [...existing];
  let added = 0;
  let skipped = 0;
  for (const e of incoming) {
    if (ids.has(e.id)) {
      skipped += 1;
      continue;
    }
    ids.add(e.id);
    out.push(e);
    added += 1;
  }
  out.sort((a, b) => a.at.localeCompare(b.at));
  return { events: out, added, skipped };
}
