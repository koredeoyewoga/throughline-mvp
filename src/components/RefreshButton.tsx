"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);

  function run() {
    start(async () => {
      await fetch("/api/refresh", { method: "POST" });
      setDone(true);
      router.refresh();
      setTimeout(() => setDone(false), 2000);
    });
  }

  return (
    <button className="btn-secondary" onClick={run} disabled={pending}>
      {pending ? "Re-running…" : done ? "Detection re-run" : "Re-run detection"}
    </button>
  );
}
