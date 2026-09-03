"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function IngestButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function pull() {
    setMsg(null);
    start(async () => {
      const res = await fetch("/api/ingest", { method: "POST" });
      const body = (await res.json()) as {
        adapter: string;
        added: number;
        skipped: number;
        unmatched: number;
        exceptions: number;
        note?: string;
      };
      setMsg(
        body.note ??
          `${body.adapter}: +${body.added} new · ${body.skipped} already held · ${body.unmatched} unmatched · ${body.exceptions} open items`,
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        className="btn-secondary"
        disabled={pending || disabled}
        onClick={pull}
        title="Pull events from the configured source adapter and re-run detection"
      >
        {pending ? "Pulling…" : "Pull from source"}
      </button>
      {msg && <span className="text-xs text-slate">{msg}</span>}
    </div>
  );
}
