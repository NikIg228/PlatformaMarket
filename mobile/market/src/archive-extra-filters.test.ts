import { jest } from "@jest/globals";
import { documentArchiveAccountingStatusSchema, documentArchiveQuerySchema } from "../../../packages/schemas/src/core-api";
import { archiveFilterDraft, archiveFiltersUnchanged, archiveUTCText, parseArchiveFilterDraft } from "./archive-filter-draft";
import { archiveAccountingStatusLabel } from "./document-archive-i18n";
import { createDocumentArchiveFixtureRead, decodeArchivePage, parseArchiveInput, type DocumentArchiveFixtureClient } from "./document-archive-fixture-read";
import { archiveDocument, archiveId, archivePage, archiveScope, archiveSummary } from "./test-fixtures/document-archive";
const from = "2026-10-28T00:00:00.000Z", to = "2026-10-29T23:59:59.999Z";
it.each(documentArchiveAccountingStatusSchema.options)("uses actual %s query value and distinct RU/KK labels without accounting commands", status => {
  const query = { accountingStatus: status, dateFrom: from, dateTo: to, q: "  SYNTHETIC  ", cursor: archiveId(99), limit: 1 };
  expect(parseArchiveInput(query)).toEqual(documentArchiveQuerySchema.parse(query));
  for (const locale of ["ru", "kk"] as const) expect(archiveAccountingStatusLabel(status, locale)).not.toBe(status);
});
it("round-trips source UTC seconds/fractions and has no implicit date or timezone", () => {
  for (const dateFrom of [from, "2026-10-28T01:02:03.123456Z"]) {
    const input = parseArchiveInput({ dateFrom, accountingStatus: "DISPUTED", limit: 1, cursor: archiveId(99), q: "SYNTHETIC" })!;
    const draft = archiveFilterDraft(input), selected = parseArchiveFilterDraft(draft)!;
    expect(draft.dateFromText).toBe(archiveUTCText(dateFrom)); expect(selected.dateFrom).toBe(dateFrom); expect(archiveFiltersUnchanged(input, selected)).toBe(true);
    expect(selected).not.toHaveProperty("cursor"); expect(selected).not.toHaveProperty("q");
  }
  expect(parseArchiveFilterDraft({ dateFromText: "  ", dateToText: "" })).toEqual({ limit: 25 });
  expect(parseArchiveFilterDraft({ dateFromText: " 2026-10-28 01:02:03.000 " })).toEqual({ limit: 25, dateFrom: "2026-10-28T01:02:03.000Z" });
});
it.each(["2026-10-28", "2026-10-28 01:02", "2026-02-30 12:00:00", "2026-10-28 24:00:00", "2026-10-28 12:00:60", "2026-10-28T12:00:00Z", "2026-10-28 12:00:00+05:00", "tomorrow"])("rejects malformed or implicit instant %s without inventing boundaries", text => {
  expect(parseArchiveFilterDraft({ dateFromText: text })).toBeNull(); expect(parseArchiveFilterDraft({ dateToText: text })).toBeNull();
});
it("retains actual root range refinement and recognizes changed/cleared accounting or date choices", () => {
  expect(parseArchiveFilterDraft({ dateFromText: "2026-10-29 00:00:00", dateToText: "2026-10-28 00:00:00" })).toBeNull();
  const input = parseArchiveInput({ accountingStatus: "REVIEWED", dateFrom: from, dateTo: to })!;
  expect(archiveFiltersUnchanged(input, parseArchiveFilterDraft(archiveFilterDraft(input))!)).toBe(true);
  for (const next of [{}, { ...archiveFilterDraft(input), accountingStatus: "DISPUTED" as const }, { ...archiveFilterDraft(input), dateToText: "" }]) expect(archiveFiltersUnchanged(input, parseArchiveFilterDraft(next)!)).toBe(false);
});
it("checks inclusive source documentDate and requested accounting status without exposing raw status or private metadata", () => {
  const query = parseArchiveInput({ accountingStatus: "REVIEWED", dateFrom: from, dateTo: to })!;
  const rows = [archiveDocument({ accountingStatus: "REVIEWED", documentDate: from }), archiveDocument({ id: archiveId(99), accountingStatus: "REVIEWED", documentDate: to })];
  const parsed = decodeArchivePage(archivePage(rows), archiveScope, query); expect(parsed.ok).toBe(true);
  if (parsed.ok) { expect(parsed.value.items).toHaveLength(2); for (const row of parsed.value.items) expect(row).not.toHaveProperty("accountingStatus"); }
  expect(decodeArchivePage(archivePage([archiveDocument({ documentDate: "2026-10-28T00:00:00Z" })]), archiveScope, parseArchiveInput({ dateFrom: from, dateTo: from })!).ok).toBe(true);
});
it.each(["accounting", "before", "after", "invalid-date"])("rejects %s mismatch before reading row title rather than filtering/salvaging rows", variant => {
  const raw = archiveDocument({ accountingStatus: variant === "accounting" ? "DISPUTED" : "REVIEWED", documentDate: variant === "before" ? "2026-10-27T23:59:59.999Z" : variant === "after" ? "2026-10-30T00:00:00Z" : variant === "invalid-date" ? "invalid" : from });
  const hidden = jest.fn(() => { throw new Error("Unexpected content read"); }); Object.defineProperty(raw, "title", { get: hidden });
  expect(decodeArchivePage(archivePage([raw]), archiveScope, parseArchiveInput({ accountingStatus: "REVIEWED", dateFrom: from, dateTo: to })!)).toEqual({ ok: false, reason: "contract-error" }); expect(hidden).not.toHaveBeenCalled();
});
it("checks owner before requested accounting/date fields and keeps unfiltered accounting unread", () => {
  const hidden = jest.fn(() => { throw new Error("Unverified source field read"); }), raw = archiveDocument({ ownerOrganizationId: archiveId(99) });
  for (const key of ["accountingStatus", "documentDate"]) Object.defineProperty(raw, key, { get: hidden });
  expect(decodeArchivePage(archivePage([raw]), archiveScope, parseArchiveInput({ accountingStatus: "REVIEWED", dateFrom: from })!)).toEqual({ ok: false, reason: "visibility-unverified" }); expect(hidden).not.toHaveBeenCalled();
  const own = archiveDocument(); Object.defineProperty(own, "accountingStatus", { get: hidden }); expect(decodeArchivePage(archivePage([own]), archiveScope, parseArchiveInput({ dateFrom: from })!).ok).toBe(true); expect(hidden).not.toHaveBeenCalled();
});
it("freezes normalized filter query for exact refresh while summary remains independent and unfiltered", async () => {
  const list = jest.fn<NonNullable<DocumentArchiveFixtureClient["documentArchiveFixture"]>>().mockResolvedValue(archivePage([archiveDocument({ accountingStatus: "REVIEWED" })]));
  const summary = jest.fn<NonNullable<DocumentArchiveFixtureClient["documentArchiveSummaryFixture"]>>().mockResolvedValue(archiveSummary());
  const input = { accountingStatus: "REVIEWED" as const, dateFrom: from, dateTo: to }, model = createDocumentArchiveFixtureRead(archiveScope, { documentArchiveFixture: list, documentArchiveSummaryFixture: summary });
  await model.load({ kind: "document-archive", input }); input.dateFrom = "2027-01-01T00:00:00Z"; await model.refresh();
  expect(list).toHaveBeenLastCalledWith(archiveScope, { accountingStatus: "REVIEWED", dateFrom: from, dateTo: to, limit: 25 }); expect(Object.isFrozen(list.mock.calls[1]![1])).toBe(true);
  expect(summary).toHaveBeenLastCalledWith(archiveScope); expect(summary.mock.calls[1]).toHaveLength(1); expect(model.getState()).toMatchObject({ read: { value: { summary: { total: 120 } } } });
});
it("does not expand counterparty/order input or accept malformed current query filters", async () => {
  const list = jest.fn<NonNullable<DocumentArchiveFixtureClient["documentArchiveFixture"]>>(), model = createDocumentArchiveFixtureRead(archiveScope, { documentArchiveFixture: list });
  for (const input of [{ counterpartyOrganizationId: archiveId(1) }, { supplierOrderId: archiveId(2) }, { accountingStatus: "FUTURE" }, { dateFrom: from, dateTo: "2026-01-01T00:00:00Z" }]) {
    await model.load({ kind: "document-archive", input: input as never }); expect(model.getState()).toEqual({ phase: "contract-error" });
  }
  expect(list).not.toHaveBeenCalled();
});
