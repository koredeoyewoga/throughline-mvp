import { buildMapContext } from "../resolve";
import { PATIENTS } from "@/data/patients";
import { ORGANISATIONS } from "@/data/world";

/** A MapContext wired to the real synthetic world, for adapter tests. */
export const ctx = buildMapContext(PATIENTS, ORGANISATIONS, "org-mft");

/** A patient known to the place: Ada Nkemelu. */
export const ADA = {
  id: "pat-ada-nkemelu",
  nhsNumber: "999 001 2201",
  mftLocalId: "MFT-448120",
};
