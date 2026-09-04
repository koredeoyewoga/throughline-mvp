import { describe, it, expect } from "vitest";
import { createBlocker, resolveBlocker, setBlockerAwaitingResponse } from "@/engine/blockers";

const owner = { functionArea: "district_nursing" as const, orgId: "org-mch", label: "District Nursing" };

describe("createBlocker", () => {
  it("builds an open blocker, trimming free text", () => {
    const b = createBlocker({
      id: "blk-1",
      now: "2026-01-01T00:00:00.000Z",
      actor: "Priya Shah",
      placeId: "place-meadowford",
      owner,
      title: "  Awaiting GP callback  ",
      category: "awaiting_external_organisation",
      description: "  Left two voicemails, no reply.  ",
      exceptionId: "exc-1",
      externalDependency: "  Riverside Surgery  ",
    });
    expect(b.status).toBe("open");
    expect(b.title).toBe("Awaiting GP callback");
    expect(b.description).toBe("Left two voicemails, no reply.");
    expect(b.externalDependency).toBe("Riverside Surgery");
    expect(b.exceptionId).toBe("exc-1");
    expect(b.resolvedAt).toBeUndefined();
  });

  it("omits externalDependency when blank", () => {
    const b = createBlocker({
      id: "blk-2",
      now: "2026-01-01T00:00:00.000Z",
      actor: "Priya Shah",
      placeId: "place-meadowford",
      owner,
      title: "x",
      category: "other",
      description: "y",
      externalDependency: "   ",
    });
    expect(b.externalDependency).toBeUndefined();
  });
});

describe("resolveBlocker / setBlockerAwaitingResponse", () => {
  const base = createBlocker({
    id: "blk-3",
    now: "2026-01-01T00:00:00.000Z",
    actor: "Priya Shah",
    placeId: "place-meadowford",
    owner,
    title: "x",
    category: "other",
    description: "y",
    taskId: "task-1",
  });

  it("resolves with an actor, timestamp and optional note", () => {
    const resolved = resolveBlocker(base, { actor: "Alan Reeve", now: "2026-01-02T00:00:00.000Z", note: "Sorted." });
    expect(resolved.status).toBe("resolved");
    expect(resolved.resolvedBy).toBe("Alan Reeve");
    expect(resolved.resolvedAt).toBe("2026-01-02T00:00:00.000Z");
    expect(resolved.resolutionNote).toBe("Sorted.");
  });

  it("moves to awaiting_response without touching resolution fields", () => {
    const waiting = setBlockerAwaitingResponse(base, "2026-01-02T00:00:00.000Z");
    expect(waiting.status).toBe("awaiting_response");
    expect(waiting.resolvedAt).toBeUndefined();
  });
});
