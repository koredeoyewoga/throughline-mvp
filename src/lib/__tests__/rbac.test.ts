import { describe, it, expect } from "vitest";
import { can, denyReason, ROLE_PERMISSIONS, type Permission } from "@/lib/rbac";

describe("permission matrix", () => {
  it("a coordinator can run the day-to-day workflow", () => {
    for (const p of [
      "exception:decide",
      "task:act",
      "blocker:manage",
      "handoff:manage",
      "detection:refresh",
      "demo:reset",
    ] as Permission[]) {
      expect(can("coordinator", p)).toBe(true);
    }
  });

  it("a coordinator cannot change configuration or pull from a source", () => {
    for (const p of ["config:edit", "config:reset", "source:ingest"] as Permission[]) {
      expect(can("coordinator", p)).toBe(false);
    }
  });

  it("oversight is a strict superset of coordinator", () => {
    for (const p of ROLE_PERMISSIONS.coordinator) {
      expect(can("oversight", p)).toBe(true);
    }
    expect(ROLE_PERMISSIONS.oversight.length).toBeGreaterThan(ROLE_PERMISSIONS.coordinator.length);
  });

  it("oversight holds the privileged permissions", () => {
    for (const p of ["config:edit", "config:reset", "source:ingest"] as Permission[]) {
      expect(can("oversight", p)).toBe(true);
    }
  });

  it("denyReason names the role and points at oversight", () => {
    const msg = denyReason("coordinator", "config:edit");
    expect(msg).toMatch(/coordinator/);
    expect(msg).toMatch(/oversight/);
  });
});
