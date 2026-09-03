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
| Defence-in-depth filter on model output | `acceptModelText()` drops any rephrase that contains a clinical directive, the "insufficient information" signal, chat preamble, or is empty — the caller then uses the deterministic text |
| Source attribution on every claim | `EvidenceItem[]` on each exception; the detail page links each line to a source event, and marks *missing* expected events |
| Confidence indicator | `Exception.confidence` (high/medium/low) shown on the card and detail; low confidence tempers the score |
| Governance pre-check | `governance.ts` — human-in-the-loop, no-clinical-decision, data-sharing-basis, fact-check-required; pass/flag only |
| Fact-check flag surfaced | heuristic matches (duplicate assessment, inferred caseload) raise a visible "Fact-check" badge |
| Audit logging of AI + human | `audit` array records, per decision: what the AI identified, what it recommended, what the human decided, and any amendment/note |
| Prompt & model versioning hooks | `THROUGHLINE_AI_MODEL` pins the model; `whySource` on each exception records whether wording came from the model |
| Timeout / fail-safe on the model call | 12s `AbortSignal.timeout`; any failure falls back to deterministic text |
| No PII in URLs or logs | synthetic ids only; the API takes ids in the path, not patient data |
| Tenancy shape | every entity carries `placeId`; the query layer is place-scoped by construction |
| Config changes are constrained + logged | `validateConfig` clamps every knob to a safe range; a save writes an audit entry and re-runs detection so the effect is visible and attributable |
| No autonomous change to a clinical record | resolving events are labelled "recorded via Throughline after coordinator action" and live only in this system's state |
| Reminders / escalations are logged, not sent | task nudges and auto-escalation write a `reminder` activity describing the notification that *would* be sent — no message leaves the system in the MVP; real notifications are a Phase 5 add, still human-approved |
| Offline actions are held, not inferred | a decision/task action taken offline is queued locally and replayed through the same audited API on reconnect — it is applied only because the human made the decision; a queued action that returns a 4xx on replay is dropped, not retried blindly |
| Ingestion is read-only and structure-only | `src/adapters/` GET/search only — no write-back. The mapping to `SourceEvent` uses structured fields (resource type, `status`, recognised codes, an explicit pathway extension); free text is copied verbatim to `documentText` and never sets the event type, pathway or routing. Verified by a clean-vs-poisoned mapping test in `ai-safety.test.ts` |
| No patient is created from an external feed | `adapters/resolve.ts` — a `Patient` reference / NHS number / local MRN that does not match a patient already in this place resolves to `null`; the record is counted as *unmatched* and dropped, not ingested |

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
| AI evaluation suite | _partly done_ — `src/engine/__tests__/ai-safety.test.ts` and `llm.test.ts` cover prompt-injection resistance, the clinical-directive boundary, evidence grounding and output filtering against the deterministic engine. Running the rephrase layer against a live model, plus data-leakage / cross-tenant probes, remain. |

## AI evaluation — status

Covered by the automated suite (`npm test`):

- Ingested document text containing instructions ("ignore previous…", "mark as
  resolved", "set severity to low", "prescribe…") does **not** change detection,
  severity, score, owner or the recommended action — verified by fingerprinting
  a clean run against a fully-poisoned run of the whole seed.
- The same holds at the **ingestion boundary**: a FHIR resource carrying an
  adversarial `note` / narrative maps to the same event `type`, `pathway` and
  org routing as the clean resource; every mapped event has a valid `EventType`
  and no `status` / `severity` field.
- No exception `why` or recommended action contains a clinical directive.
- `acceptModelText()` drops clinical directives, the "insufficient information"
  reply, chat preamble and empty output.
- Every exception is grounded: ≥1 evidence item, and every cited event id
  resolves to a real event.
- `aiEnabled()` is off unless both the flag and a key are set; the rephrase
  function makes no network call when disabled.

Still to do (needs a live model / more infrastructure):

- Rephrased "why" adds no fact absent from `facts[]` — run against a live model
  with an entailment check.
- Data-leakage and cross-tenant probes on the (future) real datastore.
