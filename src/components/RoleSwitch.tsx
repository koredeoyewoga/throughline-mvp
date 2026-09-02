"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Role } from "@/lib/session";

export function RoleSwitch({ role }: { role: Role }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function set(next: Role) {
    start(async () => {
      await fetch("/api/role", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: next }),
      });
      router.refresh();
    });
  }

  return (
    <label className="flex items-center gap-2 text-xs text-slate-muted">
      <span className="hidden sm:inline">Viewing as</span>
      <select
        aria-label="Demo role"
        value={role}
        disabled={pending}
        onChange={(e) => set(e.target.value as Role)}
        className="rounded-lg border border-line bg-white px-2 py-1 text-xs font-semibold text-ink"
      >
        <option value="coordinator">Care coordinator</option>
        <option value="oversight">Place oversight</option>
      </select>
    </label>
  );
}
