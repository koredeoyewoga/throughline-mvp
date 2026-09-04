import { describe, it, expect } from "vitest";
import { createHandoff, acknowledgeHandoff, latestHandoff, ownerStatus } from "@/engine/handoffs";
import type { Task } from "@/domain/types";

const task: Task = {
  id: "task-1",
  exceptionId: "exc-1",
  patientId: "pat-1",
  placeId: "place-meadowford",
  pattern: "referral_unactioned",
  title: "Chase the referral",
  detail: "Chase it",
  owner: { functionArea: "therapies", orgId: "org-mch", label: "Community Rehab" },
  assignee: undefined,
  status: "open",
  priority: "high",
  createdAt: "2026-01-01T00:00:00.000Z",
  createdBy: "system",
  dueAt: "2026-01-02T00:00:00.000Z",
  escalationLevel: 0,
  activity: [],
};

describe("createHandoff", () => {
  it("captures the previous owner as null when the task was unassigned", () => {
    const h = createHandoff(task, {
      id: "hnd-1",
      now: "2026-01-01T01:00:00.000Z",
      actor: "Priya Shah",
      toOwner: "R. Odele",
      reason: "Rehab scheduling lead",
    });
    expect(h.fromOwner).toBeNull();
    expect(h.toOwner).toBe("R. Odele");
    expect(h.acknowledgedAt).toBeUndefined();
  });

  it("captures the current assignee as the previous owner", () => {
    const h = createHandoff(
      { ...task, assignee: "J. Marsh" },
      { id: "hnd-2", now: "2026-01-01T01:00:00.000Z", actor: "Priya Shah", toOwner: "R. Odele", reason: "cover" },
    );
    expect(h.fromOwner).toBe("J. Marsh");
  });
});

describe("acknowledgeHandoff", () => {
  it("stamps who acknowledged it and when", () => {
    const h = createHandoff(task, {
      id: "hnd-1",
      now: "2026-01-01T01:00:00.000Z",
      actor: "Priya Shah",
      toOwner: "R. Odele",
      reason: "cover",
    });
    const ack = acknowledgeHandoff(h, "R. Odele", "2026-01-01T02:00:00.000Z");
    expect(ack.acknowledgedBy).toBe("R. Odele");
    expect(ack.acknowledgedAt).toBe("2026-01-01T02:00:00.000Z");
  });
});

describe("latestHandoff", () => {
  it("returns the most recent handoff for a task, ignoring other tasks", () => {
    const older = createHandoff(task, { id: "hnd-1", now: "2026-01-01T01:00:00.000Z", actor: "a", toOwner: "x", reason: "r" });
    const newer = createHandoff(task, { id: "hnd-2", now: "2026-01-01T03:00:00.000Z", actor: "a", toOwner: "y", reason: "r" });
    const otherTask = createHandoff(
      { ...task, id: "task-2" },
      { id: "hnd-3", now: "2026-01-01T05:00:00.000Z", actor: "a", toOwner: "z", reason: "r" },
    );
    expect(latestHandoff("task-1", [older, newer, otherTask])?.id).toBe("hnd-2");
  });

  it("returns undefined when the task has never been handed off", () => {
    expect(latestHandoff("task-1", [])).toBeUndefined();
  });
});

describe("ownerStatus", () => {
  const now = "2026-01-01T12:00:00.000Z";
  const WINDOW = 12; // hours

  it("is confirmed when there is no handoff at all", () => {
    expect(ownerStatus("task-1", [], now, WINDOW)).toBe("confirmed");
  });

  it("is confirmed once the latest handoff is acknowledged", () => {
    const h = createHandoff(task, { id: "hnd-1", now: "2026-01-01T01:00:00.000Z", actor: "a", toOwner: "x", reason: "r" });
    const ack = acknowledgeHandoff(h, "x", "2026-01-01T02:00:00.000Z");
    expect(ownerStatus("task-1", [ack], now, WINDOW)).toBe("confirmed");
  });

  it("is pending_ack inside the confirmation window", () => {
    const h = createHandoff(task, { id: "hnd-1", now: "2026-01-01T09:00:00.000Z", actor: "a", toOwner: "x", reason: "r" });
    // 3h have passed, window is 12h
    expect(ownerStatus("task-1", [h], now, WINDOW)).toBe("pending_ack");
  });

  it("is unknown once the confirmation window has passed with no acknowledgement", () => {
    const h = createHandoff(task, { id: "hnd-1", now: "2026-01-01T00:00:00.000Z", actor: "a", toOwner: "x", reason: "r" });
    // 12h have passed, window is 12h — at/over threshold counts as unknown
    expect(ownerStatus("task-1", [h], now, WINDOW)).toBe("unknown");
  });

  it("evaluates only the most recent handoff for the task", () => {
    const stale = createHandoff(task, { id: "hnd-1", now: "2025-01-01T00:00:00.000Z", actor: "a", toOwner: "x", reason: "r" });
    const fresh = createHandoff(task, { id: "hnd-2", now: "2026-01-01T11:00:00.000Z", actor: "a", toOwner: "y", reason: "r" });
    expect(ownerStatus("task-1", [stale, fresh], now, WINDOW)).toBe("pending_ack");
  });
});
