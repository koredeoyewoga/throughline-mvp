/**
 * (1) Sign in as each demo identity and save a Playwright storage state, so the
 *     specs run authenticated (config `use.storageState` picks up coordinator;
 *     the RBAC spec overrides to oversight).
 * (2) Pre-warm every route — `next dev` compiles on first hit, and a long
 *     click-chain that meets several cold routes can blow an assertion timeout.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const AUTH_DIR = path.join(__dirname, ".auth");

const PAGES = ["/", "/queue", "/worklist", "/blockers", "/kpis", "/audit", "/settings", "/offline", "/login"];
const APIS = ["/api/exceptions", "/api/tasks", "/api/config", "/api/ingest", "/api/blockers"];

export default async function globalSetup() {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const browser = await chromium.launch();

  // Force the auth middleware to compile against an unauthenticated request
  // before any test relies on it (dev compiles middleware lazily).
  const anon = await browser.newContext();
  for (let i = 0; i < 5; i++) {
    const r = await anon.request.get(`${BASE}/api/exceptions`, { maxRedirects: 0 }).catch(() => null);
    if (r && r.status() === 401) break;
    await new Promise((res) => setTimeout(res, 500));
  }
  await anon.close();

  const coordinator = await browser.newContext();
  await coordinator.request.post(`${BASE}/api/auth/login`, { data: { userId: "u-coordinator" } });
  await coordinator.storageState({ path: path.join(AUTH_DIR, "coordinator.json") });

  const oversight = await browser.newContext();
  await oversight.request.post(`${BASE}/api/auth/login`, { data: { userId: "u-oversight" } });
  await oversight.storageState({ path: path.join(AUTH_DIR, "oversight.json") });

  // Warm every route as an authenticated user.
  const req = oversight.request;
  const seedId = "exc-pat-ada-nkemelu-referral-unactioned";
  const warm = (p: string, init?: Parameters<typeof req.fetch>[1]) => req.fetch(`${BASE}${p}`, init).catch(() => {});

  for (const p of [...PAGES, ...APIS]) await warm(p);
  await warm(`/exceptions/${seedId}`);
  await warm(`/api/exceptions/${seedId}`);
  await warm(`/api/exceptions/${seedId}/decision`, { method: "POST", data: {} });
  await warm(`/api/tasks/advance`, { method: "POST", data: {} });

  await warm(`/api/reset`, { method: "POST" });
  try {
    await req.post(`${BASE}/api/exceptions/${seedId}/decision`, { data: { kind: "approve", note: "warm-up" } });
    const tasks = await (await req.get(`${BASE}/api/tasks`)).json();
    const taskId = tasks.tasks?.[0]?.id;
    if (taskId) {
      await warm(`/worklist/${taskId}`);
      await warm(`/api/tasks/${taskId}`);
      await warm(`/api/tasks/${taskId}/action`, { method: "POST", data: {} });
      await warm(`/api/tasks/${taskId}/handoff`, { method: "POST", data: {} });
    }
    await warm(`/exceptions/${seedId}`); // re-warm now the exception carries a Blockers section
    await warm(`/api/blockers`, { method: "POST", data: {} });
    await warm(`/api/blockers/warm-nonexistent`);
    await warm(`/api/blockers/warm-nonexistent/resolve`, { method: "POST", data: {} });
    await warm(`/api/handoffs/warm-nonexistent/acknowledge`, { method: "POST" });
  } catch {
    /* best effort */
  }
  await warm(`/api/reset`, { method: "POST" });

  await browser.close();
}
