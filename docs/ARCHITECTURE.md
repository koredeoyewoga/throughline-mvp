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

## Offline / PWA

`app/manifest.ts` serves the web app manifest; `public/sw.js` is a small
service worker (network-first navigations with a cached fallback then `/offline`,
cache-first for build assets, network-first for `/api` GETs). `PwaProvider`
(client, in the root layout) registers the SW **in production only**, tracks
`online`/`offline`, and drives the write-queue.

`src/lib/offline-queue.ts` is an IndexedDB queue (in-memory fallback for
SSR/tests) of `{url, method, body, label, at}`. `src/lib/submitAction.ts`
wraps a mutation POST: it always attempts the request (never trusting
`navigator.onLine`), and on failure — or a 5xx — writes the action to the queue
and fires `throughline:queued`. On the next `online` event `PwaProvider` calls
`drainPending`, which replays each queued action oldest-first through the normal
API (so it is validated and audited exactly as a live action), dropping only
4xx responses that cannot recover. `DecisionPanel` and `TaskActions` use
`submitAction`; both show a "held — will sync" note when queued.

## Task engine

`src/engine/tasks.ts` is pure. Approving a recommendation calls
`createTaskFromException` (in `store/db.ts`) which dispatches a `Task` to the
owning team and moves the exception to `in_progress`. `sweepTasks(tasks, now,
workflowConfig)` runs on every `refreshDetection` and after any task action /
clock advance — there is no scheduler — bumping overdue tasks up the escalation
ladder (0 owning team → 1 team lead → 2 place / ICB) and logging the reminder
notification that *would* be sent. `applyTaskAction` handles assign / status /
nudge / escalate / note and reports when a task just reached `done`; the store
then injects the resolving event and re-runs detection, closing the originating
coordination failure. Task SLA and escalation timings live in
`PlaceConfig.workflow`.

## Place configuration

`src/config/` holds a `PlaceConfig` — pathway SLA overrides
(`"<pathwayKey>/<stepKey>" -> hours`), detection thresholds, the priority
weights + severity cut-offs, and the KPI assumptions. `validateConfig` is pure
and total (clamps and reports rather than throwing); `getConfig()` reads
`.data/config.json` merged over `DEFAULT_CONFIG`. The engine reads config at the
top of `runDetection` and threads it into `buildPathwayStates` (via
`getPathways()`), `detect(...)`, `score(...)` and `computeKpis(...)`. `PATHWAYS`
and `DEFAULT_CONFIG` remain the untouched in-code defaults, so every test that
does not pass config explicitly runs against them. The `/settings` screen is the
editor; a save re-runs detection. In production this becomes per-place config
with an approval trail.

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
