"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Handoff } from "@/domain/types";
import { realSince } from "@/lib/format";

export function HandoffPanel({ taskId, handoffs }: { taskId: string; handoffs: Handoff[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [toOwner, setToOwner] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sorted = [...handoffs].sort((a, b) => b.at.localeCompare(a.at));
  const pendingHandoff = sorted.find((h) => !h.acknowledgedAt);

  function handOff() {
    if (!toOwner.trim() || !reason.trim()) {
      setError("Both fields are required.");
      return;
    }
    setError(null);
    start(async () => {
      const res = await fetch(`/api/tasks/${taskId}/handoff`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ toOwner, reason }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error === "forbidden" ? body.detail : "Could not create the handoff.");
        return;
      }
      setToOwner("");
      setReason("");
      setOpen(false);
      router.refresh();
    });
  }

  function acknowledge(id: string) {
    start(async () => {
      await fetch(`/api/handoffs/${id}/acknowledge`, { method: "POST" });
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {pendingHandoff && (
        <div className="rounded-lg border border-amber-soft bg-amber-soft/50 p-3 text-sm text-ink">
          <p>
            Handed off to <span className="font-semibold">{pendingHandoff.toOwner}</span> by {pendingHandoff.by} ·{" "}
            {realSince(pendingHandoff.at)}. Ownership is not confirmed until they acknowledge it.
          </p>
          <p className="mt-1 text-slate">{pendingHandoff.reason}</p>
          <button className="btn-primary mt-2" disabled={pending} onClick={() => acknowledge(pendingHandoff.id)}>
            Acknowledge — I own this now
          </button>
        </div>
      )}

      {sorted.length > 0 && (
        <ol className="space-y-2">
          {sorted.map((h) => (
            <li key={h.id} className="text-xs text-slate-muted">
              {h.fromOwner ? `${h.fromOwner} → ` : "Unassigned → "}
              <span className="font-medium text-ink">{h.toOwner}</span> · {h.by} · {realSince(h.at)}
              {h.acknowledgedAt ? (
                <> · acknowledged by {h.acknowledgedBy} {realSince(h.acknowledgedAt)}</>
              ) : (
                <span className="text-amber"> · not yet acknowledged</span>
              )}
            </li>
          ))}
        </ol>
      )}

      {open ? (
        <div className="space-y-2 rounded-lg border border-line p-3">
          <label className="block">
            <span className="label">Hand off to</span>
            <input
              value={toOwner}
              onChange={(e) => setToOwner(e.target.value)}
              placeholder="name or team"
              className="mt-1 w-full rounded-lg border border-line p-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="label">Reason</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="why ownership is moving"
              className="mt-1 w-full rounded-lg border border-line p-2 text-sm"
            />
          </label>
          {error && <p className="text-xs text-amber">{error}</p>}
          <div className="flex gap-2">
            <button className="btn-primary" disabled={pending} onClick={handOff}>
              {pending ? "Sending…" : "Send handoff"}
            </button>
            <button className="btn-secondary" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="btn-secondary" onClick={() => setOpen(true)}>
          Hand off to someone else
        </button>
      )}
      <p className="text-xs text-slate-muted">
        A handoff is a formal change of ownership — the previous owner stays responsible until the new owner
        acknowledges it.
      </p>
    </div>
  );
}
