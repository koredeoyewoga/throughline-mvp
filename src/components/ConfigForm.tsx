"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PlaceConfig } from "@/config/schema";
import { patternLabel } from "@/lib/format";

interface SlaRow {
  key: string;
  pathwayLabel: string;
  stepDescription: string;
  defaultHours: number;
  currentHours: number;
  overridden: boolean;
}

const THRESHOLD_LABELS: Record<keyof PlaceConfig["thresholds"], string> = {
  duplicateAssessmentWindowDays: "Duplicate assessment — max days between two assessments",
  pingPongMinRejections: "Referral ping-pong — rejections before it flags",
  loopNotClosedMinOverdueHours: "Loop not closed — hours overdue before it flags",
  cancellationRebookSlaHours: "Cancellation — hours allowed to rebook",
  onwardReferralDefaultSlaHours: "Onward referral — default hours allowed (if the task has no SLA)",
  handoverAdmissionWindowDays: "Handover gap — how recent the admission must be (days)",
  caseloadLookbackDays: "Handover gap — how far back to look for an active caseload (days)",
};

const SCORING_LABELS: Record<Exclude<keyof PlaceConfig["scoring"], "patternBase">, string> = {
  overduePointsPerDay: "Points added per day overdue",
  overdueCap: "Maximum points from being overdue",
  severityHighAt: "Score at or above this is HIGH",
  severityMediumAt: "Score at or above this is MEDIUM",
};

function Num({
  value,
  onChange,
  hint,
  step = 1,
}: {
  value: number;
  onChange: (n: number) => void;
  hint?: string;
  step?: number;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <input
        type="number"
        value={Number.isFinite(value) ? value : ""}
        step={step}
        onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
        className="w-24 rounded-lg border border-line px-2 py-1 text-sm"
      />
      {hint && <span className="text-xs text-slate-muted">{hint}</span>}
    </span>
  );
}

export function ConfigForm({
  config,
  defaults,
  slaRows,
}: {
  config: PlaceConfig;
  defaults: PlaceConfig;
  slaRows: SlaRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<PlaceConfig>(() => structuredClone(config));
  const [warnings, setWarnings] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  function setThreshold(k: keyof PlaceConfig["thresholds"], n: number) {
    setDraft((d) => ({ ...d, thresholds: { ...d.thresholds, [k]: n } }));
  }
  function setScoring(k: Exclude<keyof PlaceConfig["scoring"], "patternBase">, n: number) {
    setDraft((d) => ({ ...d, scoring: { ...d.scoring, [k]: n } }));
  }
  function setPatternBase(pattern: string, n: number) {
    setDraft((d) => ({ ...d, scoring: { ...d.scoring, patternBase: { ...d.scoring.patternBase, [pattern]: n } } }));
  }
  function setKpi(k: keyof PlaceConfig["kpi"], n: number) {
    setDraft((d) => ({ ...d, kpi: { ...d.kpi, [k]: n } }));
  }
  function setSla(key: string, n: number) {
    setDraft((d) => ({ ...d, pathwaySlaOverrides: { ...d.pathwaySlaOverrides, [key]: n } }));
  }
  function clearSla(key: string) {
    setDraft((d) => {
      const next = { ...d.pathwaySlaOverrides };
      delete next[key];
      return { ...d, pathwaySlaOverrides: next };
    });
  }

  function save() {
    setSaved(false);
    start(async () => {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      setWarnings(json.errors ?? []);
      if (json.config) setDraft(structuredClone(json.config));
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    });
  }

  function resetAll() {
    if (!confirm("Reset all place configuration to the built-in defaults?")) return;
    start(async () => {
      const res = await fetch("/api/config", { method: "DELETE" });
      const json = await res.json();
      setDraft(structuredClone(json.config ?? defaults));
      setWarnings([]);
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={pending}>
          {pending ? "Saving…" : saved ? "Saved — detection re-run" : "Save & re-run detection"}
        </button>
        <button className="btn-secondary" onClick={resetAll} disabled={pending}>
          Reset all to defaults
        </button>
      </div>

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-soft bg-amber-soft/50 p-3 text-sm text-ink">
          <p className="font-semibold">Some values were adjusted on save:</p>
          <ul className="mt-1 list-disc pl-5 text-slate">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* SLAs */}
      <section className="card p-4">
        <h2 className="text-sm font-bold text-ink">Pathway SLAs</h2>
        <p className="mt-1 text-xs text-slate-muted">
          Hours after the trigger event by which each step should be satisfied. Blank / default means the built-in
          value is used.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-muted">
                <th className="pb-2 pr-3 font-medium">Pathway</th>
                <th className="pb-2 pr-3 font-medium">Step</th>
                <th className="pb-2 pr-3 font-medium">Default</th>
                <th className="pb-2 font-medium">This place</th>
              </tr>
            </thead>
            <tbody>
              {slaRows.map((r) => {
                const current = draft.pathwaySlaOverrides[r.key];
                const overridden = current !== undefined;
                return (
                  <tr key={r.key} className="border-t border-line align-top">
                    <td className="py-2 pr-3 text-ink">{r.pathwayLabel}</td>
                    <td className="py-2 pr-3 text-slate">{r.stepDescription}</td>
                    <td className="py-2 pr-3 text-slate-muted">{r.defaultHours}h</td>
                    <td className="py-2">
                      <Num
                        value={overridden ? current : r.defaultHours}
                        onChange={(n) => setSla(r.key, n)}
                        step={1}
                      />
                      {overridden && (
                        <button
                          className="ml-2 text-xs font-semibold text-teal hover:underline"
                          onClick={() => clearSla(r.key)}
                        >
                          use default
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Thresholds */}
      <section className="card p-4">
        <h2 className="text-sm font-bold text-ink">Detection thresholds</h2>
        <ul className="mt-3 space-y-3">
          {(Object.keys(THRESHOLD_LABELS) as (keyof PlaceConfig["thresholds"])[]).map((k) => (
            <li key={k} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-ink">{THRESHOLD_LABELS[k]}</span>
              <Num
                value={draft.thresholds[k]}
                onChange={(n) => setThreshold(k, n)}
                hint={`default ${defaults.thresholds[k]}`}
              />
            </li>
          ))}
        </ul>
      </section>

      {/* Priority weights */}
      <section className="card p-4">
        <h2 className="text-sm font-bold text-ink">Priority score</h2>
        <p className="mt-1 text-xs text-slate-muted">
          The base points for each failure type, plus the overdue rate and the severity cut-offs. Consequence factors
          (patient in a bed, someone already raised it, etc.) are fixed in this version.
        </p>
        <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {(Object.keys(draft.scoring.patternBase) as string[]).map((p) => (
            <div key={p} className="flex items-center justify-between gap-2">
              <span className="text-sm text-ink">{patternLabel(p)}</span>
              <Num
                value={draft.scoring.patternBase[p as keyof typeof draft.scoring.patternBase]}
                onChange={(n) => setPatternBase(p, n)}
                hint={`def ${defaults.scoring.patternBase[p as keyof typeof defaults.scoring.patternBase]}`}
              />
            </div>
          ))}
        </div>
        <ul className="mt-4 space-y-3 border-t border-line pt-4">
          {(Object.keys(SCORING_LABELS) as (keyof typeof SCORING_LABELS)[]).map((k) => (
            <li key={k} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-ink">{SCORING_LABELS[k]}</span>
              <Num value={draft.scoring[k]} onChange={(n) => setScoring(k, n)} hint={`default ${defaults.scoring[k]}`} />
            </li>
          ))}
        </ul>
      </section>

      {/* KPI */}
      <section className="card p-4">
        <h2 className="text-sm font-bold text-ink">KPI assumptions (estimates only)</h2>
        <ul className="mt-3 space-y-3">
          <li className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-ink">Coordinator hours saved per resolved item</span>
            <Num
              value={draft.kpi.coordinatorHoursPerResolvedItem}
              onChange={(n) => setKpi("coordinatorHoursPerResolvedItem", n)}
              step={0.1}
              hint={`default ${defaults.kpi.coordinatorHoursPerResolvedItem}`}
            />
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-ink">Share of overdue delay assumed avoided (0–1)</span>
            <Num
              value={draft.kpi.shareOfDelayAvoided}
              onChange={(n) => setKpi("shareOfDelayAvoided", n)}
              step={0.05}
              hint={`default ${defaults.kpi.shareOfDelayAvoided}`}
            />
          </li>
        </ul>
      </section>
    </div>
  );
}
