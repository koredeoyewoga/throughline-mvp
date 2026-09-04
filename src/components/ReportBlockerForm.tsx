"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BLOCKER_CATEGORIES, type BlockerCategory } from "@/domain/types";
import { blockerCategoryLabel } from "@/lib/format";

export function ReportBlockerForm({ exceptionId, taskId }: { exceptionId?: string; taskId?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<BlockerCategory>("awaiting_other_team");
  const [description, setDescription] = useState("");
  const [externalDependency, setExternalDependency] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!title.trim() || !description.trim()) {
      setError("Title and description are required.");
      return;
    }
    setError(null);
    start(async () => {
      const res = await fetch("/api/blockers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          exceptionId,
          taskId,
          title,
          category,
          description,
          externalDependency: externalDependency || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error === "forbidden" ? body.detail : "Could not report the blocker.");
        return;
      }
      setTitle("");
      setDescription("");
      setExternalDependency("");
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button className="btn-secondary" onClick={() => setOpen(true)}>
        Report a blocker
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-line p-3">
      <label className="block">
        <span className="label">What&rsquo;s blocking progress?</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Awaiting a callback from the GP practice"
          className="mt-1 w-full rounded-lg border border-line p-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="label">Category</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as BlockerCategory)}
          className="mt-1 w-full rounded-lg border border-line p-2 text-sm"
        >
          {BLOCKER_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {blockerCategoryLabel(c)}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="label">Detail</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-line p-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="label">External organisation / team (if relevant)</span>
        <input
          value={externalDependency}
          onChange={(e) => setExternalDependency(e.target.value)}
          placeholder="blank if none"
          className="mt-1 w-full rounded-lg border border-line p-2 text-sm"
        />
      </label>
      {error && <p className="text-xs text-amber">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending} onClick={submit}>
          {pending ? "Reporting…" : "Report blocker"}
        </button>
        <button className="btn-secondary" disabled={pending} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
