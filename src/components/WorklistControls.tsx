"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function WorklistControls() {
  const router = useRouter();
  const [pending, start] = useTransition();

  function advance() {
    start(async () => {
      await fetch("/api/tasks/advance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hours: 12 }),
      });
      router.refresh();
    });
  }

  return (
    <button className="btn-secondary" disabled={pending} onClick={advance} title="Dev helper — pulls every task's clock back 12h so SLA breaches and auto-escalation show live">
      {pending ? "Advancing…" : "Advance clock 12h"}
    </button>
  );
}
