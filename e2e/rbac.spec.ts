import { test, expect } from "@playwright/test";

const OVERSIGHT = { Cookie: "throughline_role=oversight" };

test.describe("RBAC on privileged endpoints", () => {
  test("a coordinator is refused config edits and source ingestion; oversight is allowed", async ({ request }) => {
    // Default role is coordinator (no cookie).
    const putAsCoordinator = await request.put("/api/config", { data: { thresholds: { pingPongMinRejections: 3 } } });
    expect(putAsCoordinator.status()).toBe(403);
    expect((await putAsCoordinator.json()).permission).toBe("config:edit");

    const ingestAsCoordinator = await request.post("/api/ingest");
    expect(ingestAsCoordinator.status()).toBe(403);

    const putAsOversight = await request.put("/api/config", {
      headers: OVERSIGHT,
      data: { thresholds: { pingPongMinRejections: 3 } },
    });
    expect(putAsOversight.ok()).toBeTruthy();

    // restore
    await request.delete("/api/config", { headers: OVERSIGHT });
  });

  test("the Settings screen is read-only for a coordinator and editable after switching to oversight", async ({ page, context }) => {
    await page.goto("/settings");
    await expect(page.getByText(/Configuration and source ingestion are read-only/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Save & re-run detection/ })).toBeDisabled();

    await context.addCookies([
      { name: "throughline_role", value: "oversight", url: "http://localhost:3000" },
    ]);
    await page.goto("/settings");
    await expect(page.getByText(/Configuration and source ingestion are read-only/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Save & re-run detection/ })).toBeEnabled();
  });
});
