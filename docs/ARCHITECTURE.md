# Architecture

## The five layers (as in the discovery report)

| Layer | In this MVP |
|---|---|
| **Data** | `src/data/*` synthetic events + `src/engine/dataIntelligence.ts` (entity resolution, pathway-state model). Real feeds arrive here via adapters (below). |
| **Intelligence** | `src/engine/{coordinationAgent,documentAgent,prioritisation,explain}.ts` — deterministic detection, extraction, scoring and drafting. `llm.ts` is the optional model seam. |
| **Orchestration** | `src/store/db.ts` `recordDecision()` — task lifecycle, resolving-event injection, re-detection, audit. |
| **Human oversight** | `src/components/DecisionPanel.tsx` + `run.ts` reconciliation — every material action is approve / amend / reject / escalate, and the prior decision is always preserved. |
| **Assurance** | append-only `audit` array, governance checks per item, role stub, "synthetic data" banner, no autonomous sends. |

## The pipeline

```
SourceEvent[]  ──►  buildPathwayStates()   ──►  detect()            ──►  score()
(ingested)          expected next-steps         12 failure detectors     itemised 0–100
                    + SLAs + overdue            → Candidate[]

               ──►  explain()             ──►  checkAction()        ──►  runDetection() reconcile
                    why + recommended           governance flags         preserve human decisions,
                    action (± model rephrase)                            auto-close resolved items
```

`runDetection()` is idempotent and safe to re-run: it keys exceptions by
`patientId:pattern`, carries forward `id / status / decisions / createdAt`, and
auto-closes any previously-open exception whose candidate has disappeared
(because the source data moved on).

## Multi-agent mapping

| Discovery-report agent | Module | Permissions in the MVP |
|---|---|---|
| Data Intelligence Agent | `dataIntelligence.ts` | read-only over the ingested event set |
| Document Agent | `documentAgent.ts` | text extraction only; low-confidence output is flagged for confirmation |
| Coordination Agent | `coordinationAgent.ts` | emits candidates; cannot create tasks or send |
| Prioritisation Agent | `prioritisation.ts` | deterministic scoring; no model in the ranking path |
| Governance Agent | `governance.ts` | pass/flag only; never rewrites or blocks |
| Insight Agent | `kpis.ts` | aggregate/cohort views; no per-item actions |
| Explanation (optional model) | `llm.ts` | given only extracted facts; rephrases the "why"; cannot change action/severity/evidence |

## Integration seam (Phase 8)

The MVP ingests a synthetic `SourceEvent[]`. A real deployment adds adapters
that normalise each source into the same `SourceEvent` shape:

```
NHS system ──► adapter ──► normalise to SourceEvent (FHIR UK Core aligned) ──► engine
```

Targets: HL7 **FHIR UK Core**, **e-RS** referral APIs, **Transfer of Care /
IEC** discharge documents, **PDS/Spine** for identity, **CIS2 / NHS login** for
auth. `EventType` and `SourceEvent` already carry the fields these map onto
(patient identity, from/to organisation, pathway, timestamp, document text).

## Persistence seam (post-MVP)

`src/store/db.ts` is the only module that touches storage. It exposes
repository functions (`getState`, `listExceptions`, `recordDecision`, …) over a
JSON file. Replacing it with PostgreSQL/Prisma is a change contained to that
file; nothing else imports `fs`.

## Why these choices

- **Deterministic core.** Detection, scoring and the recommended action are
  rules over a state model, so they are inspectable, testable and stable. The
  model is optional polish on the wording only.
- **One process.** Next.js App Router serves the UI and the API. No queue, no
  microservices in the MVP — the discovery report's "avoid unnecessary
  complexity" applies here.
- **Node runtime everywhere.** Server code reads/writes a file; no Edge.
- **`turbopack.root` / `outputFileTracingRoot` pinned** in `next.config.mjs`
  (canonicalised to the true on-disk casing) because the project lives under a
  home directory that contains an unrelated `package.json`.
