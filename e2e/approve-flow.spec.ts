import { test, expect, type APIRequestContext } from "@playwright/test";

async function resetToSeed(request: APIRequestContext) {
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

test("coordinator approves a stuck referral and the loop closes", async ({ page }) => {
  await page.goto("/queue");

  // The queue opens on "what requires attention now" with the seeded failures.
  await expect(page.getByRole("heading", { name: "What requires attention now?" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Needs attention \(12\)/ })).toBeVisible();

  // Open the top item — the patient stuck in an acute bed.
  await page.getByRole("link", { name: /Community referral accepted by no one/ }).click();

  await expect(page.getByRole("heading", { name: /Community referral accepted by no one/ })).toBeVisible();
  await expect(page.getByText("Priority", { exact: false }).first()).toBeVisible();

  // Record a decision.
  await page.getByLabel("Decision note").fill("Called the community intake lead; same-day triage arranged.");
  await page.getByRole("button", { name: "Approve recommended action" }).click();

  // The item is now closed and the decision panel reflects it.
  await expect(page.getByText("This item is closed.")).toBeVisible();
  await expect(page.getByText("Decision history")).toBeVisible();
  await expect(page.getByText(/approve/).first()).toBeVisible();

  // It moves to the Resolved tab on the queue.
  await page.goto("/queue?show=closed&sev=all");
  await expect(page.getByRole("link", { name: /Community referral accepted by no one/ })).toBeVisible();

  // And it is written to the audit trail.
  await page.goto("/audit");
  await expect(page.getByText(/Decision: approve on/).first()).toBeVisible();
});

test("rejecting an item requires a note", async ({ page }) => {
  await page.goto("/queue");
  await page.getByRole("link", { name: /Missed outpatient appointment with no rebooking/ }).click();

  await page.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByText("Add a short note explaining your decision.")).toBeVisible();

  await page.getByLabel("Decision note").fill("Clinically reviewed — no follow-up needed, GP informed.");
  await page.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByText("This item is closed.")).toBeVisible();
});
