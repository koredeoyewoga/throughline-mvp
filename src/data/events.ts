/**
 * Synthetic source events for the Meadowford place, expressed relative to a
 * fixed "now" so the demo is stable. These stand in for the FHIR / e-RS /
 * Transfer-of-Care feeds a real deployment would ingest.
 */
import type { SourceEvent, EventType } from "@/domain/types";

/** Fixed reference time for the synthetic world. */
export const NOW = "2026-09-02T09:00:00.000Z";

const NOW_MS = Date.parse(NOW);
const HOUR = 3600 * 1000;

function ago(days: number, hours = 0): string {
  return new Date(NOW_MS - days * 24 * HOUR - hours * HOUR).toISOString();
}

let seq = 0;
function ev(
  patientId: string,
  type: EventType,
  at: string,
  fromOrgId: string,
  summary: string,
  extra: Partial<SourceEvent> = {},
): SourceEvent {
  seq += 1;
  return {
    id: `evt-${String(seq).padStart(4, "0")}`,
    patientId,
    type,
    at,
    fromOrgId,
    summary,
    ...extra,
  };
}

export const EVENTS: SourceEvent[] = [
  // ============================================================= Ada Nkemelu
  // Pattern: referral_unactioned (HIGH) — referral made, never accepted, patient still in a bed.
  ev("pat-ada-nkemelu", "admission", ago(9), "org-mft", "Admitted via ED after a fall — left wrist fracture", {
    toOrgId: "org-mft",
  }),
  ev(
    "pat-ada-nkemelu",
    "discharge_ready",
    ago(6),
    "org-mft",
    "Medically fit for discharge — awaiting community rehab and reablement",
    { pathway: "discharge:frailty" },
  ),
  ev(
    "pat-ada-nkemelu",
    "referral_made",
    ago(6),
    "org-mft",
    "Community rehab & reablement referral submitted to Meadowford Community Health",
    {
      toOrgId: "org-mch",
      pathway: "discharge:frailty",
      documentText:
        "REFERRAL — Community Rehab & Reablement. 87yo, lives alone, first-floor flat, no lift. Left wrist fracture (non-dominant), now in cast. Was independent with personal care and stairs before admission. Needs: strength & balance rehab, stair practice, one-handed kitchen assessment, review of falls risk. No package of care pre-admission. Family: niece visits weekly.",
    },
  ),
  ev("pat-ada-nkemelu", "referral_acknowledged", ago(5), "org-mch", "Referral received by Community Rehab inbox", {
    fromOrgId: "org-mch",
    toOrgId: "org-mft",
    pathway: "discharge:frailty",
  }),
  ev(
    "pat-ada-nkemelu",
    "status_note",
    ago(1),
    "org-mft",
    "Ward note: patient asking daily when rehab will start; unit is full and this bed is needed for an ED admission",
  ),

  // ============================================================ George Fenwick
  // Pattern: discharge_task_dropped (HIGH) — DN task from the discharge summary never picked up.
  ev(
    "pat-george-fenwick",
    "discharge_summary_issued",
    ago(4),
    "org-mft",
    "Discharge summary issued to GP and Community Health",
    {
      toOrgId: "org-mch",
      pathway: "discharge:district_nursing",
      documentText:
        "DISCHARGE SUMMARY. 81yo, COPD + HF, admitted with infective exacerbation, now stable on oral antibiotics. WOUND: chronic left leg venous ulcer, dressing changed on ward. PLAN: District nurse to review and re-dress the left leg ulcer within 48–72 hours of discharge. If found unsteady on standing at that visit, refer to the community falls clinic. GP to review diuretic dose at 1 week.",
    },
  ),
  ev(
    "pat-george-fenwick",
    "task_expected",
    ago(4),
    "org-mft",
    "District nursing: review & re-dress left leg ulcer within 48–72h of discharge",
    {
      toOrgId: "org-mch",
      pathway: "discharge:district_nursing",
      data: { extractedFrom: "discharge summary", timeframeHours: 72, conditional: "refer to falls clinic if unsteady" },
    },
  ),

  // ============================================================ Pauline Osei
  // Pattern: follow_up_missed (MEDIUM) — MDT actions assigned, no follow-up contact in >14 days.
  ev(
    "pat-pauline-osei",
    "assessment_completed",
    ago(22),
    "org-mch",
    "Neighbourhood Team 4 — complex case multidisciplinary assessment completed",
    { pathway: "neighbourhood:complex", data: { domain: "complex case MDT" } },
  ),
  ev(
    "pat-pauline-osei",
    "task_expected",
    ago(21),
    "org-mch",
    "MDT actions assigned: medication review, carer's assessment referral, weekly welfare check-in",
    { pathway: "neighbourhood:complex", data: { owners: ["GP", "social work", "NT4"] } },
  ),
  ev(
    "pat-pauline-osei",
    "status_note",
    ago(5),
    "org-rpcn",
    "Practice note: daughter called — mum's blood sugars erratic, says nobody has been in touch since the assessment",
  ),

  // ============================================================ Derek Holloway
  // Pattern: referral_ping_pong (HIGH) — bounced twice, still not accepted, 19 days open.
  ev("pat-derek-holloway", "referral_made", ago(19), "org-rpcn", "Falls pathway referral — 3 falls in 6 weeks", {
    toOrgId: "org-mch",
    pathway: "falls",
    documentText:
      "FALLS REFERRAL. 78yo, Parkinson's disease (Hoehn & Yahr 3). Three unwitnessed falls in the last 6 weeks, no fracture. On co-careldopa. Requests home strength & balance programme and a medication timing review.",
  }),
  ev(
    "pat-derek-holloway",
    "referral_rejected",
    ago(15),
    "org-mch",
    "Community falls service rejected: Parkinson's-related instability — please route to acute neuro-therapy",
    { fromOrgId: "org-mch", toOrgId: "org-rpcn", pathway: "falls" },
  ),
  ev("pat-derek-holloway", "referral_made", ago(14), "org-rpcn", "Re-referred to acute neuro-therapy team", {
    toOrgId: "org-mft",
    pathway: "falls",
  }),
  ev(
    "pat-derek-holloway",
    "referral_rejected",
    ago(9),
    "org-mft",
    "Acute neuro-therapy rejected: no acute therapy need — community falls service is the correct route",
    { fromOrgId: "org-mft", toOrgId: "org-rpcn", pathway: "falls" },
  ),
  ev(
    "pat-derek-holloway",
    "status_note",
    ago(2),
    "org-rpcn",
    "GP note: referral has now bounced twice with no service accepting it; further fall on Saturday, no injury",
  ),

  // ============================================================ Irene Baptiste
  // Pattern: duplicate_assessment (LOW/MEDIUM efficiency) — two reablement assessments, two orgs, one week.
  ev(
    "pat-irene-baptiste",
    "assessment_completed",
    ago(8),
    "org-mch",
    "Community Rehab — reablement assessment completed at home",
    { data: { domain: "reablement", detail: "goals set, 2-week reablement block proposed" } },
  ),
  ev(
    "pat-irene-baptiste",
    "assessment_completed",
    ago(4),
    "org-council",
    "Adult Social Care — reablement / care-needs assessment completed at home",
    { data: { domain: "reablement", detail: "care-needs assessment, reablement recommended" } },
  ),
  ev(
    "pat-irene-baptiste",
    "status_note",
    ago(3),
    "org-council",
    "Social worker note: patient says she has 'already done all this' with the hospital team last week",
  ),

  // ============================================================ Samuel Adeyemi
  // Pattern: loop_not_closed (MEDIUM) — referral accepted, visit booked, visit never completed.
  ev("pat-samuel-adeyemi", "discharge_ready", ago(10), "org-mft", "Medically fit — awaiting community stroke rehab", {
    pathway: "discharge:frailty",
  }),
  ev("pat-samuel-adeyemi", "referral_made", ago(10), "org-mft", "Community stroke rehab referral submitted", {
    toOrgId: "org-mch",
    pathway: "discharge:frailty",
  }),
  ev("pat-samuel-adeyemi", "referral_accepted", ago(8), "org-mch", "Community Rehab accepted the referral", {
    fromOrgId: "org-mch",
    toOrgId: "org-mft",
    pathway: "discharge:frailty",
  }),
  ev("pat-samuel-adeyemi", "visit_booked", ago(7), "org-mch", "First rehab visit booked", {
    pathway: "discharge:frailty",
    data: { bookedFor: ago(5) },
  }),
  ev(
    "pat-samuel-adeyemi",
    "status_note",
    ago(1),
    "org-mch",
    "Scheduling note: therapist off sick on the booked day; visit not re-arranged",
  ),

  // ============================================================ Margaret Cole
  // Pattern: dna_no_rebook (MEDIUM) — DNA 8 days ago, no rebooking or contact since.
  ev("pat-margaret-cole", "appointment_scheduled", ago(20), "org-mft", "Breast clinic follow-up appointment booked", {
    pathway: "outpatient",
    data: { scheduledFor: ago(8) },
  }),
  ev("pat-margaret-cole", "appointment_dna", ago(8), "org-mft", "Did not attend — breast clinic follow-up", {
    pathway: "outpatient",
  }),

  // ============================================================ Tomasz Woźniak
  // Pattern: handover_gap (MEDIUM) — known to CMHT, admitted acutely, no handover to the ward.
  ev("pat-tomasz-wozniak", "assessment_completed", ago(25), "org-lakeside", "CMHT review — stable on current care plan", {
    data: { domain: "mental health review" },
  }),
  ev("pat-tomasz-wozniak", "status_note", ago(12), "org-lakeside", "CMHT: routine telephone contact, no concerns raised"),
  ev("pat-tomasz-wozniak", "admission", ago(2), "org-mft", "Admitted via ED — lower-limb cellulitis", {
    toOrgId: "org-mft",
  }),

  // ============================================================ Clive Adepoju
  // Pattern: cancellation_no_rebook (MEDIUM) — provider cancelled, never rebooked.
  ev("pat-clive-adepoju", "appointment_scheduled", ago(24), "org-mft", "Cardiology follow-up appointment booked", {
    data: { scheduledFor: ago(10) },
  }),
  ev(
    "pat-clive-adepoju",
    "appointment_cancelled",
    ago(10),
    "org-mft",
    "Clinic cancelled by the trust — consultant on unplanned leave; patient told a new date would follow",
    { data: { reason: "consultant unavailable", by: "provider" } },
  ),

  // ============================================================ Beatrice Sowande
  // Pattern: package_of_care_delay (HIGH) — package requested, not started, patient in a bed.
  ev("pat-beatrice-sowande", "admission", ago(12), "org-mft", "Admitted via ED — urinary sepsis and a fall", {
    toOrgId: "org-mft",
  }),
  ev(
    "pat-beatrice-sowande",
    "care_package_requested",
    ago(5),
    "org-mft",
    "Home-care package requested from Adult Social Care — four calls per day for personal care and meals",
    {
      toOrgId: "org-council",
      pathway: "discharge:social_care",
      documentText:
        "DISCHARGE PLAN. 84yo, lives alone, ground-floor flat. Independent with a frame indoors before admission. Needs 4 calls/day: AM personal care + breakfast, lunch, tea, PM settle. Family live 40 miles away. Discharge to assess not suitable — needs the package in place first.",
    },
  ),
  ev(
    "pat-beatrice-sowande",
    "status_note",
    ago(1),
    "org-mft",
    "Ward: this bed is needed; family calling daily asking when the care package will start",
  ),

  // ============================================================ Harold Mensah
  // Pattern: onward_referral_not_made (MEDIUM) — summary asked the GP to refer; never done.
  ev(
    "pat-harold-mensah",
    "discharge_summary_issued",
    ago(12),
    "org-mft",
    "Discharge summary issued to the GP",
    {
      toOrgId: "org-rpcn",
      documentText:
        "DISCHARGE SUMMARY. 79yo, admitted with hyperactive delirium secondary to a UTI, now resolved. Collateral history suggests a 6-month decline in short-term memory pre-dating this admission. PLAN: GP to refer to the community memory assessment service for formal cognitive assessment once fully recovered (4-6 weeks). Continue donepezil review at that point.",
    },
  ),
  ev(
    "pat-harold-mensah",
    "task_expected",
    ago(12),
    "org-mft",
    "GP to refer to the community memory assessment service for cognitive assessment",
    {
      toOrgId: "org-rpcn",
      data: {
        action: "onward_referral",
        target: "the memory assessment service",
        slaHours: 168,
        quote: "GP to refer to the community memory assessment service for formal cognitive assessment once fully recovered.",
      },
    },
  ),

  // ============================================================ Doreen Achebe
  // Pattern: virtual_ward_step_down_stalled (MEDIUM) — ready to step down, not discharged.
  ev(
    "pat-doreen-achebe",
    "virtual_ward_admission",
    ago(8),
    "org-mch",
    "Admitted to the Meadowford Virtual Ward — infective COPD exacerbation, on the monitoring pathway",
  ),
  ev(
    "pat-doreen-achebe",
    "virtual_ward_step_down_ready",
    ago(4),
    "org-mch",
    "Clinically ready to step down — obs stable for 48h, back on baseline inhalers",
    { pathway: "virtual_ward" },
  ),
  ev(
    "pat-doreen-achebe",
    "status_note",
    ago(1),
    "org-mch",
    "VW note: monitoring kit still on loan; discharge letter to the GP not yet drafted",
  ),

  // ============================================================ HEALTHY PATHWAYS
  // Kwame Boateng — home-care package started on time.
  ev("pat-kwame-boateng", "care_package_requested", ago(6), "org-mft", "Home-care package requested — two calls per day", {
    toOrgId: "org-council",
    pathway: "discharge:social_care",
  }),
  ev("pat-kwame-boateng", "care_package_started", ago(4), "org-council", "Package brokered; first call completed", {
    pathway: "discharge:social_care",
  }),

  // Ruth Nwosu — virtual ward stepped down cleanly.
  ev("pat-ruth-nwosu", "virtual_ward_admission", ago(9), "org-mch", "Admitted to the virtual ward — community-acquired pneumonia"),
  ev("pat-ruth-nwosu", "virtual_ward_step_down_ready", ago(5), "org-mch", "Clinically ready to step down", {
    pathway: "virtual_ward",
  }),
  ev("pat-ruth-nwosu", "virtual_ward_discharge", ago(4), "org-mch", "Discharged from the virtual ward; GP handback sent", {
    pathway: "virtual_ward",
    toOrgId: "org-rpcn",
  }),

  // ============================================================ HEALTHY PATHWAYS (original)
  // Brian Ashworth — discharge:frailty completed cleanly.
  ev("pat-brian-ashworth", "discharge_ready", ago(12), "org-mft", "Medically fit — community rehab requested", {
    pathway: "discharge:frailty",
  }),
  ev("pat-brian-ashworth", "referral_made", ago(12), "org-mft", "Community rehab referral submitted", {
    toOrgId: "org-mch",
    pathway: "discharge:frailty",
  }),
  ev("pat-brian-ashworth", "referral_accepted", ago(10), "org-mch", "Referral accepted", {
    fromOrgId: "org-mch",
    toOrgId: "org-mft",
    pathway: "discharge:frailty",
  }),
  ev("pat-brian-ashworth", "visit_booked", ago(9), "org-mch", "First visit booked", { pathway: "discharge:frailty" }),
  ev("pat-brian-ashworth", "visit_completed", ago(6), "org-mch", "First rehab visit completed; block underway", {
    pathway: "discharge:frailty",
  }),

  // Yvonne Clarke — district nursing task handled on time.
  ev("pat-yvonne-clarke", "discharge_summary_issued", ago(6), "org-mft", "Discharge summary issued with DN dressing task", {
    toOrgId: "org-mch",
    pathway: "discharge:district_nursing",
    documentText: "DISCHARGE SUMMARY. District nurse to review surgical wound dressing within 72h.",
  }),
  ev("pat-yvonne-clarke", "task_expected", ago(6), "org-mft", "District nursing: wound dressing review within 72h", {
    toOrgId: "org-mch",
    pathway: "discharge:district_nursing",
    data: { timeframeHours: 72 },
  }),
  ev("pat-yvonne-clarke", "referral_accepted", ago(5), "org-mch", "District Nursing picked up the task", {
    fromOrgId: "org-mch",
    pathway: "discharge:district_nursing",
  }),
  ev("pat-yvonne-clarke", "visit_completed", ago(4), "org-mch", "District nursing visit completed, wound healing well", {
    pathway: "discharge:district_nursing",
  }),

  // Nasrin Khan — DNA rebooked next day.
  ev("pat-nasrin-khan", "appointment_scheduled", ago(15), "org-mft", "Cardiology follow-up booked", {
    pathway: "outpatient",
    data: { scheduledFor: ago(6) },
  }),
  ev("pat-nasrin-khan", "appointment_dna", ago(6), "org-mft", "Did not attend — cardiology follow-up", {
    pathway: "outpatient",
  }),
  ev("pat-nasrin-khan", "contact_attempt", ago(5), "org-mft", "Booking team contacted patient — transport issue on the day", {
    pathway: "outpatient",
  }),
  ev("pat-nasrin-khan", "appointment_scheduled", ago(5), "org-mft", "Cardiology follow-up rebooked with patient transport", {
    pathway: "outpatient",
  }),

  // Leonard Price — neighbourhood follow-up done in time.
  ev("pat-leonard-price", "assessment_completed", ago(20), "org-mch", "Neighbourhood Team 4 assessment completed", {
    pathway: "neighbourhood:complex",
    data: { domain: "complex case MDT" },
  }),
  ev("pat-leonard-price", "task_expected", ago(19), "org-mch", "MDT actions assigned to named owners", {
    pathway: "neighbourhood:complex",
  }),
  ev("pat-leonard-price", "visit_completed", ago(8), "org-mch", "NT4 follow-up visit completed; plan on track", {
    pathway: "neighbourhood:complex",
  }),
];
