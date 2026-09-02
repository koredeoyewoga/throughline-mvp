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

Tests (Vitest — engine unit tests + a full-pipeline integration test on the seed):

```bash
npm test
```

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

### The closed loop

Approving an action records the decision **and** simulates the resolving update
flowing back from the owning team, so detection re-runs and the item closes —
`data → AI identifies → explains → recommends → human reviews → workflow
executes → outcome recorded → impact measured`.

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
