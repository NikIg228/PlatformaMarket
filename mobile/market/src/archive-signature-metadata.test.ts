import { jest } from "@jest/globals";
import { documentArchiveSignatureSchema } from "../../../packages/schemas/src/core-api";
import { decodeArchiveSignatureMetadata } from "./archive-signature-metadata";
import { archiveSignatureMethodLabel, archiveSignatureStatusLabel } from "./ArchiveSignatureMetadata";
import { createDocumentArchiveFixtureRead, type DocumentArchiveFixtureClient } from "./document-archive-fixture-read";
import { archiveDocumentId, archiveEnvelope, archiveId, archiveScope } from "./test-fixtures/document-archive";
import { versionDocument } from "./test-fixtures/archive-version-history";
async function setup() {
  const port = jest.fn<NonNullable<DocumentArchiveFixtureClient["archiveDocumentFixture"]>>().mockImplementation(async () => versionDocument()), model = createDocumentArchiveFixtureRead(archiveScope, { archiveDocumentFixture: port });
  await model.load({ kind: "archive-document", documentId: archiveDocumentId }); return { port, model, target: model.selectSignatures()! };
}
it("projects only actual signature id/method/status/nullable time without reading names, party IDs, evidence, sessions or private bytes", async () => {
  const { port, model, target } = await setup(), raw = versionDocument(), hidden = jest.fn(() => { throw new Error("Private signature field read"); });
  expect(documentArchiveSignatureSchema.safeParse(raw.signatures[0]).success).toBe(true);
  for (const row of raw.signatures) for (const key of ["signerName", "signerOrganizationId", "cms", "certificate", "authority", "sessionId", "downloadUrl", "fileBytes"]) Object.defineProperty(row, key, { get: hidden });
  for (const key of ["versions", "checksumSha256", "amountMinor", "storageKey", "metadata"]) Object.defineProperty(raw, key, { get: hidden });
  port.mockResolvedValueOnce(raw); await model.load({ kind: "archive-signatures", target }); expect(port).toHaveBeenCalledTimes(2); expect(port).toHaveBeenLastCalledWith(archiveScope, archiveDocumentId); expect(hidden).not.toHaveBeenCalled();
  const state = model.getState(); expect(state).toMatchObject({ read: { kind: "archive-signatures", value: { signatures: [{ id: archiveId(931), method: "MOCK", status: "SIGNED", signedAt: "2026-10-28T01:02:03.000Z" }] } } }); if ("read" in state && state.read.kind === "archive-signatures") expect(Object.keys(state.read.value.signatures[0]!).sort()).toEqual(["id", "method", "status", "signedAt"].sort());
});
it("localizes every actual closed method/status without treating MOCK or SIGNED as legal/crypto evidence", () => {
  for (const locale of ["ru", "kk"] as const) {
    for (const value of documentArchiveSignatureSchema.shape.method.options) expect(archiveSignatureMethodLabel(value, locale)).not.toBe(value);
    for (const value of documentArchiveSignatureSchema.shape.status.options) expect(archiveSignatureStatusLabel(value, locale)).not.toBe(value);
  }
});
it.each(["owner", "version"])("rejects changed parent %s before signature fields", async field => {
  const { port, model, target } = await setup(), raw = versionDocument(), hidden = jest.fn(() => { throw new Error("Unbound signatures"); }); if (field === "owner") raw.ownerOrganizationId = archiveId(99); else raw.version++;
  Object.defineProperty(raw, "signatures", { get: hidden }); port.mockResolvedValueOnce(raw); await model.load({ kind: "archive-signatures", target }); expect(model.getState()).toEqual({ phase: field === "owner" ? "visibility-unverified" : "relation-unverified" }); expect(hidden).not.toHaveBeenCalled();
});
it.each(["duplicate", "unknown-method", "unknown-status", "bad-date", "missing", "null-row"])("rejects malformed %s signature response whole", async field => {
  const raw = versionDocument(); if (field === "duplicate") raw.signatures.push({ ...raw.signatures[0]! }); if (field === "unknown-method") raw.signatures[0]!.method = "FUTURE" as never; if (field === "unknown-status") raw.signatures[0]!.status = "FUTURE" as never; if (field === "bad-date") raw.signatures[0]!.signedAt = "not-a-date"; if (field === "missing") delete (raw as Partial<typeof raw>).signatures; if (field === "null-row") raw.signatures.push(null as never); expect(decodeArchiveSignatureMetadata(raw)).toBeNull();
});
it("retains empty/null-time/source order/all rows and accepts fresh statuses without a fabricated monotonic state machine", async () => {
  const { port, model, target } = await setup(), raw = versionDocument(); raw.signatures = []; port.mockResolvedValueOnce(raw); await model.load({ kind: "archive-signatures", target }); expect(model.getState()).toMatchObject({ phase: "empty", read: { value: { signatures: [] } } });
  raw.signatures = Array.from({ length: 301 }, (_, i) => ({ id: archiveId(2400 + i), method: "MOCK", status: "SIGNED", signedAt: null, signerOrganizationId: null, signerName: null })); port.mockResolvedValueOnce(raw); await model.refresh(); expect(model.getState()).toMatchObject({ read: { value: { signatures: raw.signatures.map(({ id, method, status, signedAt }) => ({ id, method, status, signedAt })) } } }); raw.signatures[0]!.status = "REJECTED"; port.mockResolvedValueOnce(raw); await model.refresh(); expect(model.getState()).toMatchObject({ read: { value: { signatures: [expect.objectContaining({ status: "REJECTED" }), ...raw.signatures.slice(1).map(({ id, method, status, signedAt }) => ({ id, method, status, signedAt }))] } } });
});
it("rejects copied and version-history selections, then invalidates signature selections on reset", async () => {
  const { port, model, target } = await setup(), history = model.selectHistory()!; for (const bad of [{ ...target }, history]) { await model.load({ kind: "archive-signatures", target: bad }); expect(model.getState()).toEqual({ phase: "contract-error" }); } expect(port).toHaveBeenCalledTimes(1); model.reset(); await model.load({ kind: "archive-signatures", target }); expect(port).toHaveBeenCalledTimes(1);
});
it("discards late signature response before reading private data when another read wins", async () => {
  const { port, model, target } = await setup(); let finish!: (value: unknown) => void; port.mockImplementationOnce(() => new Promise(yes => { finish = yes; })); const pending = model.load({ kind: "archive-signatures", target }); await model.load({ kind: "archive-document", documentId: archiveDocumentId }); const hidden = jest.fn(() => { throw new Error("Late signatures"); }), raw = {}; Object.defineProperty(raw, "id", { get: hidden }); finish(raw); expect(await pending).toBe("discarded"); expect(hidden).not.toHaveBeenCalled();
});
it.each([[401, "authentication-required"], [403, "denied"]] as const)("keeps existing %s read boundary and retries exact parent", async (code, phase) => {
  const { port, model, target } = await setup(); port.mockRejectedValueOnce(archiveEnvelope(code)); await model.load({ kind: "archive-signatures", target }); expect(model.getState()).toEqual({ phase }); await model.refresh(); expect(port).toHaveBeenLastCalledWith(archiveScope, archiveDocumentId); expect(model.getState()).toMatchObject({ read: { kind: "archive-signatures" } });
});
