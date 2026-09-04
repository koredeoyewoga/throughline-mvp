# Throughline Coordinate — Product Transformation Brief

This is Phase Zero through Six of the transformation brief: a forensic audit of
what is actually built (not what the UI merely implies), a gap analysis against
the target vision, a target architecture, the domain model change, and a
phased roadmap. Phase Seven (implementation) proceeds in small verified slices
after this document — the first slice is described at the end and is already
merged.

Live demo: https://fascinating-buttercream-a86eb0.netlify.app (git-connected,
redeploys on every push to `main`).

---

## Phase Zero — Current State Audit

Verified by reading the source, not by reading the UI. "Works" means: enforced
server-side, covered by an automated test, and manually verified in the
browser (local + the Netlify deployment) this session.

| Feature | Exists | Works | Simulated | Persistent | Secure | Verdict |
|---|---|---|---|---|---|---|
| Authentication (session) | Yes | Yes | Identity provider is a demo picker, not an IdP | Yes (signed cookie) | Yes — HMAC-SHA256, Web Crypto, `middleware.ts` gates every route | **Keep** |
| RBAC | Yes | Yes | No | Yes (server-side matrix) | Yes — `authorize()` returns 403, tested | **Keep** |
| Tenancy isolation | Yes | Yes | Seed has 1 real + 1 empty place, so cross-tenant *emptiness* is demonstrated, not cross-tenant *data leakage under load* | Yes | Yes — `inPlace`/`visibleInPlace`/`writableInPlace`, unit-tested | **Keep, extend seed** |
| Data persistence | Yes | Partially | No | **No** — JSON file locally, `/tmp` on Netlify (ephemeral per instance) | N/A | **Rebuild** (Phase 1) |
| Coordination detection ("what requires attention") | Yes | Yes | No — deterministic rules over structured events | Yes | Yes | **Keep** |
| Explanation ("why does this matter") | Yes | Yes | No — template-driven from evidence, optional model rephrase (off by default) | Yes | Yes | **Keep** |
| Priority engine | Yes | Yes | No — itemised, every point attributed | Yes | Yes | **Keep** |
| Ownership | Yes | Yes | No — `ownerStatus()` is computed from real handoff records against the wall clock | Yes | N/A | **Done this phase.** `Exception.owner`/`Task.owner` still always resolve (that's correct — the owning *team* is never ambiguous); what was missing and is now built is per-task ownership *confirmation*: unacknowledged past a window ⇒ "Owner unknown" |
| Task / action assignment | Yes | Yes | No | Yes | Yes | **Keep, rename concept** |
| Handoff | Yes | Yes | No | Yes | Yes | **Done this phase.** `engine/handoffs.ts` + `Handoff` entity; a quick "assign to the team inbox" still exists separately (no confirmation needed for that case) |
| Blocker | Yes | Yes | No — person-reported by construction, never inferred | Yes | Yes | **Done this phase.** `engine/blockers.ts` + `Blocker` entity, `/blockers`, reportable from any exception or task |
| Escalation | Yes | Yes | No — SLA-driven ladder (owning team → team lead → place/ICB), evaluated on every read | Yes | Yes | **Keep** |
| Follow-up / resolution loop | Yes | Yes | No — marking a task done injects a resolving event and re-runs detection | Yes | Yes | **Keep** |
| Impact / KPIs | Yes | Yes | Partially — measured KPIs are real counts; estimated KPIs are clearly labelled and use configurable multipliers | Yes | N/A | **Keep** |
| Ingestion adapters (FHIR / e-RS / ToC) | Yes | Yes (FHIR verified live against a public test server) | e-RS/ToC need a captured payload file, not a live connection | Yes (merged into the event log) | Yes — read-only, structure-only mapping | **Keep** |
| Admin control centre | No | — | — | — | — | **Gap — build.** There are exactly 3 hard-coded demo identities in `lib/auth/users.ts`. No invite flow, no reviewer codes, no demo-access-code generation/revocation, no user management UI |
| Audit log | Yes | Yes | No | Same store as everything else | Yes | **Keep** |
| AI natural-language assistant | No | — | — | — | — | **Gap — deferred.** Not started |
| Notifications (email / Teams) | No | — | — | — | — | **Gap — deferred.** Reminders are logged as an activity entry describing what *would* be sent; nothing is actually sent |
| PWA / offline | Yes | Yes | No | Offline actions queue in IndexedDB, replay through the same audited API | Yes | **Keep** |
| Mobile | Yes | Partial | Responsive, not a bespoke mobile IA | — | — | **Improve later** |
| Accessibility | Partial | Untested | — | — | — | **Gap — audit needed** |
| Automated tests | Yes | Yes | — | — | — | 140 vitest + 10 Playwright, including RBAC-403, tenancy-scoping, blocker and handoff-acknowledgement tests, green in CI-equivalent runs |

### What is genuinely functional (server-enforced, tested)
Session auth, RBAC, tenancy scoping, the detection→explain→prioritise→govern
pipeline, the task/escalation engine, the offline write-queue, the FHIR
ingestion adapter (live-verified), the audit log.

### What is UI-only or simulated
Nothing material is UI-only today — the previous "role switch is not a
security boundary" state (pre this session) has been replaced. The remaining
simulation is honestly labelled: reminders/notifications are logged, not sent;
the AI explanation layer is off by default and, when on, only rephrases
facts the deterministic engine already extracted.

### What must be rebuilt
Persistence (JSON file → real database) and the identity/access model (3
hard-coded demo users → an admin-managed invite and access-code system). Both
are called out explicitly below.

---

## Gap Analysis vs. the target vision

| Target concept | Closest existing concept | Gap |
|---|---|---|
| Workflow Engine with configurable states (Detected → Triaged → Action Required → Assigned → In Progress → Blocked → Awaiting External Action → Escalated → Resolved → Closed) | `Exception.status` (open/in_progress/escalated/closed) + `Task.status` (open/in_progress/blocked/done/cancelled) | The two-entity split (exception + task) already captures most of the target's finer states once mapped (see below); genuinely missing is **Blocked** as an exception-level status distinct from "in progress with a blocker attached" |
| Ownership Engine incl. "Owner Unknown" | Every candidate always resolves an `owner` from the pathway config | No ambiguity representation. **Built this phase.** |
| Blocker system | Implicit in `why` text and evidence | No first-class entity. **Built this phase.** |
| Handoff with acknowledgement | `TaskActivity` kind `"assigned"` (fire-and-forget) | No acknowledgement step, no previous/new owner pair as a queryable record. **Built this phase.** |
| Admin Control Centre (users, roles, orgs, places, teams, reviewers, demo codes) | None | Full gap — Phase 1 continuation, requires a real user table |
| Three access methods (accounts, reviewer invites, demo codes) | One (demo picker) | Full gap — depends on Admin Control Centre |
| PostgreSQL persistence | JSON file / `/tmp` | Full gap — Phase 1 priority #1 |
| AI natural-language assistant | None | Deferred to Phase 2 — needs the DB migration first so it has something durable to query |
| Notifications (email/Teams) | Logged only | Deferred to Phase 2 — needs an email provider decision |
| Renamed navigation (Today/Workflows/Coordinate/Blockers/Tasks/Insights/Activity/Admin) | Attention queue/Worklist/Impact/Audit/Settings | Cosmetic; sequenced after the domain model changes so labels match reality |
| NHS FHIR UK Core / e-RS live integration | FHIR read adapter verified against a public test server; e-RS/ToC are payload-file mappers | Partial — live e-RS/ToC needs HSCN transport + credentials that don't exist in this environment |

---

## Target Architecture

Kept as-is (already correct for this stage, and rebuilding it would be
motion without progress):

- **Frontend/Backend:** Next.js 15 App Router + TypeScript, one process. RSC
  for reads, typed API routes for writes. This is the right shape for the
  current scale; a separate backend service is not justified yet.
- **Auth:** the signed-session + middleware-gate architecture built this
  session. It is not OIDC yet, but the *enforcement* seam (`lib/rbac.ts`,
  `lib/tenancy.ts`, `middleware.ts`) is exactly what a real IdP plugs into —
  swapping the identity provider is contained to `lib/auth/`.
- **Deployment:** Netlify, git-connected. Confirmed working end-to-end.

Changing now:

- **Persistence: PostgreSQL.** The single highest-leverage structural change.
  `src/store/db.ts` is already the only module that touches storage — every
  other module calls its exported functions, never `fs` directly. That seam is
  what makes this change contained rather than a rewrite. Recommended host:
  **Supabase** (managed Postgres, a generous free tier, and this session
  already has a Supabase MCP connection available to provision it) or
  **Netlify DB** if staying single-vendor is preferred. Either is a `db.ts`
  rewrite behind the same function signatures — nothing above the store layer
  changes.
- **Admin identity:** once there is a real `users` table, replace the 3
  hard-coded demo identities with actual rows, an `invites` table (email,
  role, place, expiry, revoked-at), and a `demo_access_codes` table (code,
  expiry, max-uses, revoked-at, use-count). The session/RBAC/tenancy layers
  need no change — they already key off `{sub, role, placeId, orgId}`, which
  now comes from a DB row instead of a constant.

---

## Domain Model — additions this phase, and the map for what's next

Added this phase (see `src/domain/types.ts`):

```
Blocker
  id, exceptionId?, taskId?, placeId
  title, category, description
  owner { functionArea, orgId, label }
  status: open | awaiting_response | resolved
  createdAt, createdBy, resolvedAt?, resolvedBy?, resolutionNote?
  externalDependency?: string   // named org/team outside the immediate team, if relevant

Handoff
  id, taskId, placeId
  fromOwner: string | null      // null = was unassigned ("Owner Unknown")
  toOwner: string
  reason: string
  at, by
  acknowledgedAt?, acknowledgedBy?
```

`Task.assignee` becomes derived from the latest acknowledged `Handoff` where
one exists, rather than a bare string field mutated in place — the history is
now a first-class, queryable record instead of an activity-log line of text.

An exception/task with no confident owner surfaces as `ownerStatus:
"unknown"` and is itself scored as a coordination risk (see
`engine/ownership.ts`) — this is the "Owner Unknown" state from the brief.

Full future domain model (Phase 1 continuation, once on Postgres):

```
Organisation, Place, Team, User, Role
Workflow (renames/wraps today's Exception)
WorkItem (renames/wraps today's Task)
Blocker, Handoff        — added this phase
Dependency, Escalation  — Dependency ⊂ Blocker.externalDependency today;
                           promote to its own table when a workflow can
                           legitimately have more than one open dependency
Notification            — Phase 2, once an email provider is chosen
AIInteraction            — Phase 2, once the assistant exists
AuditEvent               — exists today (`AuditEntry`)
```

---

## Roadmap

**Phase 1 — Working demonstrator (in progress).**
Done: auth, RBAC, tenancy, detection/explain/prioritise/govern, tasks,
escalation, audit log, ingestion adapters, PWA. **This slice:** Blocker
entity, Handoff-with-acknowledgement, Owner Unknown detection.
**Next slices, in priority order:** (1) PostgreSQL migration — unblocks
everything else being genuinely durable; (2) Admin Control Centre + real user
accounts + reviewer invites + demo access codes, replacing the public
demo-picker login; (3) rename the domain vocabulary in the UI
(Workflow/Work Item) once it stops being misleading to do so.

**Phase 2 — Pilot-ready platform.** Configurable escalation rules per place
(today's are global config, not yet per-rule-per-workflow-category);
notifications (email, then Teams); the natural-language AI assistant over the
now-durable data; accessibility audit (Axe + keyboard walkthrough) and a
Lighthouse pass; benefits/impact measurement hardened with real baselines.

**Phase 3 — Enterprise/NHS-ready pathway.** DPIA, DCB0129 + Clinical Safety
Officer, MHRA borderline classification, DSPT, DTAC, Cyber Essentials Plus,
penetration test, EIA — see `docs/AI-SAFETY.md`, which already tracks this
list and what's implemented vs. required. CIS2/NHS login replacing the demo
identity provider (the seam is ready — `lib/auth/oidc.ts`). Live e-RS/ToC
transport once HSCN access exists.

---

## What this phase deliberately does not touch, and why

- **No Postgres migration yet.** It's the right next move, but it's a large,
  separately-verifiable change (every read/write path, plus test/e2e
  fixtures) and shouldn't be bundled with a domain-model change in the same
  diff — if something regresses, it should be obvious which change caused it.
- **No Admin Control Centre / invite system yet.** It depends on the user
  table that Postgres brings; building it against the JSON store would mean
  rebuilding it again immediately after.
- **No navigation rename.** Renaming "Attention queue" to "Today" and
  "Worklist" to "Workflows" is cheap, but doing it before the underlying
  Blocker/Handoff concepts exist would just be a relabelling with nothing
  behind it. It's sequenced for once the vocabulary actually matches the data.
- **No AI assistant, no notifications.** Both need a decision only the
  product owner can make (which model/provider, which email service) and both
  are far more useful once they're querying/notifying about durable data.

None of this is a smaller ambition than the brief — it's the brief's own
instruction ("begin implementation in small verified phases") applied to
itself.
