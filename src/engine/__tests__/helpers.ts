import type { Patient, SourceEvent, EventType } from "@/domain/types";

/** A fixed reference time for unit fixtures (distinct from the seed's NOW). */
export const T0 = "2026-01-20T09:00:00.000Z";
const T0_MS = Date.parse(T0);
const DAY = 24 * 3600 * 1000;

export function daysBefore(n: number, atMs = T0_MS): string {
  return new Date(atMs - n * DAY).toISOString();
}

let seq = 0;
export function resetSeq() {
  seq = 0;
}

export function ev(
  patientId: string,
  type: EventType,
  at: string,
  fromOrgId: string,
  extra: Partial<SourceEvent> = {},
): SourceEvent {
  seq += 1;
  return { id: `t-evt-${seq}`, patientId, type, at, fromOrgId, summary: `${type} event`, ...extra };
}

export function mkPatient(id: string, extra: Partial<Patient> = {}): Patient {
  return {
    id,
    name: id,
    nhsNumber: "999 000 0000",
    yearOfBirth: 1942,
    placeId: "place-meadowford",
    summary: "",
    flags: [],
    sourceIds: [{ orgId: "org-mft", localId: "x", confidence: 1 }],
    ...extra,
  };
}
