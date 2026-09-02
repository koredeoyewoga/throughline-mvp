/**
 * KPI engine. Measurement is built into the product, and every figure is
 * labelled MEASURED (derived from events in this system) or ESTIMATED
 * (an illustrative figure using a stated assumption). Estimates are never
 * presented as outcomes.
 */
import type { AppState, Kpi, Exception } from "@/domain/types";
import { DEFAULT_CONFIG, type PlaceConfig } from "@/config/schema";

const HOUR = 3600 * 1000;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function firstHumanDecisionHours(ex: Exception): number | null {
  const human = ex.decisions.find((d) => d.actor !== "system");
  if (!human) return null;
  return (Date.parse(human.at) - Date.parse(ex.createdAt)) / HOUR;
}

export function computeKpis(state: AppState, kpiCfg: PlaceConfig["kpi"] = DEFAULT_CONFIG.kpi): Kpi[] {
  const ex = state.exceptions;
  const tasks = state.tasks ?? [];
  const nowMs = Date.now();
  const tasksInFlight = tasks.filter((t) => t.status === "open" || t.status === "in_progress" || t.status === "blocked");
  const tasksOverdue = tasksInFlight.filter((t) => nowMs > Date.parse(t.dueAt));
  const tasksEscalated = tasksInFlight.filter((t) => t.escalationLevel > 0);
  const tasksDone = tasks.filter((t) => t.status === "done");
  const open = ex.filter((e) => e.status === "open" || e.status === "in_progress" || e.status === "escalated");
  const closed = ex.filter((e) => e.status === "closed");
  const actioned = ex.filter((e) => e.decisions.some((d) => d.actor !== "system" && (d.kind === "approve" || d.kind === "modify")));
  const closedAfterAction = actioned.filter((e) => e.status === "closed");

  const timeToDecision = ex
    .map(firstHumanDecisionHours)
    .filter((v): v is number => v !== null);
  const medianTtd = median(timeToDecision);

  const delayDaysAtSurface = closed.reduce((sum, e) => {
    const overdue = e.scoreBreakdown.find((b) => /Overdue by/.test(b.factor));
    const days = overdue ? Number(overdue.factor.match(/(\d+)/)?.[1] ?? 0) : 0;
    return sum + days;
  }, 0);

  return [
    {
      key: "open_now",
      label: "Coordination failures needing attention",
      value: String(open.length),
      basis: "measured",
      note: "Exceptions currently open, in progress or escalated.",
    },
    {
      key: "resolved",
      label: "Resolved via Throughline",
      value: String(closed.length),
      basis: "measured",
      note: "Exceptions closed after a coordinator decision (or auto-closed once the source data caught up).",
    },
    {
      key: "time_to_decision",
      label: "Median time to first decision",
      value: medianTtd === null ? "—" : medianTtd < 1 ? `${Math.round(medianTtd * 60)} min` : `${medianTtd.toFixed(1)} h`,
      basis: "measured",
      note: "From the moment Throughline surfaced the item to the first human decision on it.",
    },
    {
      key: "follow_through",
      label: "Actioned items carried to closure",
      value: actioned.length ? `${Math.round((closedAfterAction.length / actioned.length) * 100)}%` : "—",
      basis: "measured",
      note: "Of the items a coordinator approved or amended, the share that reached a closed state.",
    },
    {
      key: "coordinator_time",
      label: "Coordinator time redeployed",
      value: `~${(closed.length * kpiCfg.coordinatorHoursPerResolvedItem).toFixed(1)} h`,
      basis: "estimated",
      note: `Assumption: ${kpiCfg.coordinatorHoursPerResolvedItem} h of manual chasing avoided per resolved item. Illustrative — to be measured with a design partner.`,
    },
    {
      key: "interface_delay",
      label: "Interface delay-days avoided",
      value: `~${Math.round(delayDaysAtSurface * kpiCfg.shareOfDelayAvoided)}`,
      basis: "estimated",
      note: `Assumption: ${kpiCfg.shareOfDelayAvoided * 100}% of the days an item was overdue at the point of resolution would have continued to accrue without earlier detection. Illustrative.`,
    },
    {
      key: "tasks_in_flight",
      label: "Tasks in flight",
      value: String(tasksInFlight.length),
      basis: "measured",
      note: `Dispatched tasks that are open, in progress or blocked. ${tasksDone.length} completed.`,
    },
    {
      key: "tasks_overdue",
      label: "Tasks overdue / escalated",
      value: `${tasksOverdue.length} / ${tasksEscalated.length}`,
      basis: "measured",
      note: "In-flight tasks past their SLA, and those that have been escalated up the ladder.",
    },
    {
      key: "duplication",
      label: "Possible duplicate assessments flagged",
      value: String(ex.filter((e) => e.pattern === "duplicate_assessment").length),
      basis: "measured",
      note: "Pairs of overlapping assessments by different organisations surfaced for de-confliction.",
    },
  ];
}
