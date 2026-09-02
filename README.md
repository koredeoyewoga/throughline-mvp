# Throughline Coordinate — MVP

**The operating intelligence layer for care coordination across organisational boundaries.**

This is the Phase 3–4 MVP from the Product Discovery Report: a working vertical
slice that ingests events from every organisation in a place, detects
coordination failures, explains them, drafts an action, and drives the
approve / amend / reject / escalate workflow with a full audit trail.

> **Synthetic data only.** Every patient, event and organisation is fictional
> (the "Meadowford" place). Nothing here is a real record and nothing is a
> medical device — the platform makes **no clinical decisions**.

---

## Run it

```bash
npm install
npm run dev
# open http://localhost:3000
```

No configuration is required. State is seeded from the synthetic dataset on
first load and persisted to `.data/state.json`. Use **Reset demo to seed** in
the UI (or `POST /api/reset`) to start over.

Production build:

```bash
npm run build && npm start
```

Tests:

```bash
npm test        # Vitest — engine units, pipeline integration, config, tasks, AI-safety (66)
npm run test:e2e   # Playwright — approve → task → done → close, worklist escalation, reject (3)
```

The AI-safety suite checks that adversarial free text in a referral or discharge
summary cannot change detection, severity, score or the recommended action
(everything is derived from structured fields before any model call), that no
explanation or action contains a clinical directive, and that the optional model
layer's output is filtered (clinical-directive / "insufficient information" /
preamble → fall back to the deterministic text).

Optional AI explanation layer (off by default — see `.env.example`):

```bash
THROUGHLINE_AI_EXPLANATIONS=on
ANTHROPIC_API_KEY=sk-ant-...
```

When enabled, a model only *rephrases* the deterministic explanation from the
already-extracted facts. It never changes severity, evidence or the recommended
action, and it must return "Insufficient information available." rather than
guess. With it off, everything still works.

---

## What it does

### The core screen — "What requires attention now?"

Every item in the queue answers six questions:

| | |
|---|---|
| **Priority** | a deterministic, fully itemised 0–100 score |
| **Why** | the coordination failure and its consequence, in plain language |
| **Evidence** | the exact source events (and missing events) the judgement rests on |
| **Action** | the pre-drafted next step |
| **Owner** | the team/organisation that should fix it |
| **Status** | open · in progress · escalated · closed |

Approving one dispatches a task to that owner on the **Worklist** (below).

### The twelve failure patterns it detects

| Pattern | Example in the seed |
|---|---|
| Referral not actioned | Ada Nkemelu — rehab referral never accepted, still in an acute bed |
| Discharge task dropped | George Fenwick — DN dressing task from the summary never picked up |
| Follow-up missed | Pauline Osei — no contact since the MDT assessment |
| Referral ping-pong | Derek Holloway — falls referral bounced twice, 19 days open |
| Duplicate assessment | Irene Baptiste — two reablement assessments, two organisations |
| Loop not closed | Samuel Adeyemi — visit booked, never completed |
| DNA, no rebooking | Margaret Cole — missed appointment, no follow-up |
| Handover gap | Tomasz Woźniak — acute admission, no handover from the CMHT |
| Cancellation, no rebooking | Clive Adepoju — clinic cancelled by the trust, never rebooked |
| Care package delay | Beatrice Sowande — home-care package requested, not started, in a bed |
| Onward referral not made | Harold Mensah — summary asked the GP to refer, 12 days, nothing |
| Virtual ward step-down stalled | Doreen Achebe — step-down ready, no discharge, place blocked |

Six other patients (Brian, Yvonne, Nasrin, Leonard, Kwame, Ruth) have
**healthy pathways** and correctly produce no exceptions.

### Worklist — driving the work

Approving (or amending) a recommendation **dispatches a tracked task** to the
owning team on `/worklist`. A task has its own SLA, an **assignee**, an
**escalation ladder** (owning team → team lead → place / ICB) that bumps
automatically once it is far enough past due, and an append-only activity log of
assignments, nudges, escalations and the reminder notifications that *would* be
sent. The worklist groups tasks by team, filters by status / "overdue only", and
has a dev "Advance clock 12h" control so SLA breaches and escalation can be shown
live.

### The closed loop

Marking a task **done** feeds the resolving update back to the source data, so
detection re-runs and the originating coordination failure closes —
`data → AI identifies → explains → recommends → human approves → task dispatched
→ team works it (assign / nudge / escalate) → task done → outcome recorded →
impact measured`.

### Impact

The `/kpis` page separates **measured** figures (from this system's own events)
from **estimated** ones (illustrative, with the assumption stated). Estimates
are never presented as outcomes.

### Settings — tuning it to a place

`/settings` exposes the operational knobs a place / ICB would adjust:

- **Pathway SLAs** — the hours allowed for each step of each pathway.
- **Detection thresholds** — how many rejections before "ping-pong" flags, the
  duplicate-assessment window, the handover look-back, etc.
- **Priority score** — the base weight for each failure type, the overdue
  rate/cap, and the HIGH / MEDIUM cut-offs.
- **KPI assumptions** — the two multipliers behind the estimated figures.
- **Task workflow & escalation** — the task SLA and the hours-past-due at which
  a task auto-escalates to a team lead, then to place / ICB.

Saving validates the input (out-of-range values are clamped and reported),
writes `.data/config.json`, and re-runs detection immediately. Tightening a
threshold auto-closes the items it no longer catches; loosening it again
reopens any that were *only* auto-closed. "Reset demo to seed" does not touch
config; there is a separate "Reset all to defaults" on the Settings screen.

---

## Architecture (MVP)

```
src/
  domain/        types + pathway definitions (defaults; SLAs are config-overridable)
  engine/tasks   task engine — dispatch, escalation ladder, activity log (pure)
  config/        PlaceConfig schema + validator, SLA/threshold/scoring overrides
  data/          synthetic world: organisations, patients, events, seed
  engine/
    dataIntelligence   entity resolution + pathway-state model
    documentAgent      task/timeframe extraction from referral & summary text
    coordinationAgent  the 12 failure detectors  (deterministic, config-driven thresholds)
    prioritisation     itemised, explainable scoring  (no hidden model; config-driven weights)
    governance         policy checks before a human sees the recommendation
    explain            deterministic "why" + action; optional model rephrase
    llm                optional Anthropic adapter (plain fetch, no SDK)
    kpis               measured vs estimated impact
    run                the pipeline + reconciliation with human decisions
  store/db       JSON-file persistence — the seam for a future Postgres/Prisma
  app/           Next.js App Router pages + JSON API routes
  components/    UI
```

Each engine module is named after an agent from the multi-agent architecture in
the discovery report. In the MVP they are deterministic; the `llm` seam is where
a scoped model call slots in per agent. No module has unrestricted data access.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind. Node.js
runtime for all server code. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## API

| Method | Route | |
|---|---|---|
| `GET` | `/api/exceptions` | all coordination items |
| `GET` | `/api/exceptions/:id` | one item |
| `POST` | `/api/exceptions/:id/decision` | `{ kind, note?, amendedAction? }` — kind ∈ approve/modify/reject/escalate/close |
| `POST` | `/api/refresh` | re-run detection, preserving decisions |
| `POST` | `/api/reset` | rebuild coordination state from the synthetic seed |
| `GET` | `/api/config` | current place config + defaults + SLA rows |
| `PUT` | `/api/config` | validate & save config, then re-run detection |
| `DELETE` | `/api/config` | reset config to built-in defaults, then re-run |
| `GET` | `/api/tasks` | dispatched tasks (`?function=` `?status=` filters) |
| `GET` | `/api/tasks/:id` | one task |
| `POST` | `/api/tasks/:id/action` | `{ kind, value?, note? }` — assign / status / nudge / escalate / note |
| `POST` | `/api/tasks/advance` | dev helper — pull the task clock back `{ hours }` |

---

## What this MVP is not (yet)

- Real integrations — see `docs/ARCHITECTURE.md` for the FHIR / e-RS / ToC
  adapter seam. The MVP uses a synthetic connector only.
- Real authentication — the role switch is an RBAC-shaped stub, not a security
  boundary.
- A datastore for scale — `store/db.ts` is a JSON file; swapping it is contained.
- Assured — DSPT, DTAC, DCB0129, DPIA and the MHRA classification are Phase 9
  work. `docs/AI-SAFETY.md` lists what is implemented vs still required.

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the path from here.
