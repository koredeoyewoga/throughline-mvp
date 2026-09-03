import { describe, it, expect } from "vitest";
import { mergeEvents } from "../merge";
import type { SourceEvent } from "@/domain/types";

const evt = (id: string, at: string): SourceEvent => ({
  id,
  patientId: "pat-x",
  type: "status_note",
  at,
  fromOrgId: "org-mft",
  summary: id,
});

describe("mergeEvents", () => {
  it("adds new events, skips ones already held by id, and re-sorts by time", () => {
    const existing = [evt("a", "2026-08-02T00:00:00Z"), evt("b", "2026-08-05T00:00:00Z")];
    const incoming = [evt("b", "2026-08-05T00:00:00Z"), evt("c", "2026-08-03T00:00:00Z")];
    const { events, added, skipped } = mergeEvents(existing, incoming);
    expect(added).toBe(1);
    expect(skipped).toBe(1);
    expect(events.map((e) => e.id)).toEqual(["a", "c", "b"]);
  });

  it("is a no-op when every incoming event is already held", () => {
    const existing = [evt("a", "2026-08-02T00:00:00Z")];
    const { added, skipped, events } = mergeEvents(existing, [evt("a", "2026-08-02T00:00:00Z")]);
    expect(added).toBe(0);
    expect(skipped).toBe(1);
    expect(events).toHaveLength(1);
  });
});
