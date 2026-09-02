/**
 * Synthetic neighbourhood: "Meadowford" place footprint.
 * One acute trust, one community provider, a primary care network, the council
 * adult social care team, a mental health partnership and a voluntary provider.
 *
 * Entirely fictional. Any resemblance to a real organisation is coincidental.
 */
import type { Organisation, Team, Place } from "@/domain/types";

export const PLACE: Place = {
  id: "place-meadowford",
  name: "Meadowford",
  description:
    "A place footprint of ~140,000 people served by one acute trust, one community provider, 9 GP practices in a primary care network, the council adult social care team, a mental health partnership and a voluntary-sector carers organisation.",
};

export const ORGANISATIONS: Organisation[] = [
  {
    id: "org-mft",
    name: "Meadowford Acute NHS Foundation Trust",
    kind: "acute_trust",
    role: "District general hospital. Emergency department, acute medicine, elective surgery, and the integrated discharge hub.",
  },
  {
    id: "org-mch",
    name: "Meadowford Community Health",
    kind: "community_provider",
    role: "Community rehabilitation and reablement, district nursing, integrated neighbourhood teams and the community single point of access.",
  },
  {
    id: "org-rpcn",
    name: "Riverside Primary Care Network",
    kind: "primary_care",
    role: "Nine GP practices covering the Meadowford place, sharing a network of care coordinators.",
  },
  {
    id: "org-council",
    name: "Meadowford Council — Adult Social Care",
    kind: "social_care",
    role: "Social work assessment, reablement packages, and brokerage of home care and residential placements.",
  },
  {
    id: "org-lakeside",
    name: "Lakeside Mental Health Partnership",
    kind: "mental_health",
    role: "Community mental health teams and crisis response for the Meadowford place.",
  },
  {
    id: "org-carers",
    name: "Meadowford Carers & Community",
    kind: "voluntary",
    role: "Voluntary-sector carer support, befriending and practical help at home.",
  },
];

export const TEAMS: Team[] = [
  { id: "team-mft-hub", orgId: "org-mft", name: "Integrated Discharge Hub", functionArea: "discharge_hub" },
  { id: "team-mft-toc", orgId: "org-mft", name: "Transfer of Care Team", functionArea: "transfer_of_care" },
  { id: "team-mch-rehab", orgId: "org-mch", name: "Community Rehab & Reablement", functionArea: "therapies" },
  { id: "team-mch-dn", orgId: "org-mch", name: "District Nursing", functionArea: "district_nursing" },
  { id: "team-mch-nt4", orgId: "org-mch", name: "Neighbourhood Team 4 (Riverside)", functionArea: "neighbourhood_team" },
  { id: "team-mch-spa", orgId: "org-mch", name: "Community Single Point of Access", functionArea: "single_point_of_access" },
  { id: "team-mch-vw", orgId: "org-mch", name: "Meadowford Virtual Ward", functionArea: "virtual_ward" },
  { id: "team-council-sw", orgId: "org-council", name: "Hospital Social Work Team", functionArea: "social_work" },
  { id: "team-rpcn-riverside", orgId: "org-rpcn", name: "Riverside Surgery", functionArea: "gp_practice" },
  { id: "team-lakeside-cmht", orgId: "org-lakeside", name: "Meadowford CMHT", functionArea: "mental_health" },
  { id: "team-carers", orgId: "org-carers", name: "Meadowford Carers", functionArea: "voluntary" },
];

export function orgName(id: string): string {
  return ORGANISATIONS.find((o) => o.id === id)?.name ?? id;
}

export function teamForFunction(fn: Team["functionArea"]): Team | undefined {
  return TEAMS.find((t) => t.functionArea === fn);
}
