"use client";

import { useState } from "react";
import type { SessionUser } from "@/lib/auth/session";

const ROLE_LABEL: Record<SessionUser["role"], string> = {
  coordinator: "Care coordinator",
  oversight: "Place oversight",
};

export function UserMenu({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-line bg-white px-2.5 py-1 text-xs"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-teal-soft text-[11px] font-bold text-teal">
          {user.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
        </span>
        <span className="text-left">
          <span className="block font-semibold text-ink">{user.name}</span>
          <span className="block text-slate-muted">{ROLE_LABEL[user.role]}</span>
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 w-60 rounded-lg border border-line bg-white p-2 text-xs shadow-lg"
        >
          <p className="px-2 py-1 text-slate-muted">
            Scoped to <span className="font-medium text-ink">{user.placeId.replace(/^place-/, "")}</span>. Role and place
            are enforced server-side.
          </p>
          <a
            href="/login"
            className="mt-1 block rounded px-2 py-1.5 font-medium text-ink hover:bg-mist"
            role="menuitem"
          >
            Switch identity
          </a>
          <button
            onClick={signOut}
            disabled={pending}
            className="block w-full rounded px-2 py-1.5 text-left font-medium text-ink hover:bg-mist"
            role="menuitem"
          >
            {pending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
