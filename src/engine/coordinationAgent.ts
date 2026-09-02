/**
 * Coordination Agent (deterministic).
 * Detects coordination failures — stuck pathways and unclosed loops — by
 * comparing the pathway-state model against reality. Emits *candidates* only;
 * it cannot create tasks or send anything.
 */
import type {
  SourceEvent,
  Patient,
  PathwayState,
  FailurePattern,
  Severity,
  EvidenceItem,
  Team,
} from "@/domain/types";
import { orgName, TEAMS } from "@/data/world";
import { quoteForTask } from "./documentAgent";

const HOUR = 3600 * 1000;

export interface Candidate {
  key: string; // stable dedupe key: `${patientId}:${pattern}`
  patientId: string;
  placeId: string;
  pattern: FailurePattern;
  title: string;
  severityHint: Severity;
  confidence: "high" | "medium" | "low";
  owner: { functionArea: Team["functionArea"]; orgId: string; label: string };
  evidence: EvidenceItem[];
  /** Machine-readable signals used by prioritisation + explanation. */
  signals: Record<string, number | string | boolean>;
}

function teamLabel(fn: Team["functionArea"], orgId: string): string {
  const team = TEAMS.find((t) => t.functionArea === fn && t.orgId === orgId) ?? TEAMS.find((t) => t.functionArea === fn);
  return team ? `${team.name} · ${orgName(orgId)}` : `${fn} · ${orgName(orgId)}`;
}

function ev(e: SourceEvent, label: string, quote?: string): EvidenceItem {
  return { eventId: e.id, at: e.at, label, detail: e.summary, quote };
}

function daysBetween(aIso: string, bIso: string): number {
  return Math.abs(Date.parse(aIso) - Date.parse(bIso)) / (24 * HOUR);
}

interface Ctx {
  now: string;
  patientsById: Map<string, Patient>;
  events: SourceEvent[];
  eventsByPatient: Map<string, SourceEvent[]>;
  states: PathwayState[];
}

export function detect(
  patients: Patient[],
  events: SourceEvent[],
  states: PathwayState[],
  now: string,
): Candidate[] {
  const ctx: Ctx = {
    now,
    patientsById: new Map(patients.map((p) => [p.id, p])),
    events,
    eventsByPatient: groupBy(events, (e) => e.patientId),
    states,
  };

  const candidates: Candidate[] = [
    ...detectReferralUnactioned(ctx),
    ...detectDischargeTaskDropped(ctx),
    ...detectFollowUpMissed(ctx),
    ...detectReferralPingPong(ctx),
    ...detectDuplicateAssessment(ctx),
    ...detectLoopNotClosed(ctx),
    ...detectDnaNoRebook(ctx),
    ...detectHandoverGap(ctx),
  ];

  // One candidate per (patient, pattern): keep the strongest signal.
  const byKey = new Map<string, Candidate>();
  for (const c of candidates) {
    const existing = byKey.get(c.key);
    if (!existing) byKey.set(c.key, c);
  }
  return [...byKey.values()];
}

// ---------------------------------------------------------------- detectors

function detectReferralUnactioned(ctx: Ctx): Candidate[] {
  const out: Candidate[] = [];
  for (const st of ctx.states.filter((s) => s.pathway === "discharge:frailty")) {
    const made = st.steps.find((s) => s.step.key === "referral_to_community");
    const accepted = st.steps.find((s) => s.step.key === "referral_accepted");
    if (!made?.satisfied || !accepted || accepted.satisfied || accepted.overdueHours <= 0) continue;

    const patient = ctx.patientsById.get(st.patientId)!;
    const pe = ctx.eventsByPatient.get(st.patientId) ?? [];
    const referral = pe.find((e) => e.id === made.satisfiedByEventId)!;
    const ack = pe.find((e) => e.type === "referral_acknowledged" && e.pathway === "discharge:frailty");
    const dischargeReady = pe.find((e) => e.id === st.triggeredBy);
    const wardNote = [...pe].reverse().find((e) => e.type === "status_note" && e.fromOrgId === referral.fromOrgId);
    const admission = pe.find((e) => e.type === "admission");
    const stillInBed = Boolean(admission) && !pe.some((e) => e.type === "visit_completed");
    const dischargeReadyAgeHours = dischargeReady
      ? Math.round((Date.parse(ctx.now) - Date.parse(dischargeReady.at)) / HOUR)
      : 0;

    const evidence: EvidenceItem[] = [];
    if (dischargeReady) evidence.push(ev(dischargeReady, "Medically fit for discharge"));
    evidence.push(ev(referral, "Community referral submitted"));
    if (ack) evidence.push(ev(ack, "Referral received by community provider"));
    else evidence.push(syntheticGap(referral.at, "No acknowledgement or acceptance from the community provider"));
    if (wardNote) evidence.push(ev(wardNote, "Ward status note"));

    out.push({
      key: `${st.patientId}:referral_unactioned`,
      patientId: st.patientId,
      placeId: patient.placeId,
      pattern: "referral_unactioned",
      title: "Community referral accepted by no one — patient still in an acute bed",
      severityHint: stillInBed ? "high" : "medium",
      confidence: "high",
      owner: {
        functionArea: "therapies",
        orgId: referral.toOrgId ?? "org-mch",
        label: teamLabel("therapies", referral.toOrgId ?? "org-mch"),
      },
      evidence,
      signals: {
        overdueHours: accepted.overdueHours,
        stillInBed,
        dischargeReadyAgeHours,
        livesAlone: patient.flags.includes("lives alone"),
        hasWardEscalation: Boolean(wardNote),
      },
    });
  }
  return out;
}

function detectDischargeTaskDropped(ctx: Ctx): Candidate[] {
  const out: Candidate[] = [];
  for (const st of ctx.states.filter((s) => s.pathway === "discharge:district_nursing")) {
    const received = st.steps.find((s) => s.step.key === "dn_task_received");
    if (!received || received.satisfied || received.overdueHours <= 0) continue;

    const pe = ctx.eventsByPatient.get(st.patientId) ?? [];
    const task = pe.find((e) => e.type === "task_expected" && e.pathway === "discharge:district_nursing");
    if (!task) continue; // no extracted task -> nothing to chase

    const patient = ctx.patientsById.get(st.patientId)!;
    const summary = pe.find((e) => e.id === st.triggeredBy);
    const quote = quoteForTask(task, ctx.events);
    const timeframeHours = Number((task.data?.timeframeHours as number) ?? 0);
    const conditional = task.data?.conditional as string | undefined;
    const taskAgeHours = Math.round((Date.parse(ctx.now) - Date.parse(task.at)) / HOUR);
    const clinicalWindowBreached = timeframeHours > 0 && taskAgeHours > timeframeHours;

    const evidence: EvidenceItem[] = [];
    if (summary) evidence.push(ev(summary, "Discharge summary issued", quote));
    evidence.push(ev(task, "District-nursing task extracted from the summary", quote));
    evidence.push(syntheticGap(task.at, "No pick-up, booking or visit recorded by district nursing"));

    out.push({
      key: `${st.patientId}:discharge_task_dropped`,
      patientId: st.patientId,
      placeId: patient.placeId,
      pattern: "discharge_task_dropped",
      title: "District-nursing task from the discharge summary was never picked up",
      severityHint: clinicalWindowBreached ? "high" : "medium",
      confidence: "high",
      owner: {
        functionArea: "district_nursing",
        orgId: task.toOrgId ?? "org-mch",
        label: teamLabel("district_nursing", task.toOrgId ?? "org-mch"),
      },
      evidence,
      signals: {
        overdueHours: received.overdueHours,
        timeframeHours,
        clinicalWindowBreached,
        hasConditional: Boolean(conditional),
        conditional: conditional ?? "",
      },
    });
  }
  return out;
}

function detectFollowUpMissed(ctx: Ctx): Candidate[] {
  const out: Candidate[] = [];
  for (const st of ctx.states.filter((s) => s.pathway === "neighbourhood:complex")) {
    const assigned = st.steps.find((s) => s.step.key === "mdt_actions_assigned");
    const followUp = st.steps.find((s) => s.step.key === "follow_up_contact");
    if (!assigned?.satisfied || !followUp || followUp.satisfied || followUp.overdueHours <= 0) continue;

    const pe = ctx.eventsByPatient.get(st.patientId) ?? [];
    const assessment = pe.find((e) => e.id === st.triggeredBy);
    const actions = pe.find((e) => e.id === assigned.satisfiedByEventId);
    const carerNote = [...pe].reverse().find((e) => e.type === "status_note");
    const patient = ctx.patientsById.get(st.patientId)!;

    const evidence: EvidenceItem[] = [];
    if (assessment) evidence.push(ev(assessment, "MDT assessment completed"));
    if (actions) evidence.push(ev(actions, "MDT actions assigned"));
    evidence.push(syntheticGap(followUp.dueAt, "No follow-up contact, visit or check-in recorded"));
    if (carerNote) evidence.push(ev(carerNote, "Note from the practice / carer"));

    out.push({
      key: `${st.patientId}:follow_up_missed`,
      patientId: st.patientId,
      placeId: patient.placeId,
      pattern: "follow_up_missed",
      title: "Complex-case follow-up has not happened since the MDT assessment",
      severityHint: carerNote ? "medium" : "low",
      confidence: "high",
      owner: {
        functionArea: "neighbourhood_team",
        orgId: assessment?.fromOrgId ?? "org-mch",
        label: teamLabel("neighbourhood_team", assessment?.fromOrgId ?? "org-mch"),
      },
      evidence,
      signals: {
        overdueHours: followUp.overdueHours,
        hasCarerConcern: Boolean(carerNote),
        vulnerable: patient.flags.includes("carer strain") || patient.flags.includes("MCI"),
      },
    });
  }
  return out;
}

function detectReferralPingPong(ctx: Ctx): Candidate[] {
  const out: Candidate[] = [];
  for (const [patientId, pe] of ctx.eventsByPatient) {
    const falls = pe.filter((e) => e.pathway === "falls").sort((a, b) => a.at.localeCompare(b.at));
    const rejections = falls.filter((e) => e.type === "referral_rejected");
    const accepts = falls.filter((e) => e.type === "referral_accepted");
    const firstReferral = falls.find((e) => e.type === "referral_made");
    if (rejections.length < 2 || !firstReferral) continue;
    const lastRejection = rejections[rejections.length - 1];
    const acceptedAfter = accepts.some((a) => Date.parse(a.at) > Date.parse(lastRejection.at));
    if (acceptedAfter) continue;

    const patient = ctx.patientsById.get(patientId)!;
    const loopAgeHours = Math.round((Date.parse(ctx.now) - Date.parse(firstReferral.at)) / HOUR);
    const gpNote = [...pe].reverse().find((e) => e.type === "status_note");

    const evidence: EvidenceItem[] = [];
    for (const f of falls) {
      if (f.type === "referral_made") evidence.push(ev(f, "Referral made"));
      if (f.type === "referral_rejected") evidence.push(ev(f, "Referral rejected"));
    }
    if (gpNote) evidence.push(ev(gpNote, "GP status note"));

    out.push({
      key: `${patientId}:referral_ping_pong`,
      patientId,
      placeId: patient.placeId,
      pattern: "referral_ping_pong",
      title: `Falls referral has bounced ${rejections.length} times with no service accepting it`,
      severityHint: "high",
      confidence: "high",
      owner: {
        functionArea: "single_point_of_access",
        orgId: "org-mch",
        label: teamLabel("single_point_of_access", "org-mch"),
      },
      evidence,
      signals: {
        rejectionCount: rejections.length,
        loopAgeHours,
        recurrentFalls: patient.flags.includes("recurrent falls"),
        hasGpEscalation: Boolean(gpNote),
      },
    });
  }
  return out;
}

function detectDuplicateAssessment(ctx: Ctx): Candidate[] {
  const out: Candidate[] = [];
  for (const [patientId, pe] of ctx.eventsByPatient) {
    const assessments = pe.filter((e) => e.type === "assessment_completed");
    for (let i = 0; i < assessments.length; i++) {
      for (let j = i + 1; j < assessments.length; j++) {
        const a = assessments[i];
        const b = assessments[j];
        const domA = String(a.data?.domain ?? "");
        const domB = String(b.data?.domain ?? "");
        if (!domA || domA !== domB) continue;
        if (a.fromOrgId === b.fromOrgId) continue;
        const gapDays = daysBetween(a.at, b.at);
        if (gapDays > 10) continue;

        const patient = ctx.patientsById.get(patientId)!;
        const note = [...pe].reverse().find((e) => e.type === "status_note");
        const evidence: EvidenceItem[] = [
          ev(a, `Assessment by ${orgName(a.fromOrgId)}`),
          ev(b, `Assessment by ${orgName(b.fromOrgId)}`),
        ];
        if (note) evidence.push(ev(note, "Patient / staff note"));

        out.push({
          key: `${patientId}:duplicate_assessment`,
          patientId,
          placeId: patient.placeId,
          pattern: "duplicate_assessment",
          title: `Two "${domA}" assessments by different organisations within ${Math.round(gapDays)} days`,
          severityHint: "low",
          confidence: "medium",
          owner: {
            functionArea: "neighbourhood_team",
            orgId: "org-mch",
            label: teamLabel("neighbourhood_team", "org-mch"),
          },
          evidence,
          signals: {
            domain: domA,
            gapDays: Math.round(gapDays),
            hasPatientComplaint: Boolean(note),
          },
        });
      }
    }
  }
  return out;
}

function detectLoopNotClosed(ctx: Ctx): Candidate[] {
  const out: Candidate[] = [];
  for (const st of ctx.states.filter((s) => s.pathway === "discharge:frailty")) {
    const accepted = st.steps.find((s) => s.step.key === "referral_accepted");
    const booked = st.steps.find((s) => s.step.key === "first_visit_booked");
    const done = st.steps.find((s) => s.step.key === "first_visit_done");
    if (!accepted?.satisfied || !booked?.satisfied || !done || done.satisfied || done.overdueHours < 48) continue;

    const pe = ctx.eventsByPatient.get(st.patientId) ?? [];
    const acceptEv = pe.find((e) => e.id === accepted.satisfiedByEventId);
    const bookEv = pe.find((e) => e.id === booked.satisfiedByEventId);
    const note = [...pe].reverse().find((e) => e.type === "status_note");
    const patient = ctx.patientsById.get(st.patientId)!;

    const evidence: EvidenceItem[] = [];
    if (acceptEv) evidence.push(ev(acceptEv, "Referral accepted"));
    if (bookEv) evidence.push(ev(bookEv, "First visit booked"));
    evidence.push(syntheticGap(bookEv?.at ?? st.triggeredAt, "Booked visit not completed and not re-arranged"));
    if (note) evidence.push(ev(note, "Scheduling note"));

    out.push({
      key: `${st.patientId}:loop_not_closed`,
      patientId: st.patientId,
      placeId: patient.placeId,
      pattern: "loop_not_closed",
      title: "Accepted rehab referral has stalled — booked visit never completed",
      severityHint: "medium",
      confidence: "high",
      owner: {
        functionArea: "therapies",
        orgId: acceptEv?.fromOrgId ?? "org-mch",
        label: teamLabel("therapies", acceptEv?.fromOrgId ?? "org-mch"),
      },
      evidence,
      signals: { overdueHours: done.overdueHours },
    });
  }
  return out;
}

function detectDnaNoRebook(ctx: Ctx): Candidate[] {
  const out: Candidate[] = [];
  for (const st of ctx.states.filter((s) => s.pathway === "outpatient")) {
    const rebook = st.steps.find((s) => s.step.key === "dna_rebook");
    if (!rebook || rebook.satisfied || rebook.overdueHours <= 0) continue;

    const pe = ctx.eventsByPatient.get(st.patientId) ?? [];
    const dna = pe.find((e) => e.id === st.triggeredBy);
    const original = pe.find((e) => e.type === "appointment_scheduled" && e.pathway === "outpatient");
    const patient = ctx.patientsById.get(st.patientId)!;

    const evidence: EvidenceItem[] = [];
    if (original) evidence.push(ev(original, "Appointment originally booked"));
    if (dna) evidence.push(ev(dna, "Did not attend"));
    evidence.push(syntheticGap(dna?.at ?? st.triggeredAt, "No rebooking, contact attempt or discharge decision recorded"));

    out.push({
      key: `${st.patientId}:dna_no_rebook`,
      patientId: st.patientId,
      placeId: patient.placeId,
      pattern: "dna_no_rebook",
      title: "Missed outpatient appointment with no rebooking or contact",
      severityHint: "medium",
      confidence: "high",
      owner: {
        functionArea: "gp_practice",
        orgId: "org-rpcn",
        label: teamLabel("gp_practice", "org-rpcn"),
      },
      evidence,
      signals: { overdueHours: rebook.overdueHours },
    });
  }
  return out;
}

function detectHandoverGap(ctx: Ctx): Candidate[] {
  const out: Candidate[] = [];
  const nowMs = Date.parse(ctx.now);
  for (const [patientId, pe] of ctx.eventsByPatient) {
    const admission = pe.find(
      (e) => e.type === "admission" && (nowMs - Date.parse(e.at)) / HOUR <= 7 * 24,
    );
    if (!admission) continue;
    const admitOrg = admission.toOrgId ?? admission.fromOrgId;

    // An active caseload elsewhere: a recent contact/assessment from a different org.
    const caseloadContacts = pe
      .filter(
        (e) =>
          (e.type === "assessment_completed" || e.type === "status_note") &&
          e.fromOrgId !== admitOrg &&
          (nowMs - Date.parse(e.at)) / HOUR <= 200 * 24,
      )
      .sort((a, b) => b.at.localeCompare(a.at));
    if (caseloadContacts.length === 0) continue;
    const caseloadOrg = caseloadContacts[0].fromOrgId;

    const handoverAfterAdmission = pe.some(
      (e) => e.fromOrgId === caseloadOrg && Date.parse(e.at) > Date.parse(admission.at),
    );
    if (handoverAfterAdmission) continue;

    const patient = ctx.patientsById.get(patientId)!;
    const admissionAgeHours = Math.round((nowMs - Date.parse(admission.at)) / HOUR);

    out.push({
      key: `${patientId}:handover_gap`,
      patientId,
      placeId: patient.placeId,
      pattern: "handover_gap",
      title: `Acute admission with no handover from ${orgName(caseloadOrg)}`,
      severityHint: "medium",
      confidence: "medium",
      owner: {
        functionArea: caseloadOrg === "org-lakeside" ? "mental_health" : "neighbourhood_team",
        orgId: caseloadOrg,
        label: teamLabel(caseloadOrg === "org-lakeside" ? "mental_health" : "neighbourhood_team", caseloadOrg),
      },
      evidence: [
        ev(admission, "Acute admission"),
        ev(caseloadContacts[0], `Most recent contact from ${orgName(caseloadOrg)}`),
        syntheticGap(admission.at, `No handover, status note or care-plan share from ${orgName(caseloadOrg)} to the ward`),
      ],
      signals: { admissionAgeHours, caseloadOrg },
    });
  }
  return out;
}

// ---------------------------------------------------------------- helpers

function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = keyFn(item);
    const arr = map.get(k);
    if (arr) arr.push(item);
    else map.set(k, [item]);
  }
  return map;
}

/** An evidence line that records the *absence* of an expected event. */
function syntheticGap(sinceIso: string, detail: string): EvidenceItem {
  return { eventId: `gap:${sinceIso}`, at: sinceIso, label: "Expected event missing", detail };
}
