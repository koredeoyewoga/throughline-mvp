import { test, expect } from "@playwright/test";

test.describe("RBAC on privileged endpoints", () => {
  test("a coordinator is refused config edits and source ingestion; oversight is allowed", async ({ playwright }) => {
    const asCoordinator = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
    await asCoordinator.post("/api/auth/login", { data: { userId: "u-coordinator" } });

    const putAsCoordinator = await asCoordinator.put("/api/config", {
      data: { thresholds: { pingPongMinRejections: 3 } },
    });
    expect(putAsCoordinator.status()).toBe(403);
    expect((await putAsCoordinator.json()).permission).toBe("config:edit");
    expect((await asCoordinator.post("/api/ingest")).status()).toBe(403);

    const asOversight = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
    await asOversight.post("/api/auth/login", { data: { userId: "u-oversight" } });
    const putAsOversight = await asOversight.put("/api/config", {
      data: { thresholds: { pingPongMinRejections: 3 } },
    });
    expect(putAsOversight.ok()).toBeTruthy();
    await asOversight.delete("/api/config"); // restore

    await asCoordinator.dispose();
    await asOversight.dispose();
  });

  test("an unauthenticated request is redirected / 401'd", async ({ playwright }) => {
    const anon = await playwright.request.newContext({
      baseURL: "http://localhost:3000",
      storageState: { cookies: [], origins: [] }, // ignore the project's signed-in state
    });
    expect((await anon.get("/api/exceptions", { maxRedirects: 0 })).status()).toBe(401);
    const res = await anon.get("/queue", { maxRedirects: 0 });
    expect([302, 307]).toContain(res.status());
    expect(res.headers()["location"]).toContain("/login");
    await anon.dispose();
  });

  test("Settings is read-only for a coordinator and editable for oversight", async ({ page }) => {
    // Default storageState = coordinator.
    await page.goto("/settings");
    await expect(page.getByText(/Configuration and source ingestion are read-only/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Save & re-run detection/ })).toBeDisabled();
  });

  test.describe("as oversight", () => {
    test.use({ storageState: "e2e/.auth/oversight.json" });
    test("Settings is editable", async ({ page }) => {
      await page.goto("/settings");
      await expect(page.getByText(/Configuration and source ingestion are read-only/)).toHaveCount(0);
      await expect(page.getByRole("button", { name: /Save & re-run detection/ })).toBeEnabled();
    });
  });
});
