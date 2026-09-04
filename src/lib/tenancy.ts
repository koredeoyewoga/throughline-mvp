/**
 * Place (tenant) scoping.
 *
 * Every place-scoped entity carries `placeId`. The store's reads and writes run
 * through these helpers with the caller's `currentPlaceId()`, so an id from
 * another place resolves to "not found" / "not writable" rather than leaking or
 * mutating a different tenant's row. With `placeId` omitted (internal callers)
 * nothing is filtered.
 */

export function inPlace<T extends { placeId: string }>(items: T[], placeId?: string): T[] {
  return placeId ? items.filter((i) => i.placeId === placeId) : items;
}

/** An item is visible only if no scope is given, or its place matches. */
export function visibleInPlace<T extends { placeId: string }>(
  item: T | undefined,
  placeId?: string,
): T | undefined {
  if (item && placeId && item.placeId !== placeId) return undefined;
  return item;
}

/** A write is allowed only against an existing item in the caller's place. */
export function writableInPlace(item: { placeId: string } | undefined, placeId?: string): boolean {
  if (!item) return false;
  return !placeId || item.placeId === placeId;
}
