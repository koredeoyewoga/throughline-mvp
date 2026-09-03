# From this MVP to a pilot

This MVP covers Phase 3 (core MVP on synthetic data) and most of Phase 4
(intelligence layer) from the Product Discovery Report. What remains:

## Near term — harden the slice

- **Tests.** _Done:_ Vitest suite (113 tests) — all twelve detectors (fire /
  does-not-fire fixtures), the scorer, the config validator + overrides, the
  task engine + escalation ladder, the offline write-queue, the ingestion
  adapters (FHIR/e-RS/ToC mapping, entity resolution, paging, merge), a
  full-pipeline integration test on the seed, an **AI-safety suite**
  (prompt-injection resistance, no clinical directives in output, evidence
  grounding, model-output filtering, deterministic adapter mapping), and
  **Playwright** e2e (approve → task → done → close, worklist escalation,
  reject, offline sync). _Still to do:_ run the AI-eval suite against a live
  model when the rephrase layer is switched on; visual-regression on the queue.
- **More patterns.** _Done:_ cancellation not rebooked, package-of-care delay,
  onward referral after discharge not made, virtual-ward step-down not actioned.
- **Pathway config.** _Done:_ `PlaceConfig` (schema + validator in `src/config/`)
  holds pathway SLA overrides, detection thresholds, the priority weights and the
  KPI assumptions; the `/settings` screen edits them and re-runs detection;
  config persists to `.data/config.json` separately from the demo state.
  _Still to do:_ per-place config (multi-tenant), an approval trail on changes,
  and exposing the fixed consequence-factor weights.
- **Explanations.** Turn on the model layer behind the flag and run the eval
  suite; add per-agent model calls (Document Agent extraction from messier
  free text).
- **Accessibility + performance passes.** Axe run, keyboard walkthrough,
  Lighthouse; the UI is already semantic and keyboard-navigable but unaudited.

## Phase 5 — workflow depth

- _Done:_ real `Task` objects dispatched on approve, with an assignee, a task
  SLA, an escalation ladder (owning team → team lead → place / ICB) evaluated on
  read, an append-only activity log, and per-team grouping on `/worklist`.
  Marking a task done closes the source coordination failure. Task SLA and
  escalation timings are in `PlaceConfig`. `sweepTasks` is pure and unit-tested.
- _Still to do:_ per-function task SLAs (single value today); real notifications
  (email / NHS App messaging) in place of the logged "would send" reminders,
  still human-approved; a "my tasks" view once there is real auth; bulk actions.

## Phase 6–7 — web + PWA

- _Done:_ web app manifest + service worker (installable; read/shell caching in
  production), an offline **write-queue** — decisions and task actions taken
  offline are held in IndexedDB and replayed on reconnect via the same audited
  API — with an "Held N actions" indicator and auto-sync (`PwaProvider`),
  an `/offline` fallback, and a mobile-friendly nav (scrolls, wraps).
- _Still to do:_ verify SW read-caching in a real browser / add a Lighthouse PWA
  check to CI; a compact mobile "focus mode" for triage; background-sync so the
  replay survives the tab being closed.

## Phase 8 — integrations

- _Done:_ a read-only adapter layer (`src/adapters/`) that normalises an
  external source into the engine's `SourceEvent[]`. A **live FHIR R4** adapter
  (search + `Bundle.link[next]` paging, verified against the public HAPI test
  server), plus **e-RS** and **Transfer-of-Care** mappers that run over a
  captured test payload. `THROUGHLINE_SOURCE` selects the path;
  `POST /api/ingest` / the **Data source** card on `/settings` pull and re-run
  detection; merge is idempotent (de-dupe by event id); unresolved patients are
  reported, never invented.
- _Still to do:_ transport + credentials (smartcard / HSCN / API gateway) for a
  live e-RS and ToC feed; **PDS/Spine** identity and **CIS2 / NHS login** auth;
  a `_lastUpdated` incremental-sync cursor per source; then two real partner
  read-feeds under a DPIA + DSA.
- No writes to external clinical systems in the pilot.

## Phase 9 — assurance

- DPIA, DCB0129 + CSO, MHRA classification, DSPT, DTAC, Cyber Essentials Plus,
  penetration test, EIA. See `docs/AI-SAFETY.md`.

## Phase 12 — deployment

- PostgreSQL/Prisma behind the `store/db.ts` seam.
- UK-region managed cloud for the backend; managed platform (Vercel/Netlify)
  for the frontend; CI/CD with automated test + eval gates and a rollback path.
