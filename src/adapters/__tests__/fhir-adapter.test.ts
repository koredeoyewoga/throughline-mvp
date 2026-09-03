import { describe, it, expect, vi } from "vitest";
import { createFhirAdapter } from "../fhir/FhirAdapter";
import type { FhirBundle } from "../fhir/r4";
import { ctx, ADA } from "./fixtures";

const subject = { reference: `Patient/${ADA.id}` };

function bundle(entries: FhirBundle["entry"], next?: string): FhirBundle {
  return {
    resourceType: "Bundle",
    type: "searchset",
    ...(next ? { link: [{ relation: "next", url: next }] } : {}),
    entry: entries,
  };
}

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

const sr = (id: string, at: string) => ({
  resource: {
    resourceType: "ServiceRequest",
    id,
    status: "active",
    subject,
    authoredOn: at,
    requester: { reference: "Organization/org-mft" },
    performer: [{ reference: "Organization/org-mch" }],
    code: { text: "Referral" },
  },
});

describe("createFhirAdapter", () => {
  it("follows Bundle.link[next] paging and merges pages", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("ServiceRequest") && !url.includes("page=2")) {
        return jsonResponse(bundle([sr("a", "2026-08-01T00:00:00Z")], "https://x/fhir/ServiceRequest?page=2"));
      }
      if (url.includes("ServiceRequest")) {
        return jsonResponse(bundle([sr("b", "2026-08-02T00:00:00Z")]));
      }
      return jsonResponse(bundle([])); // other resource types: empty
    }) as unknown as typeof fetch;

    const adapter = createFhirAdapter({ baseUrl: "https://x/fhir", fetchImpl }, ctx);
    const { events, unmatched } = await adapter.fetchEvents();

    expect(events.map((e) => e.id)).toContain("fhir-ServiceRequest-a-referral_made");
    expect(events.map((e) => e.id)).toContain("fhir-ServiceRequest-b-referral_made");
    expect(unmatched).toBe(0);
    // 6 resource types × first page, + 1 extra ServiceRequest page.
    expect(fetchImpl).toHaveBeenCalledTimes(7);
  });

  it("sends the FHIR Accept header and a bearer token when configured", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(bundle([]))) as unknown as typeof fetch;
    const adapter = createFhirAdapter({ baseUrl: "https://x/fhir", fetchImpl, token: "abc123" }, ctx);
    await adapter.fetchEvents("2026-08-01T00:00:00.000Z");
    const init = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Accept).toBe("application/fhir+json");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer abc123");
    const calledUrl = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("_lastUpdated=gt2026-08-01");
  });

  it("tolerates one resource type 404ing on the endpoint", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("Communication")) return { ok: false, status: 404, json: async () => ({}) } as Response;
      if (url.includes("ServiceRequest")) return jsonResponse(bundle([sr("a", "2026-08-01T00:00:00Z")]));
      return jsonResponse(bundle([]));
    }) as unknown as typeof fetch;

    const adapter = createFhirAdapter({ baseUrl: "https://x/fhir", fetchImpl }, ctx);
    const { events } = await adapter.fetchEvents();
    expect(events).toHaveLength(1);
  });

  it("reports status without leaking the full URL", () => {
    const adapter = createFhirAdapter({ baseUrl: "https://secret-host.example/fhir", fetchImpl: fetch }, ctx);
    const s = adapter.status();
    expect(s.configured).toBe(true);
    expect(s.detail).toContain("secret-host.example");
    expect(s.detail).not.toContain("/fhir");
  });
});
