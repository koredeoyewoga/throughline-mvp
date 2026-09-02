"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { DecisionKind, ExceptionStatus } from "@/domain/types";

const ACTIONS: { kind: DecisionKind; label: string; className: string; needsNote?: boolean }[] = [
  { kind: "approve", label: "Approve recommended action", className: "btn-primary" },
  { kind: "modify", label: "Amend & approve", className: "btn-secondary", needsNote: true },
  { kind: "escalate", label: "Escalate", className: "btn-secondary", needsNote: true },
  { kind: "reject", label: "Reject", className: "btn-danger", needsNote: true },
  { kind: "close", label: "Close (resolved elsewhere)", className: "btn-secondary", needsNote: true },
];

export function DecisionPanel({
  exceptionId,
  status,
  recommendedAction,
}: {
  exceptionId: string;
  status: ExceptionStatus;
  recommendedAction: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [amended, setAmended] = useState(recommendedAction);
  const [error, setError] = useState<string | null>(null);

  const closed = status === "closed";

  function submit(kind: DecisionKind, needsNote?: boolean) {
    setError(null);
    if (needsNote && !note.trim() && kind !== "modify") {
      setError("Add a short note explaining your decision.");
      return;
    }
    start(async () => {
      const res = await fetch(`/api/exceptions/${exceptionId}/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          note: note.trim() || undefined,
          amendedAction: kind === "modify" ? amended.trim() : undefined,
        }),
      });
      if (!res.ok) {
        setError("Something went wrong recording that decision.");
        return;
      }
      setNote("");
      router.refresh();
    });
  }

  if (closed) {
    return (
      <div className="rounded-lg bg-mist p-3 text-sm text-slate">
        This item is closed. Re-run detection from the queue if the source data has changed.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="label">Amended action (for “Amend &amp; approve”)</span>
        <textarea
          value={amended}
          onChange={(e) => setAmended(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-line p-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="label">Decision note</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. spoke to the community intake lead, triage booked for today"
          className="mt-1 w-full rounded-lg border border-line p-2 text-sm"
        />
      </label>
      {error && <p className="text-sm font-medium text-amber">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((a) => (
          <button
            key={a.kind}
            className={a.className}
            disabled={pending}
            onClick={() => submit(a.kind, a.needsNote)}
          >
            {a.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-muted">
        Nothing is sent automatically. Approving records your decision and simulates the resolving update flowing back
        from the owning team, so the loop closes.
      </p>
    </div>
  );
}
