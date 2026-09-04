import { describe, it, expect } from "vitest";
import { inPlace, visibleInPlace, writableInPlace } from "@/lib/tenancy";

const rows = [
  { id: "a", placeId: "place-meadowford" },
  { id: "b", placeId: "place-meadowford" },
  { id: "c", placeId: "place-other" },
];

describe("place scoping", () => {
  it("inPlace filters to the caller's place, or returns everything when unscoped", () => {
    expect(inPlace(rows, "place-meadowford").map((r) => r.id)).toEqual(["a", "b"]);
    expect(inPlace(rows, "place-other").map((r) => r.id)).toEqual(["c"]);
    expect(inPlace(rows).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("visibleInPlace hides an id that belongs to another place", () => {
    const other = rows[2];
    expect(visibleInPlace(other, "place-meadowford")).toBeUndefined();
    expect(visibleInPlace(other, "place-other")).toBe(other);
    expect(visibleInPlace(other)).toBe(other); // internal caller, no scope
    expect(visibleInPlace(undefined, "place-meadowford")).toBeUndefined();
  });

  it("writableInPlace blocks a missing row and a cross-tenant row", () => {
    expect(writableInPlace(rows[0], "place-meadowford")).toBe(true);
    expect(writableInPlace(rows[2], "place-meadowford")).toBe(false);
    expect(writableInPlace(undefined, "place-meadowford")).toBe(false);
    expect(writableInPlace(rows[2])).toBe(true); // unscoped internal write
  });
});
