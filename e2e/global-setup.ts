/**
 * The e2e suite runs against `next dev`, which compiles each route on first
 * request. A long click-chain that hits several never-compiled routes mid-test
 * can blow an assertion timeout on a cold, loaded machine. This pre-warms every
 * route once so the tests themselves never pay first-compile cost.
 */
const BASE = "http://localhost:3000";

const PAGES = ["/", "/queue", "/worklist", "/kpis", "/audit", "/settings", "/offline"];
const APIS = ["/api/exceptions", "/api/tasks", "/api/config", "/api/ingest"];

export default async function globalSetup() {
  const seedId = "exc-pat-ada-nkemelu-referral-unactioned";
  const warm = async (path: string, init?: RequestInit) => {
    try {
      await fetch(`${BASE}${path}`, init);
    } catch {
      /* server not ready for this one yet — tests will still compile it */
    }
  };

  for (const p of [...PAGES, ...APIS]) await warm(p);
  await warm(`/exceptions/${seedId}`);

  // Compile the dynamic + mutation routes too (a rejected body still compiles).
  await warm(`/api/exceptions/${seedId}`);
  await warm(`/api/exceptions/${seedId}/decision`, { method: "POST", body: "{}" });
  await warm(`/api/tasks/advance`, { method: "POST", body: "{}" });

  // Force a real task to exist, then warm every route the approve→done chain hits.
  await warm(`/api/reset`, { method: "POST" });
  try {
    await fetch(`${BASE}/api/exceptions/${seedId}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "approve", note: "warm-up" }),
    });
    const tasks = await (await fetch(`${BASE}/api/tasks`)).json();
    const taskId = tasks.tasks?.[0]?.id;
    if (taskId) {
      await warm(`/worklist/${taskId}`);
      await warm(`/api/tasks/${taskId}`);
      await warm(`/api/tasks/${taskId}/action`, { method: "POST", body: "{}" });
    }
  } catch {
    /* best effort */
  }
  await warm(`/api/reset`, { method: "POST" });
}
