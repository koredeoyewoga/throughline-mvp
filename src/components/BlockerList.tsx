"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Blocker } from "@/domain/types";
import { BlockerStatusBadge } from "./Badge";
import { blockerCategoryLabel, realSince } from "@/lib/format";

export function BlockerList({ blockers }: { blockers: Blocker[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");

  function resolve(id: string) {
    start(async () => {
      await fetch(`/api/blockers/${id}/resolve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note }),
      });
      setNoteFor(null);
      setNote("");
      router.refresh();
    });
  }

  if (blockers.length === 0) return null;

  return (
    <ul className="space-y-3">
      {blockers.map((b) => (
        <li key={b.id} className="rounded-lg border border-line p-3">
          <div className="flex flex-wrap items-center gap-2">
            <BlockerStatusBadge status={b.status} />
            <span className="pill bg-mist text-slate">{blockerCategoryLabel(b.category)}</span>
            {b.externalDependency && (
              <span className="pill bg-white text-slate-muted ring-1 ring-inset ring-line">
                External: {b.externalDependency}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm font-semibold text-ink">{b.title}</p>
          <p className="mt-0.5 text-sm text-slate">{b.description}</p>
          <p className="mt-1 text-xs text-slate-muted">
            Reported by {b.createdBy} · {realSince(b.createdAt)}
            {b.status === "resolved" && b.resolvedBy && (
              <> · resolved by {b.resolvedBy} {realSince(b.resolvedAt!)}</>
            )}
          </p>
          {b.status === "resolved" && b.resolutionNote && (
            <p className="mt-1 text-sm text-slate">
              <span className="font-medium text-ink">Resolution:</span> {b.resolutionNote}
            </p>
          )}
          {b.status !== "resolved" && (
            <div className="mt-2">
              {noteFor === b.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="How was this resolved? (optional)"
                    className="flex-1 rounded-lg border border-line p-1.5 text-sm"
                  />
                  <button className="btn-primary" disabled={pending} onClick={() => resolve(b.id)}>
                    Confirm resolved
                  </button>
                  <button className="btn-secondary" disabled={pending} onClick={() => setNoteFor(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button className="btn-secondary" disabled={pending} onClick={() => setNoteFor(b.id)}>
                  Mark resolved
                </button>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
