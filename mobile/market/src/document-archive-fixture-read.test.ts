import { jest } from "@jest/globals";
import { documentArchiveCategorySchema, documentArchiveItemSchema, documentArchiveKindSchema, documentArchivePageResponseSchema, documentArchiveQuerySchema, documentArchiveSummaryResponseSchema } from "../../../packages/schemas/src/core-api";
import { createDocumentArchiveFixtureRead, decodeArchiveDocument, decodeArchivePage, parseArchiveInput, archiveDefaultLimit, type DocumentArchiveFixtureClient } from "./document-archive-fixture-read";
import { archiveDocument, archiveDocumentId, archiveId, archivePage, archiveScope, archiveSummary, archiveEnvelope } from "./test-fixtures/document-archive";
import { archiveCategoryLabel, archiveKindLabel, archiveSourceLabel, archiveStatusLabel, archiveViewLabel } from "./document-archive-i18n";
const query = { kind: "document-archive", input: {} } as const, detail = { kind: "archive-document", documentId: archiveDocumentId } as const;
function ports() { return { documentArchiveFixture: jest.fn<NonNullable<DocumentArchiveFixtureClient["documentArchiveFixture"]>>().mockImplementation(async () => archivePage()), documentArchiveSummaryFixture: jest.fn<NonNullable<DocumentArchiveFixtureClient["documentArchiveSummaryFixture"]>>().mockImplementation(async () => archiveSummary()), archiveDocumentFixture: jest.fn<NonNullable<DocumentArchiveFixtureClient["archiveDocumentFixture"]>>().mockImplementation(async () => archiveDocument()) }; }
it("conforms synthetic full rows/page/summary to actual shared response schemas, independent of safe projection", () => {
  expect(documentArchiveItemSchema.safeParse(archiveDocument()).success).toBe(true); expect(documentArchivePageResponseSchema.safeParse(archivePage()).success).toBe(true); expect(documentArchiveSummaryResponseSchema.safeParse(archiveSummary()).success).toBe(true);
  expect(archiveDefaultLimit).toBe(documentArchiveQuerySchema.parse({}).limit); expect(archiveDefaultLimit).toBe(25);
});
it("uses exhaustive actual closed enum vocabulary with separate RU/KK labels", () => {
  for (const locale of ["ru", "kk"] as const) {
    for (const value of documentArchiveCategorySchema.options) expect(archiveCategoryLabel(value, locale)).not.toBe(value);
    for (const value of documentArchiveKindSchema.options) expect(archiveKindLabel(value, locale)).not.toBe(value);
    for (const value of documentArchiveItemSchema.shape.status.options) expect(archiveStatusLabel(value, locale)).not.toBe(value);
    for (const value of documentArchiveItemSchema.shape.source.options) expect(archiveSourceLabel(value, locale)).not.toBe(value);
    for (const value of documentArchiveQuerySchema.shape.view.unwrap().options) expect(archiveViewLabel(value, locale)).not.toBe(value);
  }
});
it("normalizes query using actual defaults/coercion/trimming and freezes only supported fields", () => {
  expect(parseArchiveInput({ q: "  SYNTHETIC поиск  ", limit: "1", view: "ATTENTION", kind: "INVOICE", status: "GENERATED", category: "PAYMENT", cursor: archiveId(950) })).toEqual({ q: "SYNTHETIC поиск", limit: 1, view: "ATTENTION", kind: "INVOICE", status: "GENERATED", category: "PAYMENT", cursor: archiveId(950) }); expect(Object.isFrozen(parseArchiveInput({}))).toBe(true);
  expect(parseArchiveInput({ q: "x".repeat(120), limit: 100 })).not.toBeNull();
});
it.each([null, [], { q: "x".repeat(121) }, { limit: 0 }, { limit: 101 }, { limit: 1.5 }, { cursor: "wrong" }, { status: "FUTURE" }, { category: "FUTURE" }, { kind: "FUTURE" }, { view: "FUTURE" }, { accountingStatus: "FUTURE" }, { dateFrom: "2026-01-01" }, { supplierOrderId: archiveId(1) }, { extra: true }])("rejects unsupported/malformed query %j without request", async input => {
  expect(parseArchiveInput(input)).toBeNull(); const api = ports(), model = createDocumentArchiveFixtureRead(archiveScope, api); await model.load({ ...query, input: input as never }); expect(model.getState()).toEqual({ phase: "contract-error" }); expect(api.documentArchiveFixture).not.toHaveBeenCalled();
});
it("projects safe fields without reading money/BIN/names/signers/versions/hash/relations/storage/URLs", () => {
  const raw = archiveDocument(), hidden = jest.fn(() => { throw new Error("Private field read"); });
  for (const key of ["amountMinor", "currency", "accountingStatus", "checksumSha256", "baseAgreementDocumentId", "supplierOrder", "paymentIntent", "paymentTransaction", "refund", "signatures", "versions", "storageKey", "downloadUrl", "metadata"]) Object.defineProperty(raw, key, { get: hidden });
  for (const key of ["bin", "displayName", "legalName"]) Object.defineProperty(raw.participants[0]!.organization, key, { get: hidden });
  const decoded = decodeArchiveDocument(raw, archiveScope, raw.id); expect(decoded.ok).toBe(true); expect(decodeArchivePage({ items: [raw], nextCursor: null }, archiveScope, parseArchiveInput({})!).ok).toBe(true); expect(hidden).not.toHaveBeenCalled();
  if (decoded.ok) { expect(Object.keys(decoded.value).sort()).toEqual(["id", "ownerOrganizationId", "category", "kind", "format", "source", "status", "title", "documentNumber", "documentDate", "version", "fileName", "immutableAt", "generatedAt", "expiresAt", "createdAt", "updatedAt"].sort()); expect(decoded.value.expiresAt).toBe("2020-01-01T00:00:00.000Z"); expect(decoded.value.status).toBe("SIGNED"); }
});
it.each(["foreign-owner", "participant-id", "requested-id", "duplicate", "bad-role", "bad-kind", "bad-status", "null-date", "missing-filename", "zero-version", "too-many"]) ("rejects %s before exposing any row; participation does not infer permission", variant => {
  const raw = archiveDocument(); let body: unknown = archivePage([raw]), id = raw.id;
  if (variant === "foreign-owner") { raw.ownerOrganizationId = archiveId(99); const hidden = jest.fn(() => { throw new Error("Foreign content"); }); Object.defineProperty(raw, "title", { get: hidden }); }
  if (variant === "participant-id") raw.participants[0]!.organization.id = archiveId(99);
  if (variant === "requested-id") id = archiveId(99);
  if (variant === "duplicate") body = archivePage([raw, raw]); if (variant === "bad-role") raw.participants[0]!.role = "ADMIN" as never;
  if (variant === "bad-kind") raw.kind = "FUTURE" as never; if (variant === "bad-status") raw.status = "FUTURE" as never; if (variant === "null-date") raw.documentDate = null as never; if (variant === "missing-filename") raw.fileName = undefined as never; if (variant === "zero-version") raw.version = 0; if (variant === "too-many") body = archivePage([raw, archiveDocument({ id: archiveId(999) })]);
  const result = variant === "requested-id" ? decodeArchiveDocument(raw, archiveScope, id) : decodeArchivePage(body, archiveScope, parseArchiveInput({ limit: variant === "too-many" ? 1 : 25 })!); expect(result).toEqual({ ok: false, reason: variant === "foreign-owner" ? "visibility-unverified" : "contract-error" });
});
it("does not require a fabricated OWNER participant, while checking all supplied participant identities", () => {
  expect(decodeArchiveDocument(archiveDocument({ participants: [] }), archiveScope, archiveDocumentId).ok).toBe(true); const raw = archiveDocument(); raw.participants[0]!.role = "RECIPIENT"; expect(decodeArchiveDocument(raw, archiveScope, raw.id).ok).toBe(true);
});
it("binds explicit kind/category/status filters but delegates q/view semantic matching to server", () => {
  const raw = archiveDocument(); for (const input of [{ category: "PAYMENT" }, { kind: "INVOICE" }, { status: "FAILED" }] as const) expect(decodeArchivePage(archivePage([raw]), archiveScope, parseArchiveInput(input)!)).toEqual({ ok: false, reason: "contract-error" }); expect(decodeArchivePage(archivePage([raw]), archiveScope, parseArchiveInput({ q: "BIN matches only excluded data", view: "ATTENTION" })!).ok).toBe(true);
});
it("keeps supplied independent unfiltered summary counters rather than deriving filtered page totals", async () => {
  const api = ports(), model = createDocumentArchiveFixtureRead(archiveScope, api); await model.load({ ...query, input: { q: "SYNTHETIC" } }); expect(model.getState()).toMatchObject({ phase: "ready", read: { value: { summary: archiveSummary(), page: { items: [expect.anything()] }, query: { q: "SYNTHETIC", limit: 25 } } } }); expect(api.documentArchiveSummaryFixture).toHaveBeenCalledWith(archiveScope); expect(api.documentArchiveSummaryFixture.mock.calls[0]).toHaveLength(1);
});
it.each(["absent", "denied", "invalid", "missing-category", "negative", "fraction"]) ("keeps valid page with honest unavailable summary for %s", async variant => {
  const api: DocumentArchiveFixtureClient = ports(); if (variant === "absent") delete api.documentArchiveSummaryFixture;
  else api.documentArchiveSummaryFixture = async () => { if (variant === "denied") throw archiveEnvelope(403); return variant === "invalid" ? null : variant === "missing-category" ? { ...archiveSummary(), byCategory: {} } : archiveSummary({ total: variant === "negative" ? -1 : 0.5 }); };
  const model = createDocumentArchiveFixtureRead(archiveScope, api); await model.load(query); expect(model.getState()).toMatchObject({ phase: "ready", read: { value: { summary: null, summaryIssue: variant === "absent" ? "unavailable" : variant === "denied" ? "denied" : "contract-error" } } });
});
it("summary authentication failure invalidates even a successful list", async () => {
  const api = ports(); api.documentArchiveSummaryFixture.mockRejectedValueOnce(archiveEnvelope(401)); const model = createDocumentArchiveFixtureRead(archiveScope, api); await model.load(query); expect(model.getState()).toEqual({ phase: "authentication-required" });
});
it.each(["valid", "short", "wrong-id", "self", "empty-next", "end"]) ("validates supplied opaque pagination without generating cursor for %s", async variant => {
  const api = ports(), next = variant === "end" ? null : variant === "wrong-id" ? archiveId(99) : archiveDocumentId; api.documentArchiveFixture.mockResolvedValueOnce(archivePage(variant === "empty-next" ? [] : [archiveDocument()], next)); const model = createDocumentArchiveFixtureRead(archiveScope, api); await model.load({ ...query, input: { limit: variant === "short" ? 2 : 1, ...(variant === "self" ? { cursor: archiveDocumentId } : {}) } }); expect(model.getState()).toMatchObject({ phase: variant === "empty-next" ? "empty" : "ready", read: { value: { page: { nextCursor: next }, pagination: ["valid", "end"].includes(variant) ? "provided" : "unconfirmed" } } });
});
it.each([[401, "authentication-required"], [403, "denied"], [404, "unavailable"], [429, "retry-limited"], [500, "error"]] as const)("maps structured %s safely for independent detail and list", async (status, phase) => {
  const api = ports(), model = createDocumentArchiveFixtureRead(archiveScope, api); api.documentArchiveFixture.mockRejectedValueOnce(archiveEnvelope(status)); await model.load(query); expect(model.getState()).toEqual({ phase }); api.archiveDocumentFixture.mockRejectedValueOnce(archiveEnvelope(status)); await model.load(detail); expect(model.getState()).toEqual({ phase }); expect(JSON.stringify(model.getState())).not.toContain("private");
});
it("missing ports, invalid targets, malformed envelopes and plain offline errors stay explicit", async () => {
  const model = createDocumentArchiveFixtureRead(archiveScope, {}); await model.load(query); expect(model.getState()).toEqual({ phase: "unavailable" }); await model.load(detail); expect(model.getState()).toEqual({ phase: "unavailable" }); await model.load({ ...detail, documentId: "bad" }); expect(model.getState()).toEqual({ phase: "contract-error" }); expect(await model.refresh()).toBe("no-query");
  const api = ports(), next = createDocumentArchiveFixtureRead(archiveScope, api); api.archiveDocumentFixture.mockRejectedValueOnce(new Error("SYNTHETIC private offline")).mockRejectedValueOnce({ ...archiveEnvelope(403), payload: archiveEnvelope(401).payload }); await next.load(detail); expect(next.getState()).toEqual({ phase: "error" }); await next.refresh(); expect(next.getState()).toEqual({ phase: "contract-error" });
});
it("freezes scope/query snapshot and refreshes exact normalized target without reusing mutable caller objects", async () => {
  const api = ports(), scope = { ...archiveScope }, input = { q: "  original  ", limit: 1 }, model = createDocumentArchiveFixtureRead(scope, api); const loading = model.load({ ...query, input }); scope.organizationId = archiveId(99); input.q = "changed"; await loading; await model.refresh(); expect(api.documentArchiveFixture).toHaveBeenLastCalledWith(archiveScope, { q: "original", limit: 1 }); expect(Object.isFrozen(api.documentArchiveFixture.mock.calls[0]![0])).toBe(true); expect(Object.isFrozen(api.documentArchiveFixture.mock.calls[0]![1])).toBe(true);
});
it("applies latest request only and reset ignores late payloads before reading any field", async () => {
  const api = ports(); let finish!: (body: unknown) => void; api.archiveDocumentFixture.mockImplementationOnce(() => new Promise(yes => { finish = yes; })); const model = createDocumentArchiveFixtureRead(archiveScope, api), old = model.load(detail); await model.load(query); const hidden = jest.fn(() => { throw new Error("Stale read"); }), raw = {}; Object.defineProperty(raw, "id", { get: hidden }); finish(raw); expect(await old).toBe("discarded"); expect(hidden).not.toHaveBeenCalled(); expect(model.getState()).toMatchObject({ phase: "ready", read: { kind: "document-archive" } });
  api.archiveDocumentFixture.mockImplementationOnce(() => new Promise(yes => { finish = yes; })); const pending = model.load(detail); model.reset(); finish(raw); expect(await pending).toBe("discarded"); expect(model.getState()).toEqual({ phase: "idle" });
});
it("prevents same-document version downgrade during refresh, while list/other identity/error clears accepted metadata", async () => {
  const api = ports(), model = createDocumentArchiveFixtureRead(archiveScope, api); await model.load(detail); api.archiveDocumentFixture.mockResolvedValueOnce(archiveDocument({ version: 2, title: "SYNTHETIC stale" })); await model.refresh(); expect(model.getState()).toMatchObject({ read: { value: { version: 3, title: "SYNTHETIC registry document" } } }); await model.load(query); api.archiveDocumentFixture.mockResolvedValueOnce(archiveDocument({ version: 2 })); await model.load(detail); expect(model.getState()).toMatchObject({ read: { value: { version: 2 } } });
});

it("summary 401 outranks a page denial and late rejected detail is discarded before error decoding", async () => {
  const api = ports(); api.documentArchiveFixture.mockRejectedValueOnce(archiveEnvelope(403)); api.documentArchiveSummaryFixture.mockRejectedValueOnce(archiveEnvelope(401)); const model = createDocumentArchiveFixtureRead(archiveScope, api); await model.load(query); expect(model.getState()).toEqual({ phase: "authentication-required" });
  let reject!: (error: unknown) => void; api.archiveDocumentFixture.mockImplementationOnce(() => new Promise((_yes, no) => { reject = no; })); const pending = model.load(detail), hidden = jest.fn(() => { throw new Error("Stale error read"); }), raw = {}; Object.defineProperty(raw, "status", { get: hidden }); Object.defineProperty(raw, "payload", { get: hidden }); model.reset(); reject(raw); expect(await pending).toBe("discarded"); expect(hidden).not.toHaveBeenCalled(); expect(model.getState()).toEqual({ phase: "idle" });
});
