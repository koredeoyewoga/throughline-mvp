"use client";

import { useState } from "react";
import type { DemoUser } from "@/lib/auth/users";

export function LoginForm({ users, oidc, next }: { users: DemoUser[]; oidc: boolean; next: string }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = busyId !== null;

  if (oidc) {
    return (
      <a className="btn-primary text-center" href={`/api/auth/start?next=${encodeURIComponent(next)}`}>
        Sign in with NHS CIS2
      </a>
    );
  }

  async function pick(id: string) {
    setError(null);
    setBusyId(id);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: id }),
    });
    if (!res.ok) {
      setError("Could not sign in — try again.");
      setBusyId(null);
      return;
    }
    // Full navigation so middleware + the server layout pick up the new cookie.
    window.location.assign(next);
  }

  return (
    <div className="flex flex-col gap-2">
      {users.map((u) => (
        <button
          key={u.sub}
          onClick={() => pick(u.sub)}
          disabled={pending}
          className="card p-3 text-left hover:border-teal disabled:opacity-60"
        >
          <span className="flex items-baseline justify-between gap-2">
            <span className="font-semibold text-ink">{u.name}</span>
            <span className="rounded bg-mist px-1.5 py-0.5 text-[11px] font-medium text-slate">
              {u.role === "oversight" ? "oversight" : "coordinator"}
            </span>
          </span>
          <span className="mt-0.5 block text-xs text-slate">{u.blurb}</span>
          {busyId === u.sub && <span className="mt-1 block text-xs text-teal">Signing in…</span>}
        </button>
      ))}
      {error && <p className="text-xs text-amber">{error}</p>}
    </div>
  );
}
