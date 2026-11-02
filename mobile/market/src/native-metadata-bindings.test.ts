import { createDocumentArchiveFixtureRead, parseArchiveInput } from "./document-archive-fixture-read";
import type { ArchiveBaseSelection } from "./document-archive-links";
import type { ArchiveHistorySelection } from "./archive-version-history";
import { archiveDocument, archivePage, archiveSummary, archiveScope, archiveDocumentId } from "./test-fixtures/document-archive";
import { bindMarketReads } from "./market-transport";
import { cityScope, cityFixture } from "./test-fixtures/public-cities";
import { createPublicCitiesFixtureRead } from "./public-cities-fixture-read";
import { listDraftId } from "./test-fixtures/list-draft";

it("binds existing city GET without leaking scope IDs into its public query", async () => {
  const read = jest.fn(async (_path: string): Promise<unknown> => cityFixture());
  const client = bindMarketReads(read, cityScope.organizationId);
  const model = createPublicCitiesFixtureRead(cityScope, client.publicCitiesFixture);
  await model.load(); expect(model.getState()).toMatchObject({ phase: "ready" });
  expect(read).toHaveBeenCalledWith("/catalog/cities"); expect(read).toHaveBeenCalledTimes(1);
});
it("rejects a replaced organization before the bound city GET", () => {
  const read = jest.fn(async (_path: string): Promise<unknown> => cityFixture());
  const client = bindMarketReads(read, cityScope.organizationId);
  expect(() => client.publicCitiesFixture!({ ...cityScope, organizationId: listDraftId(99) })).toThrow("Read context changed");
  expect(read).not.toHaveBeenCalled();
});
it("keeps malformed native-bound directory as a contract error, with no sample fallback", async () => {
  const read = jest.fn(async (_path: string): Promise<unknown> => [{ id: cityFixture()[0]!.id }]);
  const client = bindMarketReads(read, cityScope.organizationId), model = createPublicCitiesFixtureRead(cityScope, client.publicCitiesFixture);
  await model.load(); expect(model.getState()).toEqual({ phase: "contract-error" });
});

it("forwards only validated existing archive query fields and exact metadata GET paths", async () => {
  const read = jest.fn(async (_path: string): Promise<unknown> => null), client = bindMarketReads(read, archiveScope.organizationId);
  const input = parseArchiveInput({ q: "synthetic & /", view: "ATTENTION", category: "ORDER", kind: "ORDER_SPECIFICATION", status: "SIGNED", accountingStatus: "REVIEWED", dateFrom: "2026-10-28T00:00:00.000Z", dateTo: "2026-10-29T00:00:00.000Z", cursor: listDraftId(998), limit: 1 })!;
  await client.documentArchiveFixture!(archiveScope, input); await client.documentArchiveSummaryFixture!(archiveScope); await client.archiveDocumentFixture!(archiveScope, archiveDocumentId);
  const url = new URL(read.mock.calls[0]![0], "https://synthetic.example.invalid");
  expect(Object.fromEntries(url.searchParams)).toEqual(Object.fromEntries(Object.entries(input).map(([k, v]) => [k, String(v)])));
  expect(read.mock.calls.slice(1).map(([path]) => path)).toEqual(["/documents/archive/summary", `/documents/archive/${archiveDocumentId}`]);
});
it.each(["documentArchiveFixture", "documentArchiveSummaryFixture", "archiveDocumentFixture"] as const)("rejects changed organization before native %s read", method => {
  const read = jest.fn(async (_path: string): Promise<unknown> => null), client = bindMarketReads(read, archiveScope.organizationId), scope = { ...archiveScope, organizationId: listDraftId(99) };
  expect(() => method === "documentArchiveFixture" ? client[method]!(scope, parseArchiveInput({})!) : method === "archiveDocumentFixture" ? client[method]!(scope, archiveDocumentId) : client[method]!(scope)).toThrow("Read context changed"); expect(read).not.toHaveBeenCalled();
});
it("rejects invalid UUID and undeclared archive selectors before the native GET", () => {
  const read = jest.fn(async (_path: string): Promise<unknown> => null), client = bindMarketReads(read, archiveScope.organizationId);
  expect(() => client.archiveDocumentFixture!(archiveScope, "../private/download")).toThrow("Invalid archive document");
  expect(() => client.documentArchiveFixture!(archiveScope, { ...parseArchiveInput({})!, supplierOrderId: listDraftId(998) } as never)).toThrow("Invalid archive query"); expect(read).not.toHaveBeenCalled();
});
function metadataOnlyClient(read: Parameters<typeof bindMarketReads>[0]) { const bound=bindMarketReads(read,archiveScope.organizationId);return {archiveMetadataOnly:true as const,documentArchiveFixture:bound.documentArchiveFixture,documentArchiveSummaryFixture:bound.documentArchiveSummaryFixture,archiveDocumentFixture:bound.archiveDocumentFixture}; }
it("owner metadata mode never inspects links, signatures, version bodies, money or original locators", async () => {
  const row = archiveDocument(), hidden = jest.fn(() => { throw new Error("Excluded native archive content read"); });
  for (const key of ["baseAgreementDocumentId", "supplierOrder", "paymentIntent", "paymentTransaction", "refund", "signatures", "versions", "amountMinor", "currency", "checksumSha256", "downloadUrl"]) Object.defineProperty(row, key, { get: hidden });
  const read = jest.fn(async (path: string): Promise<unknown> => path.includes("?limit=") ? archivePage([row]) : path.endsWith("/summary") ? archiveSummary() : row);
  const model = createDocumentArchiveFixtureRead(archiveScope, metadataOnlyClient(read));
  await model.load({ kind: "document-archive", input: {} }); expect(model.getState()).toMatchObject({ phase: "ready" });
  await model.load({ kind: "archive-document", documentId: archiveDocumentId }); expect(model.getState()).toMatchObject({ phase: "ready", read: { kind: "archive-document", links: { base: { state: "unsupported" }, order: { state: "unsupported" } } } });
  expect(model.selectHistory()).toBeNull(); expect(model.selectSignatures()).toBeNull(); expect(model.selectParticipants()).toBeNull(); expect(hidden).not.toHaveBeenCalled();
});
it("checks native detail owner identity before reading public title or private fields", async () => {
  const row = archiveDocument({ ownerOrganizationId: listDraftId(99) }), hidden = jest.fn(() => { throw new Error("Non-owner content read"); }); Object.defineProperty(row, "title", { get: hidden });
  const read = jest.fn(async (_path: string): Promise<unknown> => row), model = createDocumentArchiveFixtureRead(archiveScope, bindMarketReads(read, archiveScope.organizationId));
  await model.load({ kind: "archive-document", documentId: archiveDocumentId }); expect(model.getState()).toEqual({ phase: "visibility-unverified" }); expect(hidden).not.toHaveBeenCalled();
});
it.each(["archive-related", "archive-history", "archive-signatures", "archive-participants"] as const)("explicit metadata-only mode blocks retained/forged %s before any transport", async kind => {
  const read = jest.fn(async (_path: string): Promise<unknown> => archiveDocument()), model = createDocumentArchiveFixtureRead(archiveScope, metadataOnlyClient(read));
  if (kind === "archive-related") await model.load({ kind, target: {} as ArchiveBaseSelection }); else await model.load({ kind, target: {} as ArchiveHistorySelection });
  expect(model.getState()).toEqual({ phase: "unavailable" }); expect(read).not.toHaveBeenCalled();
});
it("discards a late native archive detail before decoding after reset", async () => {
  let finish!: (body: unknown) => void;
  const read = jest.fn((_path: string): Promise<unknown> => new Promise(yes => { finish = yes; })), model = createDocumentArchiveFixtureRead(archiveScope, bindMarketReads(read, archiveScope.organizationId));
  const pending = model.load({ kind: "archive-document", documentId: archiveDocumentId }); model.reset();
  const hidden = jest.fn(() => { throw new Error("Stale native archive read"); }), row = {}; Object.defineProperty(row, "id", { get: hidden }); finish(row);
  expect(await pending).toBe("discarded"); expect(model.getState()).toEqual({ phase: "idle" }); expect(hidden).not.toHaveBeenCalled();
});
