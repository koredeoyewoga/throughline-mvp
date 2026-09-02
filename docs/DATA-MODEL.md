# Data model

All types in `src/domain/types.ts`.

## Reference data

- **Organisation** — `id`, `name`, `kind` (acute_trust · community_provider ·
  primary_care · mental_health · social_care · voluntary), `role`.
- **Team** — belongs to an org; `functionArea` is the inbox coordination work
  lands in (discharge_hub, district_nursing, neighbourhood_team, …).
- **Patient** — Throughline `id` (entity-resolved), synthetic `name` /
  `nhsNumber`, `sourceIds[]` (per-org local id + match confidence), `placeId`,
  `summary`, `flags[]`.
- **Place** — the neighbourhood / place footprint.

## Events — the ingested raw material

**SourceEvent**: `id`, `patientId`, `type`, `at` (ISO), `fromOrgId`,
`toOrgId?`, `pathway?`, `summary`, `data?`, `documentText?`.

`EventType`: referral_made · referral_acknowledged · referral_accepted ·
referral_rejected · assessment_completed · discharge_ready ·
discharge_summary_issued · task_expected · visit_booked · visit_completed ·
contact_attempt · appointment_scheduled · appointment_dna ·
appointment_cancelled · care_package_requested · care_package_started ·
virtual_ward_admission · virtual_ward_step_down_ready · virtual_ward_discharge ·
admission · readmission · status_note.

Real feeds map onto this shape via adapters (see ARCHITECTURE.md).

## Derived: pathway-state model

**PathwayDefinition** (`src/domain/pathways.ts`) — a `triggerEvent` and an
ordered list of **ExpectedStep** (`description`, `owningFunction`, `slaHours`,
`satisfiedBy: EventType[]`).

**PathwayState** — per (patient, pathway trigger): each step with `satisfied`,
`satisfiedByEventId?`, `dueAt`, `overdueHours`.

Pathways in the seed: `discharge:frailty`, `discharge:district_nursing`,
`falls`, `neighbourhood:complex`, `outpatient`, `discharge:social_care`,
`virtual_ward`. (`cancellation_no_rebook` and `onward_referral_not_made` are
detected directly from events rather than a pathway definition.)

## Derived: the coordination item

**Exception**: `id`, `patientId`, `placeId`, `pattern` (one of 12), `severity`,
`score` + `scoreBreakdown[]`, `title`, `why` + `whySource`, `evidence[]`
(**EvidenceItem** = event ref + label + detail + optional `quote`),
`recommendedAction`, `owner`, `confidence`, `status`, `createdAt` / `updatedAt`,
`decisions[]`, `governance[]`, `needsFactCheck`.

**Decision**: `kind` (approve · modify · reject · escalate · close), `actor`,
`at`, `note?`, `amendedAction?`.

**AuditEntry**: `at`, `actor`, `action`, `target`, `context?` — decision
entries carry `aiIdentified`, `aiRecommended`, `humanDecision`, `note`,
`amendedAction`.

## Persisted state

`AppState` = the `WorldSeed` (now, places, orgs, teams, patients, events) plus
`exceptions[]`, `audit[]`, `lastRunAt`. Written to `.data/state.json`.

## Data quality / validation notes

- Entity resolution is represented by `Patient.sourceIds[].confidence`; the
  detail page surfaces the lowest match confidence.
- `syntheticGap()` evidence items explicitly record the **absence** of an
  expected event (amber markers in the UI) rather than only positive evidence.
- `runDetection()` is the single writer of `exceptions`; it never mutates a
  closed/escalated item's human decisions.
