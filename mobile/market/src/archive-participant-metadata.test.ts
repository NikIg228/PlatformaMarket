import { jest } from "@jest/globals";
import { documentArchiveParticipantSchema } from "../../../packages/schemas/src/core-api";
import { decodeArchiveParticipantMetadata } from "./archive-participant-metadata";
import { archiveParticipantRoleLabel } from "./ArchiveParticipantMetadata";
import { createDocumentArchiveFixtureRead, type DocumentArchiveFixtureClient } from "./document-archive-fixture-read";
import { archiveDocumentId, archiveId, archiveScope } from "./test-fixtures/document-archive";
import { versionDocument } from "./test-fixtures/archive-version-history";
async function setup() { const port = jest.fn<NonNullable<DocumentArchiveFixtureClient["archiveDocumentFixture"]>>().mockImplementation(async () => versionDocument()), model = createDocumentArchiveFixtureRead(archiveScope, { archiveDocumentFixture: port }); await model.load({ kind: "archive-document", documentId: archiveDocumentId }); return { port, model, target: model.selectParticipants()! }; }
it("independently reads supplied organization names and actual roles without reading BIN/legal name, signer identity or private evidence", async () => {
  const { port, model, target } = await setup(), raw = versionDocument(), hidden = jest.fn(() => { throw new Error("Private participant data read"); }); raw.participants[0]!.organization.displayName = "  SYNTHETIC source organization  ";
  expect(documentArchiveParticipantSchema.safeParse(raw.participants[0]).success).toBe(true);
  for (const key of ["bin", "legalName", "bankAccount", "director", "personalData"]) Object.defineProperty(raw.participants[0]!.organization, key, { get: hidden }); for (const key of ["signatures", "versions", "amountMinor", "checksumSha256", "storageKey"]) Object.defineProperty(raw, key, { get: hidden });
  port.mockResolvedValueOnce(raw); await model.load({ kind: "archive-participants", target }); expect(port).toHaveBeenCalledTimes(2); expect(port).toHaveBeenLastCalledWith(archiveScope, archiveDocumentId); expect(hidden).not.toHaveBeenCalled(); expect(model.getState()).toMatchObject({ read: { kind: "archive-participants", value: { participants: [{ organizationId: archiveScope.organizationId, role: "OWNER", displayName: "  SYNTHETIC source organization  " }] } } });
});
it("localizes every actual role without changing its source value or implying an authority grant", () => {
  for (const locale of ["ru", "kk"] as const) for (const role of documentArchiveParticipantSchema.shape.role.options) expect(archiveParticipantRoleLabel(role, locale)).not.toBe(role);
});
it.each(["owner", "version"])("rejects changed parent %s before participant names", async field => {
  const { port, model, target } = await setup(), raw = versionDocument(), hidden = jest.fn(() => { throw new Error("Unbound participant label"); }); if (field === "owner") raw.ownerOrganizationId = archiveId(99); else raw.version++;
  Object.defineProperty(raw.participants[0]!.organization, "displayName", { get: hidden }); port.mockResolvedValueOnce(raw); await model.load({ kind: "archive-participants", target }); expect(model.getState()).toEqual({ phase: field === "owner" ? "visibility-unverified" : "relation-unverified" }); expect(hidden).not.toHaveBeenCalled();
});
it.each(["mismatched-id", "invalid-id", "unknown-role"])("rejects %s before reading any organization's label", field => {
  const raw = versionDocument(), hidden = jest.fn(() => { throw new Error("Identity not checked"); }); if (field === "mismatched-id") raw.participants[0]!.organization.id = archiveId(99); if (field === "invalid-id") raw.participants[0]!.organizationId = "invalid"; if (field === "unknown-role") raw.participants[0]!.role = "ADMIN" as never;
  Object.defineProperty(raw.participants[0]!.organization, "displayName", { get: hidden }); expect(decodeArchiveParticipantMetadata(raw)).toBeNull(); expect(hidden).not.toHaveBeenCalled();
});
it("preserves supplied empty, repeated, foreign-party and multiple-role rows without fabricating owner or permission filters", async () => {
  const { port, model, target } = await setup(), raw = versionDocument(); raw.participants = []; port.mockResolvedValueOnce(raw); await model.load({ kind: "archive-participants", target }); expect(model.getState()).toMatchObject({ phase: "empty", read: { value: { participants: [] } } });
  const other = { organizationId: archiveId(99), role: "SIGNER" as const, organization: { id: archiveId(99), displayName: "SYNTHETIC participant", legalName: "SYNTHETIC excluded", bin: "000000000000" } }; raw.participants = [other, { ...other, role: "RECIPIENT" }, other]; port.mockResolvedValueOnce(raw); await model.refresh(); expect(model.getState()).toMatchObject({ read: { value: { participants: [{ role: "SIGNER" }, { role: "RECIPIENT" }, { role: "SIGNER" }] } } });
});
it("rejects malformed labels whole without falling back to legal names or partly salvaging participants", () => {
  const raw = versionDocument(); raw.participants.push({ ...raw.participants[0]!, organization: { ...raw.participants[0]!.organization, displayName: null as never } }); expect(decodeArchiveParticipantMetadata(raw)).toBeNull(); expect(decodeArchiveParticipantMetadata({ participants: null })).toBeNull();
});
it("rejects copied/history/signature selections and invalidates the participant selection on reset", async () => {
  const { port, model, target } = await setup(), history = model.selectHistory()!, signature = model.selectSignatures()!;
  for (const bad of [{ ...target }, history, signature]) { await model.load({ kind: "archive-participants", target: bad }); expect(model.getState()).toEqual({ phase: "contract-error" }); } expect(port).toHaveBeenCalledTimes(1); model.reset(); await model.load({ kind: "archive-participants", target }); expect(port).toHaveBeenCalledTimes(1);
});
it("discards late participant response before reading organization names when a different read wins", async () => {
  const { port, model, target } = await setup(); let finish!: (body: unknown) => void; port.mockImplementationOnce(() => new Promise(yes => { finish = yes; })); const pending = model.load({ kind: "archive-participants", target }); await model.load({ kind: "archive-document", documentId: archiveDocumentId }); const hidden = jest.fn(() => { throw new Error("Late participants"); }), raw = {}; Object.defineProperty(raw, "id", { get: hidden }); finish(raw); expect(await pending).toBe("discarded"); expect(hidden).not.toHaveBeenCalled();
});
