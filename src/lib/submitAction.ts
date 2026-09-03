"use client";

import { enqueue } from "./offline-queue";

export type SubmitResult =
  | { ok: true; queued: false; data: unknown }
  | { ok: true; queued: true }
  | { ok: false; queued: false; status: number };

function notifyQueued() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("throughline:queued"));
}

/**
 * POST a mutation. If the request fails (offline / unreachable) it is written to
 * the offline queue and replayed on reconnect (see PwaProvider).
 *
 * We always attempt the request rather than trusting `navigator.onLine`, which
 * is unreliable in some browsers and automated environments.
 */
export async function submitAction(url: string, body: unknown, label: string): Promise<SubmitResult> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined,
    });
    if (!res.ok) {
      // A 5xx may recover on retry; queue it. A 4xx will not; report it.
      if (res.status >= 500) {
        await enqueue({ url, method: "POST", body, label, at: Date.now() });
        notifyQueued();
        return { ok: true, queued: true };
      }
      return { ok: false, queued: false, status: res.status };
    }
    const data = await res.json().catch(() => ({}));
    return { ok: true, queued: false, data };
  } catch {
    await enqueue({ url, method: "POST", body, label, at: Date.now() });
    notifyQueued();
    return { ok: true, queued: true };
  }
}
