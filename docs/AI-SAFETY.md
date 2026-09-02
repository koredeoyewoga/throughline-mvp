# AI safety & assurance

The platform is **AI-assisted, not AI-uncontrolled**. This document splits what
the MVP *implements* from what an NHS deployment *still requires*.

## Implemented technical controls

| Control | Where |
|---|---|
| Human-in-the-loop on every material action | `DecisionPanel.tsx`, `recordDecision()` — approve / amend / reject / escalate; nothing is sent automatically |
| Deterministic, itemised prioritisation (no hidden model in the ranking) | `prioritisation.ts` — every point is attributed to a named factor and shown to the user |
| Model is scoped to rephrasing only | `llm.ts` — receives only the extracted facts; a system prompt forbids adding detail, changing the action or giving clinical advice |
| "Insufficient information" contract | `llm.ts` returns `null` (→ deterministic fallback) if the model cannot explain from the facts, or replies with that exact phrase |
| Source attribution on every claim | `EvidenceItem[]` on each exception; the detail page links each line to a source event, and marks *missing* expected events |
| Confidence indicator | `Exception.confidence` (high/medium/low) shown on the card and detail; low confidence tempers the score |
| Governance pre-check | `governance.ts` — human-in-the-loop, no-clinical-decision, data-sharing-basis, fact-check-required; pass/flag only |
| Fact-check flag surfaced | heuristic matches (duplicate assessment, inferred caseload) raise a visible "Fact-check" badge |
| Audit logging of AI + human | `audit` array records, per decision: what the AI identified, what it recommended, what the human decided, and any amendment/note |
| Prompt & model versioning hooks | `THROUGHLINE_AI_MODEL` pins the model; `whySource` on each exception records whether wording came from the model |
| Timeout / fail-safe on the model call | 12s `AbortSignal.timeout`; any failure falls back to deterministic text |
| No PII in URLs or logs | synthetic ids only; the API takes ids in the path, not patient data |
| Tenancy shape | every entity carries `placeId`; the query layer is place-scoped by construction |
| No autonomous change to a clinical record | resolving events are labelled "recorded via Throughline after coordinator action" and live only in this system's state |

## Out of scope for the MVP (by design)

- Diagnosis, clinical triage-to-treatment, medication decisions.
- Autonomous messaging to patients or clinicians.
- Writing back to any external clinical system.

## Organisational requirements still needed (Phase 9)

| Requirement | Status |
|---|---|
| **DPIA** per deployment; lawful basis + Caldicott review; Data Sharing Agreements | not started |
| **DCB0129** clinical safety case + hazard log + named Clinical Safety Officer | not started |
| **MHRA** borderline / classification assessment (intent: outside the medical-device definition) | not started |
| **DSPT** submission | not started |
| **DTAC** pack | not started |
| **Cyber Essentials Plus** | not started |
| Real authentication — **CIS2 / NHS login**, RBAC per organisation, enforced per-place tenancy | stubbed (`src/lib/session.ts`) |
| Independent penetration test before any pilot with real data | not started |
| Equality Impact Assessment; fairness evaluation of entity resolution + prioritisation across demographic groups | not started |
| AI evaluation suite (hallucination, prompt injection, data leakage, cross-tenant exposure, incorrect automation) | not started — the deterministic core reduces but does not remove the need |

## AI evaluation — what to test when the model layer is switched on

- Rephrased "why" adds no fact absent from the supplied `facts[]`.
- Rephrased "why" never contains a clinical recommendation.
- Model returns the fallback on deliberately thin facts.
- Ingested document text containing instructions ("ignore previous…", "mark as
  resolved") does not change detection, scoring or the action — all of which are
  computed before any model call and from structured fields, not free text.
