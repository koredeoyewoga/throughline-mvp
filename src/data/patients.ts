/**
 * Synthetic patients for the Meadowford place. Names are invented; NHS numbers
 * are fabricated (all begin 999) and are not valid NHS numbers.
 */
import type { Patient } from "@/domain/types";

const P = "place-meadowford";

function patient(
  id: string,
  name: string,
  nhs: string,
  yob: number,
  summary: string,
  flags: string[],
  sourceIds: Patient["sourceIds"],
): Patient {
  return { id, name, nhsNumber: nhs, yearOfBirth: yob, placeId: P, summary, flags, sourceIds };
}

export const PATIENTS: Patient[] = [
  patient(
    "pat-ada-nkemelu",
    "Ada Nkemelu",
    "999 001 2201",
    1939,
    "87, lives alone in a first-floor flat. Admitted after a fall with a fractured wrist. Medically fit for discharge; needs community rehab and reablement to get back up stairs.",
    ["lives alone", "falls risk", "stairs access"],
    [
      { orgId: "org-mft", localId: "MFT-448120", confidence: 1 },
      { orgId: "org-mch", localId: "MCH-11902", confidence: 0.97 },
      { orgId: "org-rpcn", localId: "RIV-3391", confidence: 0.95 },
    ],
  ),
  patient(
    "pat-george-fenwick",
    "George Fenwick",
    "999 004 5518",
    1945,
    "81, COPD and heart failure. Discharged four days ago with a district nursing task for a leg-ulcer dressing review at 48–72h and a falls-clinic referral if unsteady.",
    ["COPD", "heart failure", "wound care"],
    [
      { orgId: "org-mft", localId: "MFT-449001", confidence: 1 },
      { orgId: "org-mch", localId: "MCH-12044", confidence: 0.99 },
    ],
  ),
  patient(
    "pat-pauline-osei",
    "Pauline Osei",
    "999 002 8830",
    1952,
    "74, type 2 diabetes, mild cognitive impairment. Under Neighbourhood Team 4 for complex case management after a multidisciplinary assessment three weeks ago.",
    ["diabetes", "MCI", "carer strain"],
    [
      { orgId: "org-mch", localId: "MCH-10233", confidence: 1 },
      { orgId: "org-rpcn", localId: "RIV-2210", confidence: 0.96 },
      { orgId: "org-council", localId: "MC-SW-8841", confidence: 0.9 },
    ],
  ),
  patient(
    "pat-derek-holloway",
    "Derek Holloway",
    "999 003 1177",
    1948,
    "78, Parkinson's disease, recurrent falls. A falls-pathway referral has bounced between the community falls service and the acute therapy team.",
    ["Parkinson's", "recurrent falls", "referral bounced"],
    [
      { orgId: "org-rpcn", localId: "RIV-4408", confidence: 1 },
      { orgId: "org-mch", localId: "MCH-12610", confidence: 0.94 },
      { orgId: "org-mft", localId: "MFT-440221", confidence: 0.88 },
    ],
  ),
  patient(
    "pat-irene-baptiste",
    "Irene Baptiste",
    "999 005 6642",
    1943,
    "83, frailty and low mood. Assessed for reablement by both the community rehab team and the council social work team within the same week.",
    ["frailty", "low mood", "possible duplication"],
    [
      { orgId: "org-mch", localId: "MCH-12770", confidence: 0.99 },
      { orgId: "org-council", localId: "MC-SW-9002", confidence: 0.97 },
    ],
  ),
  patient(
    "pat-samuel-adeyemi",
    "Samuel Adeyemi",
    "999 006 9931",
    1957,
    "69, post-stroke. Community rehab referral was accepted a week ago; first visit was booked but has not yet been completed and is now well past the expected window.",
    ["post-stroke", "rehab", "visit overdue"],
    [
      { orgId: "org-mft", localId: "MFT-451188", confidence: 1 },
      { orgId: "org-mch", localId: "MCH-12881", confidence: 0.98 },
    ],
  ),
  patient(
    "pat-margaret-cole",
    "Margaret Cole",
    "999 007 4420",
    1950,
    "76, breast clinic follow-up. Did not attend an outpatient appointment eight days ago; no rebooking or contact recorded since.",
    ["outpatient DNA", "no rebook"],
    [
      { orgId: "org-mft", localId: "MFT-452004", confidence: 1 },
      { orgId: "org-rpcn", localId: "RIV-1188", confidence: 0.93 },
    ],
  ),
  patient(
    "pat-tomasz-wozniak",
    "Tomasz Woźniak",
    "999 008 2213",
    1962,
    "64, known to the community mental health team. Admitted to the acute trust two days ago; no handover from the CMHT to the ward is recorded.",
    ["CMHT caseload", "acute admission", "handover gap"],
    [
      { orgId: "org-lakeside", localId: "LK-CMHT-5521", confidence: 1 },
      { orgId: "org-mft", localId: "MFT-452901", confidence: 0.92 },
    ],
  ),

  // --- Healthy pathways (should produce NO exception) ---
  patient(
    "pat-brian-ashworth",
    "Brian Ashworth",
    "999 010 3301",
    1946,
    "80, discharged after a chest infection. Community rehab referral made, accepted and first visit completed — all within the expected windows.",
    ["healthy pathway"],
    [
      { orgId: "org-mft", localId: "MFT-448999", confidence: 1 },
      { orgId: "org-mch", localId: "MCH-12100", confidence: 0.99 },
    ],
  ),
  patient(
    "pat-yvonne-clarke",
    "Yvonne Clarke",
    "999 011 7789",
    1955,
    "71, discharged with a district nursing task; task picked up next day and visit completed within 48 hours.",
    ["healthy pathway"],
    [
      { orgId: "org-mft", localId: "MFT-449500", confidence: 1 },
      { orgId: "org-mch", localId: "MCH-12200", confidence: 0.99 },
    ],
  ),
  patient(
    "pat-nasrin-khan",
    "Nasrin Khan",
    "999 012 5560",
    1968,
    "58, cardiology follow-up. Missed an appointment but was contacted the next day and rebooked.",
    ["healthy pathway"],
    [
      { orgId: "org-mft", localId: "MFT-452500", confidence: 1 },
      { orgId: "org-rpcn", localId: "RIV-1500", confidence: 0.95 },
    ],
  ),
  patient(
    "pat-leonard-price",
    "Leonard Price",
    "999 013 8834",
    1940,
    "86, under Neighbourhood Team 4. MDT actions assigned and a follow-up contact completed within a fortnight of the assessment.",
    ["healthy pathway"],
    [
      { orgId: "org-mch", localId: "MCH-10500", confidence: 1 },
      { orgId: "org-rpcn", localId: "RIV-2500", confidence: 0.96 },
    ],
  ),
];

export function patientName(id: string): string {
  return PATIENTS.find((p) => p.id === id)?.name ?? id;
}
