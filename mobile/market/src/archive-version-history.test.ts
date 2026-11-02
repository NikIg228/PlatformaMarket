import { jest } from "@jest/globals";
import { documentArchiveItemSchema } from "../../../packages/schemas/src/core-api";
import { createDocumentArchiveFixtureRead, type DocumentArchiveFixtureClient } from "./document-archive-fixture-read";
import { archiveDocumentId, archiveEnvelope, archiveId, archiveScope } from "./test-fixtures/document-archive";
import { versionDocument } from "./test-fixtures/archive-version-history";
const detail = { kind: "archive-document", documentId: archiveDocumentId } as const;
function setup() {
  const port = jest.fn<NonNullable<DocumentArchiveFixtureClient["archiveDocumentFixture"]>>().mockImplementation(async () => versionDocument());
  const model = createDocumentArchiveFixtureRead(archiveScope, { archiveDocumentFixture: port }); return { port, model };
}
async function selected() { const result = setup(); await result.model.load(detail); const target = result.model.selectHistory(); if (!target) throw new Error("Synthetic parent missing"); return { ...result, target }; }
it("uses actual shared version array, independently rereads exact parent and projects only source metadata in supplied order", async () => {
  const { port, model, target } = await selected(); expect(documentArchiveItemSchema.safeParse(versionDocument()).success).toBe(true); expect(port).toHaveBeenCalledTimes(1);
  const raw = versionDocument(), hidden = jest.fn(() => { throw new Error("Private metadata read"); });
  for (const key of ["checksumSha256", "amountMinor", "currency", "signatures", "paymentIntent", "metadata", "storageKey", "downloadUrl"]) Object.defineProperty(raw, key, { get: hidden });
  for (const row of raw.versions) for (const key of ["signerName", "fileBytes", "downloadUrl", "storageKey"]) Object.defineProperty(row, key, { get: hidden });
  port.mockResolvedValueOnce(raw); await model.load({ kind: "archive-history", target }); expect(port).toHaveBeenLastCalledWith(archiveScope, archiveDocumentId); expect(port).toHaveBeenCalledTimes(2); expect(hidden).not.toHaveBeenCalled();
  const state = model.getState(); expect(state).toMatchObject({ phase: "ready", read: { kind: "archive-history", value: { parent: { id: archiveDocumentId, version: 3 }, versions: versionDocument().versions } } });
  if ("read" in state && state.read.kind === "archive-history") expect(Object.keys(state.read.value.versions[0]!).sort()).toEqual(["id", "version", "status", "documentDate", "createdAt"].sort());
});
it.each(["id", "owner", "version", "updatedAt", "number", "status", "documentDate", "createdAt"])("rejects changed parent %s before reading versions", async field => {
  const { port, model, target } = await selected(), raw = versionDocument();
  if (field === "id") raw.id = archiveId(99); if (field === "owner") raw.ownerOrganizationId = archiveId(99); if (field === "version") raw.version++;
  if (field === "updatedAt") raw.updatedAt = "2026-10-30T01:02:03.000Z"; if (field === "number") raw.documentNumber = "SYNTHETIC another document"; if (field === "status") raw.status = "ARCHIVED";
  if (field === "documentDate") raw.documentDate = "2026-10-30T01:02:03.000Z"; if (field === "createdAt") raw.createdAt = "2026-10-30T01:02:03.000Z";
  const hidden = jest.fn(() => { throw new Error("Unbound history read"); }); Object.defineProperty(raw, "versions", { get: hidden }); port.mockResolvedValueOnce(raw); await model.load({ kind: "archive-history", target });
  expect(model.getState()).toEqual({ phase: field === "owner" ? "visibility-unverified" : field === "id" ? "contract-error" : "relation-unverified" }); expect(hidden).not.toHaveBeenCalled();
});
it.each(["duplicate", "version-zero", "invalid-id", "invalid-date", "missing-array", "parent-version", "parent-status", "parent-date"])("rejects malformed %s history whole without salvage", async field => {
  const { port, model, target } = await selected(), raw = versionDocument();
  if (field === "duplicate") raw.versions.push({ ...raw.versions[0]! }); if (field === "version-zero") raw.versions[1]!.version = 0; if (field === "invalid-id") raw.versions[1]!.id = "invalid";
  if (field === "invalid-date") raw.versions[1]!.createdAt = "not-a-date"; if (field === "missing-array") delete (raw as Partial<typeof raw>).versions;
  if (field === "parent-version") raw.versions[0]!.version--; if (field === "parent-status") raw.versions[0]!.status = "ARCHIVED"; if (field === "parent-date") raw.versions[0]!.documentDate = "2026-10-30T01:02:03.000Z";
  port.mockResolvedValueOnce(raw); await model.load({ kind: "archive-history", target }); expect(model.getState()).toEqual({ phase: "contract-error" });
});
it("permits actual empty/open-status/noncontinuous/tied version array without fabricating current row, sorting or cap", async () => {
  const { port, model, target } = await selected(), raw = versionDocument(); raw.versions = [];
  port.mockResolvedValueOnce(raw); await model.load({ kind: "archive-history", target }); expect(model.getState()).toMatchObject({ phase: "empty", read: { value: { versions: [] } } });
  raw.versions = Array.from({ length: 301 }, (_, i) => ({ id: archiveId(1800 + i), version: 5, status: "SYNTHETIC_FUTURE_STATUS", documentDate: raw.documentDate, createdAt: raw.createdAt })); port.mockResolvedValueOnce(raw); await model.refresh();
  expect(model.getState()).toMatchObject({ phase: "ready", read: { value: { versions: raw.versions } } });
});
it("does not infer selection from forged/copied/other-reader targets and invalidates targets on reset/list", async () => {
  const { port, model, target } = await selected();
  for (const bad of [{ ...target }, { ...target, documentId: archiveId(99) }]) { await model.load({ kind: "archive-history", target: bad }); expect(model.getState()).toEqual({ phase: "contract-error" }); }
  const other = setup(); await other.model.load({ kind: "archive-history", target }); expect(other.port).not.toHaveBeenCalled(); expect(port).toHaveBeenCalledTimes(1);
  model.reset(); await model.load({ kind: "archive-history", target }); expect(port).toHaveBeenCalledTimes(1);
  await model.load(detail); const next = model.selectHistory()!; await model.load({ kind: "document-archive", input: {} }); await model.load({ kind: "archive-history", target: next }); expect(port).toHaveBeenCalledTimes(2);
});
it.each([[401, "authentication-required"], [403, "denied"], [404, "unavailable"], [429, "retry-limited"], [500, "error"]] as const)("maps existing parent read %s and retries same target", async (status, phase) => {
  const { port, model, target } = await selected(); port.mockRejectedValueOnce(archiveEnvelope(status)); await model.load({ kind: "archive-history", target }); expect(model.getState()).toEqual({ phase }); await model.refresh(); expect(model.getState()).toMatchObject({ read: { kind: "archive-history" } }); expect(port).toHaveBeenLastCalledWith(archiveScope, archiveDocumentId);
});
it("rejects same-response row downgrade on refresh rather than substituting a stale historical list", async () => {
  const { port, model, target } = await selected(); const raw = versionDocument(); raw.versions[1]!.version = 2; port.mockResolvedValueOnce(raw); await model.load({ kind: "archive-history", target }); port.mockResolvedValueOnce(versionDocument()); await model.refresh(); expect(model.getState()).toEqual({ phase: "contract-error" });
});
it.each(["reset", "other-read"])("discards late history before decode after %s", async kind => {
  const { port, model, target } = await selected(); let finish!: (body: unknown) => void; port.mockImplementationOnce(() => new Promise(yes => { finish = yes; })); const pending = model.load({ kind: "archive-history", target });
  if (kind === "reset") model.reset(); else await model.load(detail);
  const hidden = jest.fn(() => { throw new Error("Late body accessed"); }), raw = {}; Object.defineProperty(raw, "id", { get: hidden }); finish(raw); expect(await pending).toBe("discarded"); expect(hidden).not.toHaveBeenCalled();
});
