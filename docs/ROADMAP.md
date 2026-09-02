# From this MVP to a pilot

This MVP covers Phase 3 (core MVP on synthetic data) and most of Phase 4
(intelligence layer) from the Product Discovery Report. What remains:

## Near term — harden the slice

- **Tests.** Unit tests for each detector (fixture events → expected candidate),
  the scorer (signals → score), and `runDetection()` reconciliation. Playwright
  for the approve → close loop. AI-eval suite per `docs/AI-SAFETY.md`.
- **Pathway config.** Move `PATHWAYS` out of code into a per-place config file
  (JSON) with a schema; add an editor screen for oversight users.
- **More patterns.** Cancellation not rebooked; package-of-care delay; onward
  referral after discharge not made; virtual-ward step-down not actioned.
- **Explanations.** Turn on the model layer behind the flag and run the eval
  suite; add per-agent model calls (Document Agent extraction from messier
  free text).
- **Accessibility + performance passes.** Axe run, keyboard walkthrough,
  Lighthouse; the UI is already semantic and keyboard-navigable but unaudited.

## Phase 5 — workflow depth

- Real task objects with assignment, reminders and escalation ladders (not just
  status transitions).
- SLA tracking per owner; a per-team worklist view.
- Notifications (email/NHS App messaging) — still human-approved.

## Phase 6–7 — web + PWA

- Installable PWA with an offline-tolerant queue for ward/community use.
- Dedicated mobile approval + handover flows.

## Phase 8 — integrations

- FHIR UK Core / e-RS / Transfer-of-Care adapters against test endpoints, then
  two real partner read-feeds under a DPIA + DSA.
- No writes to external clinical systems in the pilot.

## Phase 9 — assurance

- DPIA, DCB0129 + CSO, MHRA classification, DSPT, DTAC, Cyber Essentials Plus,
  penetration test, EIA. See `docs/AI-SAFETY.md`.

## Phase 12 — deployment

- PostgreSQL/Prisma behind the `store/db.ts` seam.
- UK-region managed cloud for the backend; managed platform (Vercel/Netlify)
  for the frontend; CI/CD with automated test + eval gates and a rollback path.
