import { test, expect, type APIRequestContext } from "@playwright/test";

async function resetToSeed(request: APIRequestContext) {
  await request.delete("/api/config");
  await request.post("/api/reset");
}

test.beforeEach(async ({ request }) => {
  await resetToSeed(request);
});
test.afterAll(async ({ request }) => {
  await resetToSeed(request);
});

test("a decision taken offline is held and syncs on reconnect", async ({ page, context, request }) => {
  await page.goto("/queue");
  await page.getByRole("link", { name: /Community referral accepted by no one/ }).click();
  await page.getByLabel("Decision note").fill("Approving from a ward with no wifi.");

  await context.setOffline(true);
  await page.getByRole("button", { name: "Approve recommended action" }).click();

  // Held locally — not sent, and the app says so.
  await expect(page.getByText(/this decision is held/i)).toBeVisible();
  await expect(page.getByText(/Offline — showing the last synced view/)).toBeVisible();
  await expect(page.getByText(/Held 1 action/)).toBeVisible();

  // No task was dispatched while offline.
  const tasksWhileOffline = await request.get("/api/tasks");
  expect((await tasksWhileOffline.json()).count).toBe(3); // just the seeded ones

  // Reconnect → the queued decision replays automatically.
  await context.setOffline(false);
  await expect(page.getByText(/Held 1 action/)).toBeHidden({ timeout: 15_000 });

  // The decision landed: a task was dispatched and the audit trail has it.
  await expect
    .poll(async () => (await (await request.get("/api/tasks")).json()).count, { timeout: 10_000 })
    .toBe(4);
  await page.goto("/audit");
  await expect(page.getByText(/Decision: approve on/).first()).toBeVisible();
});
