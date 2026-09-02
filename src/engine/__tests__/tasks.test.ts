import { describe, it, expect } from "vitest";
import { createTaskFromException, sweepTasks, applyTaskAction } from "@/engine/tasks";
import { DEFAULT_CONFIG } from "@/config/schema";
import type { Exception, Task } from "@/domain/types";

const WF = DEFAULT_CONFIG.workflow; // taskSla 24, L1 after 12h past due, L2 after 36h

function fakeException(over: Partial<Exception> = {}): Exception {
  return {
    id: "exc-x",
    patientId: "pat-ada-nkemelu",
    placeId: "place-meadowford",
    pattern: "referral_unactioned",
    severity: "high",
    score: 85,
    scoreBreakdown: [],
    title: "Community referral accepted by no one",
    why: "…",
    whySource: "deterministic",
    evidence: [],
    recommendedAction: "Escalate to the community intake team.",
    owner: { functionArea: "therapies", orgId: "org-mch", label: "Community Rehab · MCH" },
    confidence: "high",
    status: "open",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    decisions: [],
    governance: [],
    needsFactCheck: false,
    ...over,
  };
}

function makeTask(ageHours: number): Task {
  const created = new Date(Date.now() - ageHours * 3600_000).toISOString();
  return createTaskFromException(fakeException(), {
    id: "task-1",
    now: created,
    actor: "coordinator",
    slaHours: WF.taskSlaHours,
  });
}

describe("createTaskFromException", () => {
  it("sets the SLA due time, opens the task at level 0, and logs creation", () => {
    const now = "2026-02-01T00:00:00.000Z";
    const t = createTaskFromException(fakeException(), { id: "t1", now, actor: "coordinator", slaHours: 24 });
    expect(t.status).toBe("open");
    expect(t.escalationLevel).toBe(0);
    expect(t.dueAt).toBe("2026-02-02T00:00:00.000Z");
    expect(t.title).toContain("Ada Nkemelu");
    expect(t.detail).toBe("Escalate to the community intake team.");
    expect(t.activity.map((a) => a.kind)).toEqual(["created"]);
  });

  it("uses the coordinator's amended action when supplied", () => {
    const t = createTaskFromException(fakeException(), {
      id: "t2",
      now: "2026-02-01T00:00:00.000Z",
      actor: "c",
      slaHours: 24,
      detail: "Ring the intake lead directly and book same-day triage.",
    });
    expect(t.detail).toBe("Ring the intake lead directly and book same-day triage.");
  });
});

describe("sweepTasks — the escalation ladder", () => {
  it("leaves a task that is not yet past its escalation threshold alone", () => {
    // 30h old, SLA 24h → 6h past due, below the 12h L1 threshold.
    const { tasks, changed } = sweepTasks([makeTask(30)], new Date().toISOString(), WF);
    expect(changed).toBe(0);
    expect(tasks[0].escalationLevel).toBe(0);
  });

  it("escalates to level 1 (team lead) once far enough past due", () => {
    // 40h old → 16h past due (>= 12h).
    const { tasks, changed } = sweepTasks([makeTask(40)], new Date().toISOString(), WF);
    expect(changed).toBe(1);
    expect(tasks[0].escalationLevel).toBe(1);
    const kinds = tasks[0].activity.map((a) => a.kind);
    expect(kinds).toContain("escalate");
    expect(kinds).toContain("reminder");
  });

  it("escalates straight to level 2 (place / ICB) when very overdue", () => {
    // 65h old → 41h past due (>= 36h).
    const { tasks } = sweepTasks([makeTask(65)], new Date().toISOString(), WF);
    expect(tasks[0].escalationLevel).toBe(2);
  });

  it("never escalates a done or cancelled task", () => {
    const done: Task = { ...makeTask(65), status: "done" };
    const { tasks, changed } = sweepTasks([done], new Date().toISOString(), WF);
    expect(changed).toBe(0);
    expect(tasks[0].escalationLevel).toBe(0);
  });

  it("does not re-escalate a task already at the target level", () => {
    const first = sweepTasks([makeTask(40)], new Date().toISOString(), WF).tasks;
    const second = sweepTasks(first, new Date().toISOString(), WF);
    expect(second.changed).toBe(0);
  });
});

describe("applyTaskAction", () => {
  const base = makeTask(1);

  it("assigns and unassigns, logging both", () => {
    const assigned = applyTaskAction(base, { kind: "assign", actor: "c", now: "t", value: "J. Marsh" }).task;
    expect(assigned.assignee).toBe("J. Marsh");
    const returned = applyTaskAction(assigned, { kind: "assign", actor: "c", now: "t", value: "" }).task;
    expect(returned.assignee).toBeUndefined();
    expect(returned.activity.filter((a) => a.kind === "assigned")).toHaveLength(2);
  });

  it("marking done reports completion", () => {
    const r = applyTaskAction(base, { kind: "status", actor: "c", now: "t", value: "done" });
    expect(r.completed).toBe(true);
    expect(r.task.status).toBe("done");
  });

  it("a manual escalate bumps one level and caps at 2", () => {
    let t = base;
    t = applyTaskAction(t, { kind: "escalate", actor: "c", now: "t" }).task;
    expect(t.escalationLevel).toBe(1);
    t = applyTaskAction(t, { kind: "escalate", actor: "c", now: "t" }).task;
    t = applyTaskAction(t, { kind: "escalate", actor: "c", now: "t" }).task;
    expect(t.escalationLevel).toBe(2);
  });

  it("a nudge or note only appends activity", () => {
    const t = applyTaskAction(base, { kind: "nudge", actor: "c", now: "t", note: "left a voicemail" }).task;
    expect(t.status).toBe(base.status);
    expect(t.activity.at(-1)).toMatchObject({ kind: "nudge", detail: "left a voicemail" });
  });
});
