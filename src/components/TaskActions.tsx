"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { TaskStatus } from "@/domain/types";
import { submitAction } from "@/lib/submitAction";

export function TaskActions({
  taskId,
  status,
  assignee,
}: {
  taskId: string;
  status: TaskStatus;
  assignee?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [who, setWho] = useState(assignee ?? "");
  const [note, setNote] = useState("");
  const [queued, setQueued] = useState(false);

  const closed = status === "done" || status === "cancelled";

  function post(kind: string, extra: Record<string, string> = {}) {
    setQueued(false);
    start(async () => {
      const res = await submitAction(`/api/tasks/${taskId}/action`, { kind, ...extra }, `task ${kind}`);
      setNote("");
      if (res.ok && res.queued) setQueued(true);
      else router.refresh();
    });
  }

  if (closed) {
    return (
      <p className="rounded-lg bg-mist p-3 text-sm text-slate">
        This task is {status}. {status === "done" && "Completing it fed the resolving update back and closed the source coordination failure."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1">
          <span className="label">Assignee</span>
          <input
            value={who}
            onChange={(e) => setWho(e.target.value)}
            placeholder="name (blank = team inbox)"
            className="mt-1 w-full rounded-lg border border-line p-2 text-sm"
          />
        </label>
        <button className="btn-secondary" disabled={pending} onClick={() => post("assign", { value: who })}>
          Assign
        </button>
      </div>

      <label className="block">
        <span className="label">Note / chase message</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. left a voicemail for the intake lead"
          className="mt-1 w-full rounded-lg border border-line p-2 text-sm"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" disabled={pending} onClick={() => post("nudge", { note })}>
          Nudge the team
        </button>
        <button className="btn-secondary" disabled={pending} onClick={() => post("note", { note })}>
          Add note
        </button>
        <button className="btn-danger" disabled={pending} onClick={() => post("escalate")}>
          Escalate a level
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        {(["in_progress", "blocked", "open"] as TaskStatus[])
          .filter((s) => s !== status)
          .map((s) => (
            <button key={s} className="btn-secondary" disabled={pending} onClick={() => post("status", { value: s })}>
              Mark {s.replace("_", " ")}
            </button>
          ))}
        <button className="btn-primary" disabled={pending} onClick={() => post("status", { value: "done" })}>
          Mark done — close the loop
        </button>
      </div>
      {queued && (
        <p className="rounded-lg bg-amber-soft/60 p-2 text-sm text-ink">
          You&rsquo;re offline — this action is held and will sync when you reconnect.
        </p>
      )}
      <p className="text-xs text-slate-muted">
        Reminders and escalations are logged as the notification that <em>would</em> be sent; nothing leaves the
        system in this MVP.
      </p>
    </div>
  );
}
