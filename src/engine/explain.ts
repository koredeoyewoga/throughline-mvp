/**
 * Explanation + drafting.
 * Deterministic by default: a template per failure pattern produces the plain
 * "why" and the recommended next step from the extracted facts. If the optional
 * AI layer is enabled it only *rephrases* the "why" — it never changes the
 * action, the severity or the evidence, and it must fall back to the
 * deterministic text if it cannot explain from the given facts.
 */
import type { Exception } from "@/domain/types";
import type { Candidate } from "./coordinationAgent";
import { patientName } from "@/data/patients";
import { rephraseExplanation } from "./llm";

function days(hours: unknown): number {
  return Math.round((typeof hours === "number" ? hours : 0) / 24);
}

interface Explanation {
  why: string;
  recommendedAction: string;
  facts: string[];
}

function build(candidate: Candidate): Explanation {
  const name = patientName(candidate.patientId);
  const s = candidate.signals;
  const owner = candidate.owner.label;

  switch (candidate.pattern) {
    case "referral_unactioned": {
      const overdue = days(s.overdueHours);
      const bed = s.stillInBed ? " while the patient continues to occupy an acute bed" : "";
      return {
        why: `${name}'s community rehab referral was submitted ${days(s.dischargeReadyAgeHours)} day(s) ago and has still not been accepted by the community provider — ${overdue} day(s) past the point it should have been picked up${bed}. ${s.hasWardEscalation ? "The ward has already flagged it." : ""}`.trim(),
        recommendedAction: `Escalate the referral to ${owner} intake for same-day triage, and notify the discharge hub and ward so the bed plan reflects the delay.`,
        facts: [
          `Referral submitted ${days(s.dischargeReadyAgeHours)} day(s) ago; no acceptance recorded.`,
          `${overdue} day(s) past the expected acceptance point.`,
          s.stillInBed ? "Patient is still admitted (no community visit recorded)." : "Patient discharge status unclear.",
          s.hasWardEscalation ? "Ward has raised a status note about the delay." : "No ward escalation recorded.",
        ],
      };
    }
    case "discharge_task_dropped": {
      const overdue = days(s.overdueHours);
      const cond = s.hasConditional ? ` The summary also has a conditional step: "${s.conditional}".` : "";
      return {
        why: `A district-nursing task from ${name}'s discharge summary — ${s.timeframeHours ? `due within ${s.timeframeHours}h` : "due shortly"} — has not been picked up, booked or completed. It is ${overdue} day(s) past the expected pick-up${s.clinicalWindowBreached ? ", and the clinical timeframe in the summary has now passed" : ""}.${cond}`,
        recommendedAction: `Send the task directly to ${owner} for booking within 24 hours, with the discharge summary attached. Confirm back to the referrer once a visit is booked.`,
        facts: [
          `District-nursing task extracted from the discharge summary${s.timeframeHours ? ` (timeframe ${s.timeframeHours}h)` : ""}.`,
          `${overdue} day(s) past the expected pick-up; no booking or visit recorded.`,
          s.clinicalWindowBreached ? "The clinical timeframe in the summary has passed." : "Still within the clinical timeframe.",
          s.hasConditional ? `Conditional step present: ${s.conditional}` : "No conditional steps.",
        ],
      };
    }
    case "follow_up_missed": {
      const overdue = days(s.overdueHours);
      return {
        why: `${name} had MDT actions assigned after a neighbourhood-team assessment, but no follow-up contact, visit or check-in has taken place — ${overdue} day(s) past when it was due. ${s.hasCarerConcern ? "A carer or the practice has since raised a concern." : ""}`.trim(),
        recommendedAction: `Assign a named ${owner} worker to make contact this week, review whether the MDT actions were completed, and record the outcome against the assessment.`,
        facts: [
          "MDT actions were assigned after the assessment.",
          `No follow-up contact recorded; ${overdue} day(s) overdue.`,
          s.hasCarerConcern ? "A carer/practice concern has been raised in the interim." : "No external concern raised.",
        ],
      };
    }
    case "referral_ping_pong": {
      const loopDays = days(s.loopAgeHours);
      return {
        why: `${name}'s falls referral has been rejected ${s.rejectionCount} time(s) and still has no service that has accepted it — the loop has been open ${loopDays} day(s). ${s.recurrentFalls ? "The patient has recurrent falls and remains at risk while this is unresolved." : ""}`.trim(),
        recommendedAction: `Route through ${owner} to a single accountable service in one step (do not re-refer to a rejecting service). Agree the correct pathway with both services and book an assessment; close the loop back to the GP.`,
        facts: [
          `Referral rejected ${s.rejectionCount} time(s); no acceptance after the last rejection.`,
          `Loop open ${loopDays} day(s).`,
          s.recurrentFalls ? "Recurrent falls — ongoing injury risk." : "Falls frequency not flagged.",
          s.hasGpEscalation ? "GP has escalated in a status note." : "No GP escalation recorded.",
        ],
      };
    }
    case "duplicate_assessment": {
      return {
        why: `${name} appears to have had two "${s.domain}" assessments by different organisations within ${s.gapDays} day(s). If they cover the same ground this is duplicated effort for staff and the patient. ${s.hasPatientComplaint ? "The patient has said they have already been assessed." : ""}`.trim(),
        recommendedAction: `Ask ${owner} to compare the two assessments, keep the one that is current and complete, and cancel or merge the other. Record which assessment the care plan will run from.`,
        facts: [
          `Two assessments in the "${s.domain}" domain by different organisations.`,
          `${s.gapDays} day(s) apart.`,
          s.hasPatientComplaint ? "Patient reports being assessed twice for the same thing." : "No patient comment recorded.",
          "This is a heuristic match — confirm the assessments genuinely overlap before cancelling anything.",
        ],
      };
    }
    case "loop_not_closed": {
      const overdue = days(s.overdueHours);
      return {
        why: `${name}'s rehab referral was accepted and a first visit was booked, but the visit was never completed and has not been re-arranged — ${overdue} day(s) past the expected point.`,
        recommendedAction: `Ask ${owner} to re-book the first visit within 48 hours and confirm the date back to the patient and the discharge hub. Add a check that the visit actually takes place.`,
        facts: [
          "Referral accepted and first visit booked.",
          `Visit not completed and not re-arranged; ${overdue} day(s) overdue.`,
        ],
      };
    }
    case "dna_no_rebook": {
      const overdue = days(s.overdueHours);
      return {
        why: `${name} did not attend an outpatient appointment ${overdue + 5} day(s) ago and there has been no rebooking, contact attempt or decision to discharge since — ${overdue} day(s) past the expected point for follow-up.`,
        recommendedAction: `Ask ${owner} to check the clinical urgency with the requesting clinician, then contact the patient to rebook — or safely discharge with a note to the GP if follow-up is no longer needed.`,
        facts: [
          "Patient did not attend the outpatient appointment.",
          `${overdue} day(s) since the expected follow-up point; no rebooking or contact recorded.`,
        ],
      };
    }
    case "handover_gap": {
      return {
        why: `${name} was admitted to the acute trust ${days(s.admissionAgeHours)} day(s) ago and is on an active caseload elsewhere, but no handover, status note or care-plan share from that team to the ward is recorded.`,
        recommendedAction: `Ask ${owner} to send a brief handover to the admitting ward today — current care plan, risks, key contacts — and to flag the admission on their own system.`,
        facts: [
          `Acute admission ${days(s.admissionAgeHours)} day(s) ago.`,
          "Patient has a recent contact from another team (active caseload).",
          "No handover from that team to the ward after the admission.",
          "The caseload link is inferred — confirm it is current before relying on it.",
        ],
      };
    }
    case "cancellation_no_rebook": {
      const overdue = days(s.overdueHours);
      return {
        why: `${name}'s appointment was cancelled by the provider (${s.reason}) and no replacement has been offered — ${overdue} day(s) past the point a rebooking should have happened. The patient has heard nothing.`,
        recommendedAction: `Ask ${owner} to rebook ${name} within the original clinical timeframe and confirm the new date directly with the patient. Record the cancellation reason so repeat slippage is visible.`,
        facts: [
          `Appointment cancelled by the provider — reason: ${s.reason}.`,
          `${overdue} day(s) past the expected rebooking point; no new appointment and no contact recorded.`,
          "The gap was caused by the service, not the patient.",
        ],
      };
    }
    case "package_of_care_delay": {
      const overdue = days(s.overdueHours);
      const bed = s.stillInBed ? " while the patient waits in an acute bed" : "";
      return {
        why: `A home-care package for ${name} was requested ${overdue + 3} day(s) ago and has not started${bed} — ${overdue} day(s) past the expected start. No first call or package confirmation is recorded.`,
        recommendedAction: `Ask ${owner} to confirm brokerage status today, agree a start date, and put an interim visit in place if the package cannot start within 48 hours. Update the discharge hub.`,
        facts: [
          "A home-care package was requested from social care.",
          `${overdue} day(s) past the expected start; no start or first-call recorded.`,
          s.stillInBed ? "Patient is still in an acute bed pending the package." : "Patient is at home awaiting the package.",
        ],
      };
    }
    case "onward_referral_not_made": {
      const overdue = days(s.overdueHours);
      return {
        why: `A letter/summary for ${name} asked for an onward referral to ${s.target}, but no such referral has been made — ${overdue} day(s) past when it was expected. The instruction has not been picked up.`,
        recommendedAction: `Ask ${owner} to make the referral to ${s.target} now, using the original letter as the clinical justification, and to confirm back that it has been sent.`,
        facts: [
          `An onward referral to ${s.target} was requested in a letter/summary.`,
          `${overdue} day(s) past the expected point; no matching referral recorded.`,
        ],
      };
    }
    case "virtual_ward_step_down_stalled": {
      const overdue = days(s.overdueHours);
      return {
        why: `${name} was flagged clinically ready to leave the virtual ward ${overdue + 2} day(s) ago, but no discharge from the virtual ward and no handback to primary care has been recorded — ${overdue} day(s) past the expected step-down. The virtual-ward place stays blocked.`,
        recommendedAction: `Ask ${owner} to complete the virtual-ward discharge and send the handback to the GP within 24 hours, then release the place for the next patient.`,
        facts: [
          "Patient flagged clinically ready to step down from the virtual ward.",
          `${overdue} day(s) past the expected step-down; no discharge or GP handback recorded.`,
          "The virtual-ward capacity is blocked while this is open.",
        ],
      };
    }
    default:
      return { why: "A coordination step is overdue.", recommendedAction: "Review and assign an owner.", facts: [] };
  }
}

export async function explain(candidate: Candidate): Promise<{
  why: string;
  recommendedAction: string;
  whySource: Exception["whySource"];
}> {
  const base = build(candidate);
  const rephrased = await rephraseExplanation({
    pattern: candidate.pattern,
    deterministicWhy: base.why,
    facts: base.facts,
    recommendedAction: base.recommendedAction,
  });
  return {
    why: rephrased ?? base.why,
    recommendedAction: base.recommendedAction,
    whySource: rephrased ? "model+deterministic" : "deterministic",
  };
}
