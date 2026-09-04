import { test, expect, type APIRequestContext } from "@playwright/test";

async function resetToSeed(request: APIRequestContext) {
  // Resetting config needs the oversight role (config:reset); reset needs a session.
  await request.post("/api/auth/login", { data: { userId: "u-oversight" } });
  await request.delete("/api/config");
  const res = await request.post("/api/reset");
  expect(res.ok()).toBeTruthy();
}

test.beforeEach(async ({ request }) => {
  await resetToSeed(request);
});

test.afterAll(async ({ request }) => {
  await resetToSeed(request);
});

test("approve → task dispatched → task done → coordination failure closes", async ({ page }) => {
  await page.goto("/queue");
  await expect(page.getByRole("heading", { name: "What requires attention now?" })).toBeVisible();

  await page.getByRole("link", { name: /Community referral accepted by no one/ }).click();
  await expect(page.getByRole("heading", { name: /Community referral accepted by no one/ })).toBeVisible();

  await page.getByLabel("Decision note").fill("Agreed the community intake lead will pick this up.");
  await page.getByRole("button", { name: "Approve recommended action" }).click();

  // The recommendation becomes a tracked task, not an instant close.
  const dispatched = page.locator("section", { hasText: "Task dispatched" });
  await expect(dispatched).toBeVisible();
  await dispatched.getByRole("link", { name: "Open the task" }).click();

  // On the task page, complete it.
  await expect(page.getByRole("heading", { name: "Work this task" })).toBeVisible();
  await page.getByRole("button", { name: /Mark done/ }).click();
  await expect(page.getByText(/This task is done/)).toBeVisible();

  // The source coordination failure is now closed and shows on the Resolved tab.
  await page.goto("/queue?show=closed&sev=all");
  await expect(page.getByRole("link", { name: /Community referral accepted by no one/ })).toBeVisible();

  // Both the decision and the task work are in the audit trail.
  await page.goto("/audit");
  await expect(page.getByText(/Decision: approve on/).first()).toBeVisible();
  await expect(page.getByText(/Task status:/).first()).toBeVisible();
});

test("the worklist opens with seeded tasks and shows escalation", async ({ page, request }) => {
  await page.goto("/worklist");
  await expect(page.getByRole("heading", { name: "Worklist" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Re-book the stalled first visit/ })).toBeVisible();

  // Advance the clock — an overdue task climbs the escalation ladder.
  await request.post("/api/tasks/advance", { data: { hours: 12 } });
  await request.post("/api/tasks/advance", { data: { hours: 12 } });
  await page.reload();
  await expect(page.getByText(/Escalated · Place \/ ICB/).first()).toBeVisible();
});

test("rejecting an item requires a note, then closes it directly", async ({ page }) => {
  await page.goto("/queue");
  await page.getByRole("link", { name: /Missed outpatient appointment with no rebooking/ }).click();

  await page.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByText("Add a short note explaining your decision.")).toBeVisible();

  await page.getByLabel("Decision note").fill("Clinically reviewed — no follow-up needed, GP informed.");
  await page.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByText("This item is closed.")).toBeVisible();
});
