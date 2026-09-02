import type { WorldSeed } from "@/domain/types";
import { PLACE, ORGANISATIONS, TEAMS } from "./world";
import { PATIENTS } from "./patients";
import { EVENTS, NOW } from "./events";

/** The synthetic world the MVP boots from. Rebuilt whenever state is reset. */
export function buildSeed(): WorldSeed {
  return {
    now: NOW,
    places: [PLACE],
    organisations: ORGANISATIONS,
    teams: TEAMS,
    patients: PATIENTS,
    events: [...EVENTS].sort((a, b) => a.at.localeCompare(b.at)),
  };
}

export { NOW };
