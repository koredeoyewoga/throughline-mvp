/**
 * Pathway definitions — the "expected next-steps + SLAs" the Coordination Agent
 * checks reality against. In production these are configured per place from
 * local operating procedures; here a representative set is hard-coded.
 */
import type { ExpectedStep, EventType } from "./types";

export interface PathwayDefinition {
  key: string;
  label: string;
  /** Event type that opens the pathway. */
  triggerEvent: EventType;
  steps: ExpectedStep[];
}

export const PATHWAYS: PathwayDefinition[] = [
  {
    key: "discharge:frailty",
    label: "Hospital discharge — frailty / rehab",
    triggerEvent: "discharge_ready",
    steps: [
      {
        key: "referral_to_community",
        description: "Community rehab / reablement referral made by the discharge hub",
        owningFunction: "discharge_hub",
        slaHours: 24,
        satisfiedBy: ["referral_made"],
      },
      {
        key: "referral_accepted",
        description: "Community provider acknowledges and accepts the referral",
        owningFunction: "transfer_of_care",
        slaHours: 48,
        satisfiedBy: ["referral_accepted"],
      },
      {
        key: "first_visit_booked",
        description: "First community visit booked with the patient",
        owningFunction: "therapies",
        slaHours: 72,
        satisfiedBy: ["visit_booked", "appointment_scheduled"],
      },
      {
        key: "first_visit_done",
        description: "First community visit completed",
        owningFunction: "therapies",
        slaHours: 120,
        satisfiedBy: ["visit_completed"],
      },
    ],
  },
  {
    key: "discharge:district_nursing",
    label: "Hospital discharge — district nursing task",
    triggerEvent: "discharge_summary_issued",
    steps: [
      {
        key: "dn_task_received",
        description: "District nursing task from the discharge summary is picked up",
        owningFunction: "district_nursing",
        slaHours: 24,
        satisfiedBy: ["referral_accepted", "visit_booked"],
      },
      {
        key: "dn_visit_done",
        description: "District nursing visit completed within the clinical timeframe",
        owningFunction: "district_nursing",
        slaHours: 72,
        satisfiedBy: ["visit_completed"],
      },
    ],
  },
  {
    key: "falls",
    label: "Falls pathway — onward referral",
    triggerEvent: "referral_made",
    steps: [
      {
        key: "falls_ack",
        description: "Falls service acknowledges the referral",
        owningFunction: "single_point_of_access",
        slaHours: 48,
        satisfiedBy: ["referral_acknowledged", "referral_accepted"],
      },
      {
        key: "falls_accepted",
        description: "Referral accepted by an appropriate service (not bounced)",
        owningFunction: "single_point_of_access",
        slaHours: 120,
        satisfiedBy: ["referral_accepted"],
      },
      {
        key: "falls_appt",
        description: "Falls clinic appointment scheduled",
        owningFunction: "therapies",
        slaHours: 336,
        satisfiedBy: ["appointment_scheduled"],
      },
    ],
  },
  {
    key: "neighbourhood:complex",
    label: "Neighbourhood team — complex case follow-up",
    triggerEvent: "assessment_completed",
    steps: [
      {
        key: "mdt_actions_assigned",
        description: "MDT actions from the assessment are assigned to named owners",
        owningFunction: "neighbourhood_team",
        slaHours: 72,
        satisfiedBy: ["task_expected"],
      },
      {
        key: "follow_up_contact",
        description: "Follow-up contact with the patient takes place",
        owningFunction: "neighbourhood_team",
        slaHours: 336,
        satisfiedBy: ["contact_attempt", "visit_completed"],
      },
    ],
  },
  {
    key: "outpatient",
    label: "Outpatient appointment — did not attend",
    triggerEvent: "appointment_dna",
    steps: [
      {
        key: "dna_rebook",
        description: "Patient contacted and appointment rebooked or safely discharged",
        owningFunction: "gp_practice",
        slaHours: 120,
        satisfiedBy: ["appointment_scheduled", "contact_attempt", "status_note"],
      },
    ],
  },
];

export function pathwayByKey(key: string): PathwayDefinition | undefined {
  return PATHWAYS.find((p) => p.key === key);
}
