"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { DecisionKind, ExceptionStatus } from "@/domain/types";
import { submitAction } from "@/lib/submitAction";

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

  const [queued, setQueued] = useState(false);
  const closed = status === "closed";

  function submit(kind: DecisionKind, needsNote?: boolean) {
    setError(null);
    setQueued(false);
    if (needsNote && !note.trim() && kind !== "modify") {
      setError("Add a short note explaining your decision.");
      return;
    }
    start(async () => {
      const res = await submitAction(
        `/api/exceptions/${exceptionId}/decision`,
        {
          kind,
          note: note.trim() || undefined,
          amendedAction: kind === "modify" ? amended.trim() : undefined,
        },
        `${kind} — this item`,
      );
      if (!res.ok) {
        setError("Something went wrong recording that decision.");
        return;
      }
      setNote("");
      if (res.queued) setQueued(true);
      else router.refresh();
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
      {queued && (
        <p className="rounded-lg bg-amber-soft/60 p-2 text-sm text-ink">
          You&rsquo;re offline — this decision is held and will sync automatically when you reconnect.
        </p>
      )}
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
        Nothing is sent automatically. Approving (or amending) dispatches a tracked task to the owning team on the{" "}
        <span className="font-medium">Worklist</span>; the coordination failure closes when that task is marked done.
      </p>
    </div>
  );
}
