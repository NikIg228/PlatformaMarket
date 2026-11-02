import { jest } from "@jest/globals";
import { createDocumentArchiveFixtureRead } from "./document-archive-fixture-read";
import { bindMarketReads, MarketHttpError } from "./market-transport";
import { archiveChildCaptureKinds, createArchiveChildCaptureKernel, selectArchiveChildCapture, type ArchiveChildCaptureKind } from "./test-fixtures/archive-child-capture-kernel";
import { archiveChildCaptureExample, type ArchiveChildCaptureExample } from "./test-fixtures/archive-child-capture-example";
import { replayArchiveChildCapture, type ArchiveChildCaptureReport } from "./test-fixtures/archive-child-capture-replay";
import { archiveDocument, archiveScope, archiveEnvelope } from "./test-fixtures/document-archive";
import { sourceDocument } from "./test-fixtures/archive-links";

const id = "00000000-0000-4000-8000-000000099951";
async function example(kind: ArchiveChildCaptureKind = "archive-history") { return JSON.parse(JSON.stringify(await archiveChildCaptureExample(kind))) as ArchiveChildCaptureExample; }
const doc = (input: ArchiveChildCaptureExample, index = 0) => input.records[index]!.body as ReturnType<typeof archiveDocument>;
function hidden(target: object, field: string) { const getter = jest.fn(() => { throw Error("SENSITIVE_ARCHIVE_CHILD_CAPTURE"); }); Object.defineProperty(target, field, { configurable: true, enumerable: true, get: getter }); return getter; }
function flags(report: ArchiveChildCaptureReport) {
  expect(Object.isFrozen(report)).toBe(true); expect(report).toMatchObject({ responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY", selectionProvenance: "SOURCE_ISSUED_OPAQUE_TARGET", nativeMetadataLimitChanged: false, nativeBindingPerformed: false, productionAuthorizationVerified: false, serverAccepted: false, originalFileBytesAccessed: false, originalChecksumVerified: false, cryptographicSignatureVerified: false, currentDocumentVersionInferred: false, credentialStoreAccessed: false, keyProviderAccessed: false, networkRequests: 0, mutations: 0 });
  expect(typeof report.fullSourceFixtureUsed).toBe("boolean"); if (report.syntheticGetCalls > 0) expect(report.fullSourceFixtureUsed).toBe(true);
  for (const key of ["scope", "expected", "records", "body", "documentId", "documentVersion", "title", "documentNumber", "fileName", "path", "versions", "signatures", "participants", "signerName", "checksumSha256", "error"]) expect(report).not.toHaveProperty(key);
  for (const text of ["SENSITIVE", "00000000-", "SYNTHETIC", "90071992547409931234"]) expect(JSON.stringify(report)).not.toContain(text);
}
afterEach(() => jest.restoreAllMocks());

it.each(archiveChildCaptureKinds)("saved %s metadata uses original source selection and preserves native limit", async kind => {
  const input = await archiveChildCaptureExample(kind), before = JSON.stringify(input), report = await replayArchiveChildCapture(input);
  expect(report).toMatchObject({ status: "CONSISTENT_METADATA", kind, parentPhase: "ready", consumerPhase: "ready", resultKind: kind === "archive-related" ? "archive-document" : kind, metadataRows: kind === "archive-history" ? 2 : 1, syntheticGetCalls: kind === "archive-related" ? 4 : 2, nativeMetadataLimitChanged: false, nativeBindingPerformed: false, originalFileBytesAccessed: false, originalChecksumVerified: false, cryptographicSignatureVerified: false, currentDocumentVersionInferred: false, serverAccepted: false });
  expect(JSON.stringify(input)).toBe(before);
  flags(report);
});
it("native child-only metadata binding issues only its three supported source selections", async () => {
  const body = sourceDocument(), scope = { ...archiveScope, environment: "https://market.example.invalid/api" }, bound = bindMarketReads(async () => body, scope.organizationId), client = { archiveMetadataOnly: true as const, archiveChildMetadata: bound.archiveChildMetadata, archiveDocumentFixture: bound.archiveDocumentFixture }, reader = createDocumentArchiveFixtureRead(scope, client);
  try { await reader.load({ kind: "archive-document", documentId: body.id }); expect(reader.getState().phase).toBe("ready"); for (const kind of archiveChildCaptureKinds) { const target=selectArchiveChildCapture(reader, kind); if(kind === "archive-related") expect(target).toBeNull(); else expect(target).not.toBeNull(); } expect(client.archiveMetadataOnly).toBe(true); } finally { reader.reset(); }
});
it("late fixture callback after close cannot inspect document identity or private data", async () => {
  let finish!: (body: unknown) => void; const kernel = createArchiveChildCaptureKernel({ ...archiveScope, environment: "https://market.example.invalid/api" }, () => new Promise(resolve => { finish = resolve; }));
  const body = archiveDocument(), getter = hidden(body, "id"), work = kernel.reader.load({ kind: "archive-document", documentId: "00000000-0000-4000-8000-000000000930" }); kernel.close(); finish(body);
  expect(await work).toBe("discarded"); expect(getter).not.toHaveBeenCalled(); expect(kernel.reader.getState().phase).toBe("idle"); expect(kernel.nativeMetadataLimitPreserved()).toBe(true);
});
it.each(["archive-history", "archive-signatures", "archive-participants"] as const)("%s empty metadata is allowed without inventing rows or completeness", async kind => {
  const input = await example(kind), child = doc(input, 1); if (kind === "archive-history") child.versions = []; else if (kind === "archive-signatures") child.signatures = []; else child.participants = [];
  const report = await replayArchiveChildCapture(input); expect(report).toMatchObject({ status: "CONSISTENT_METADATA", consumerPhase: "empty", metadataRows: 0, syntheticGetCalls: 2 }); flags(report);
});
it("history does not fabricate a missing current row or normalize supplied ordering", async () => {
  const input = await example(), child = doc(input, 1); child.versions.reverse(); const before = JSON.stringify(input); expect((await replayArchiveChildCapture(input)).status).toBe("CONSISTENT_METADATA"); expect(JSON.stringify(input)).toBe(before);
  child.versions = child.versions.filter(row => row.id !== input.expected.documentId); const report = await replayArchiveChildCapture(input); expect(report).toMatchObject({ status: "CONSISTENT_METADATA", metadataRows: 1, currentDocumentVersionInferred: false }); flags(report);
});
it("signature view ignores signer identity/certificate payload and never verifies cryptography", async () => {
  const input = await example("archive-signatures"), row = doc(input, 1).signatures[0]!, name = hidden(row, "signerName"), certificate = hidden(row, "certificateBytes");
  const report = await replayArchiveChildCapture(input); expect(report.status).toBe("CONSISTENT_METADATA"); expect(name).not.toHaveBeenCalled(); expect(certificate).not.toHaveBeenCalled(); flags(report);
});
it("participant view ignores legal-name/BIN extras beyond existing display projection", async () => {
  const input = await example("archive-participants"), org = doc(input, 1).participants[0]!.organization, legal = hidden(org, "legalName"), bin = hidden(org, "bin");
  expect((await replayArchiveChildCapture(input)).status).toBe("CONSISTENT_METADATA"); expect(legal).not.toHaveBeenCalled(); expect(bin).not.toHaveBeenCalled();
});
it("original storage/URL/checksum/content getters are never used by metadata history replay", async () => {
  const input = await example(), getters = input.records.flatMap(row => ["storagePath", "fileUrl", "checksumSha256", "content"].map(field => hidden(row.body as object, field)));
  const report = await replayArchiveChildCapture(input); expect(report.status).toBe("CONSISTENT_METADATA"); getters.forEach(getter => expect(getter).not.toHaveBeenCalled()); flags(report);
});
it.each([null, [], {}, { formatVersion: 2 }, { formatVersion: 1, kind: "archive-original" }])("invalid root remains redacted: %p", async input => { const report = await replayArchiveChildCapture(input); expect(report.status).toBe("INPUT_INVALID"); expect(report.fullSourceFixtureUsed).toBe(false); flags(report); });
it.each(["root", "scope", "expected", "first-record", "last-record"])("extra secret in %s is rejected before any saved body", async field => {
  const input = await example("archive-related"), first = hidden(input.records[0]!, "body"), last = hidden(input.records[3]!, "body"), target = field === "root" ? input : field === "scope" ? input.scope : field === "expected" ? input.expected : input.records[field === "first-record" ? 0 : 3]!, secret = hidden(target, "headers");
  expect((await replayArchiveChildCapture(input)).status).toBe("INPUT_INVALID"); for (const getter of [first, last, secret]) expect(getter).not.toHaveBeenCalled();
});
it.each(["product", "environment", "userId", "organizationId", "generation"] as const)("invalid scope %s cannot inspect any document", async field => {
  const input = await example(), body = hidden(input.records[0]!, "body"), scope = { ...input.scope, [field]: field === "generation" ? 0 : field === "environment" ? "http://private.invalid/api" : "SENSITIVE" };
  expect(await replayArchiveChildCapture({ ...input, scope })).toMatchObject({ status: "INPUT_INVALID", syntheticGetCalls: 0 }); expect(body).not.toHaveBeenCalled();
});
it.each(["documentId", "documentVersion"] as const)("invalid expected %s is refused before body", async field => {
  const input = await example(), body = hidden(input.records[0]!, "body"); Object.assign(input.expected, { [field]: field === "documentVersion" ? 0.5 : "SENSITIVE" }); expect((await replayArchiveChildCapture(input)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
it.each(archiveChildCaptureKinds)("%s requires the bounded complete source GET header sequence before any body", async kind => {
  const input = await example(kind), body = hidden(input.records[0]!, "body"); input.records.pop(); expect((await replayArchiveChildCapture(input)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
it.each([0, 1, 2, 3])("related GET header %s cannot become a POST before any body", async index => {
  const input = await example("archive-related"), body = hidden(input.records[0]!, "body"); Object.assign(input.records[index]!, { method: "POST" }); expect((await replayArchiveChildCapture(input)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
it.each([199, 600, "200", 200.5])("invalid final status %p prevents all body access", async status => {
  const input = await example("archive-related"), body = hidden(input.records[0]!, "body"); Object.assign(input.records[3]!, { httpStatus: status }); expect((await replayArchiveChildCapture(input)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
it.each(["id", "version"] as const)("initial parent %s binds before private title or participant metadata", async field => {
  const input = await example(), parent = doc(input); if (field === "id") parent.id = id; else parent.version++; const title = hidden(parent, "title"), participants = hidden(parent, "participants");
  expect(await replayArchiveChildCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", parentPhase: "contract-error", syntheticGetCalls: 1 }); expect(title).not.toHaveBeenCalled(); expect(participants).not.toHaveBeenCalled();
});
it.each([0, 1, 2, 3])("wrong related GET path at index%s cannot inspect that body", async index => {
  const input = await example("archive-related"), body = hidden(input.records[index]!, "body"); input.records[index]!.path += "?SENSITIVE=true"; const report = await replayArchiveChildCapture(input); expect(report.status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled(); flags(report);
});
it.each(["archive-history", "archive-signatures", "archive-participants"] as const)("%s parent snapshot change precedes private child contents", async kind => {
  const input = await example(kind), child = doc(input, 1); child.version++;
  const rows = kind === "archive-participants" ? hidden(child.participants[0]!.organization, "displayName") : hidden(child, kind === "archive-history" ? "versions" : "signatures");
  expect(await replayArchiveChildCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", consumerPhase: "relation-unverified", syntheticGetCalls: 2 }); expect(rows).not.toHaveBeenCalled();
});
it.each(["version", "status", "documentDate", "createdAt"] as const)("current history row %s cannot contradict the captured parent", async field => {
  const input = await example(), child = doc(input, 1), row = child.versions[0]!, old = child.versions[1]!; if (field === "version") row.version++; else row[field] = old[field];
  expect(await replayArchiveChildCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", consumerPhase: "contract-error" });
});
it.each(["archive-history", "archive-signatures"] as const)("duplicate %s row IDs stay rejected", async kind => {
  const input = await example(kind), child = doc(input, 1); if (kind === "archive-history") child.versions.push({ ...child.versions[0]! }); else child.signatures.push({ ...child.signatures[0]! });
  expect(await replayArchiveChildCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", consumerPhase: "contract-error" });
});
it("participant organization identity binds before display name", async () => {
  const input = await example("archive-participants"), org = doc(input, 1).participants[0]!.organization; org.id = id; const label = hidden(org, "displayName");
  expect((await replayArchiveChildCapture(input)).status).toBe("CONSUMER_REJECTED"); expect(label).not.toHaveBeenCalled();
});
it.each(["none", "cycle"])("related %s source link cannot dispatch child reads", async state => {
  const input = await example("archive-related"), parent = doc(input); parent.baseAgreementDocumentId = state === "none" ? null : parent.id; const bodies = input.records.slice(1).map(row => hidden(row, "body"));
  expect(await replayArchiveChildCapture(input)).toMatchObject({ status: "UNSUPPORTED_CONTEXT", syntheticGetCalls: 1 }); bodies.forEach(getter => expect(getter).not.toHaveBeenCalled());
});
it("changed forward link before base read never inspects target metadata", async () => {
  const input = await example("archive-related"); doc(input, 1).baseAgreementDocumentId = id; const target = hidden(input.records[2]!, "body"), after = hidden(input.records[3]!, "body");
  expect(await replayArchiveChildCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", consumerPhase: "relation-unverified", syntheticGetCalls: 2 }); expect(target).not.toHaveBeenCalled(); expect(after).not.toHaveBeenCalled();
});
it("base target must be an actual CONTRACT before the final forward-reference check", async () => {
  const input = await example("archive-related"); doc(input, 2).category = "ORDER"; const after = hidden(input.records[3]!, "body");
  expect(await replayArchiveChildCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", consumerPhase: "relation-unverified", syntheticGetCalls: 3 }); expect(after).not.toHaveBeenCalled();
});
it("changed forward link after base read does not publish the already decoded base metadata", async () => {
  const input = await example("archive-related"); doc(input, 3).baseAgreementDocumentId = id; const report = await replayArchiveChildCapture(input);
  expect(report).toMatchObject({ status: "CONSUMER_REJECTED", consumerPhase: "relation-unverified", syntheticGetCalls: 4 }); expect(report).not.toHaveProperty("resultKind"); expect(report).not.toHaveProperty("metadataRows"); flags(report);
});
it("unverified foreign base visibility fails before private target title", async () => {
  const input = await example("archive-related"), target = doc(input, 2); target.ownerOrganizationId = id; target.participants = []; const title = hidden(target, "title"), after = hidden(input.records[3]!, "body");
  expect(await replayArchiveChildCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", consumerPhase: "visibility-unverified", syntheticGetCalls: 3 }); expect(title).not.toHaveBeenCalled(); expect(after).not.toHaveBeenCalled();
});
it.each(archiveChildCaptureKinds)("%s HTTP read failures remain source refusals without rows/crypto/file proof", async kind => {
  for (const index of [0, 1]) for (const status of [401, 403, 404, 429, 500]) {
    const input = await example(kind); input.records[index]!.httpStatus = status; input.records[index]!.body = archiveEnvelope(status).payload; const report = await replayArchiveChildCapture(input);
    expect(report).toMatchObject({ status: "CONSUMER_REJECTED", syntheticGetCalls: index + 1 }); expect(report).not.toHaveProperty("metadataRows"); flags(report);
  }
});
it.each([0, 1, 2, 3])("throwing related body%s cannot forge a known HTTP denial", async index => {
  const input = await example("archive-related"); Object.defineProperty(input.records[index]!, "body", { get: () => { throw new MarketHttpError(403, { private: "SENSITIVE" }); } });
  const report = await replayArchiveChildCapture(input); expect(report.status).toBe("INPUT_INVALID"); flags(report);
});
it("all generated metadata replays avoid global fetch, bytes, hashing and providers", async () => {
  const fetcher = jest.spyOn(globalThis, "fetch").mockRejectedValue(Error("Unexpected network")); for (const kind of archiveChildCaptureKinds) { const report = await replayArchiveChildCapture(await archiveChildCaptureExample(kind)); expect(report.status).toBe("CONSISTENT_METADATA"); flags(report); } expect(fetcher).not.toHaveBeenCalled();
});
