"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function ResetButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run() {
    if (!confirm("Reset the demo to the synthetic seed? All decisions in this session will be cleared.")) return;
    start(async () => {
      await fetch("/api/reset", { method: "POST" });
      router.push("/queue");
      router.refresh();
    });
  }

  return (
    <button className="btn-secondary" onClick={run} disabled={pending}>
      {pending ? "Resetting…" : "Reset demo to seed"}
    </button>
  );
}
