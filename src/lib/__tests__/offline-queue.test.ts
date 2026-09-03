import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { enqueue, listPending, removePending, countPending, drainPending } from "@/lib/offline-queue";

// Node has no IndexedDB → the module uses its in-memory fallback. Clear it between tests.
async function clear() {
  for (const a of await listPending()) if (a.id != null) await removePending(a.id);
}

beforeEach(clear);
afterEach(() => vi.unstubAllGlobals());

describe("offline queue (in-memory fallback)", () => {
  it("enqueues, lists and counts", async () => {
    await enqueue({ url: "/api/x", method: "POST", body: { a: 1 }, label: "x", at: 1 });
    await enqueue({ url: "/api/y", method: "POST", body: { a: 2 }, label: "y", at: 2 });
    expect(await countPending()).toBe(2);
    const all = await listPending();
    expect(all.map((a) => a.url)).toEqual(["/api/x", "/api/y"]);
  });

  it("drains oldest-first when the network is back", async () => {
    await enqueue({ url: "/api/b", method: "POST", body: {}, label: "b", at: 20 });
    await enqueue({ url: "/api/a", method: "POST", body: {}, label: "a", at: 10 });
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      calls.push(url);
      return { ok: true, status: 200 } as Response;
    }));

    const { sent, remaining } = await drainPending();
    expect(sent).toBe(2);
    expect(remaining).toBe(0);
    expect(calls).toEqual(["/api/a", "/api/b"]); // at:10 before at:20
  });

  it("keeps everything when still offline", async () => {
    await enqueue({ url: "/api/a", method: "POST", body: {}, label: "a", at: 1 });
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network down");
    }));
    const { sent, remaining } = await drainPending();
    expect(sent).toBe(0);
    expect(remaining).toBe(1);
  });

  it("drops a 4xx (won't succeed on retry) but keeps a 5xx", async () => {
    await enqueue({ url: "/api/bad", method: "POST", body: {}, label: "bad", at: 1 });
    await enqueue({ url: "/api/flaky", method: "POST", body: {}, label: "flaky", at: 2 });
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/api/bad") return { ok: false, status: 400 } as Response;
      return { ok: false, status: 503 } as Response;
    }));
    const { sent, remaining } = await drainPending();
    expect(sent).toBe(0);
    expect(remaining).toBe(1); // the 400 dropped, the 503 kept
    expect((await listPending())[0].url).toBe("/api/flaky");
  });
});
