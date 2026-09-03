import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { submitAction } from "@/lib/submitAction";
import { listPending, removePending } from "@/lib/offline-queue";

async function clear() {
  for (const a of await listPending()) if (a.id != null) await removePending(a.id);
}

beforeEach(clear);
afterEach(() => vi.unstubAllGlobals());

describe("submitAction", () => {
  it("POSTs and returns the parsed body when online", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }) as unknown as Response));
    const res = await submitAction("/api/x", { kind: "approve" }, "approve");
    expect(res).toMatchObject({ ok: true, queued: false });
  });

  it("reports a 4xx without queueing (it won't recover on retry)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 400 }) as Response));
    const res = await submitAction("/api/x", {}, "x");
    expect(res).toEqual({ ok: false, queued: false, status: 400 });
    expect(await listPending()).toHaveLength(0);
  });

  it("queues a 5xx to retry later", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503 }) as Response));
    const res = await submitAction("/api/x", {}, "x");
    expect(res).toEqual({ ok: true, queued: true });
    expect(await listPending()).toHaveLength(1);
  });

  it("queues the action when the network throws", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline");
    }));
    const res = await submitAction("/api/tasks/t1/action", { kind: "status", value: "done" }, "task done");
    expect(res).toEqual({ ok: true, queued: true });
    const pending = await listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ url: "/api/tasks/t1/action", method: "POST", label: "task done" });
  });

  it("preserves the queued action's url and body for replay", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline");
    }));
    await submitAction("/api/tasks/t9/action", { kind: "escalate" }, "task escalate");
    const [item] = await listPending();
    expect(item).toMatchObject({ url: "/api/tasks/t9/action", method: "POST", body: { kind: "escalate" } });
  });
});
