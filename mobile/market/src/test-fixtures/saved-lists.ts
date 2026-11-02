import type { FixtureSavedList } from "../saved-lists-fixture-read";
export const savedListId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const savedListOrganization = savedListId(4), savedListUser = savedListId(20);
const date = "2026-10-29T01:02:03.000Z";
type FixtureRow = FixtureSavedList & { createdById: string };
export function savedListFixture(overrides: Partial<FixtureRow> = {}): FixtureRow {
  const id = overrides.id ?? savedListId(801);
  return { id, organizationId: savedListOrganization, createdById: savedListUser, name: "SYNTHETIC Таңғы закупка", isDefault: true, createdAt: date, updatedAt: date,
    items: [{ id: savedListId(802), listId: id, offerId: savedListId(803), quantity: "999999999999.999999", note: "  SYNTHETIC raw note\nСұрақ  ", createdAt: date, updatedAt: date }], ...overrides };
}
