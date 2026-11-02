import { jest } from "@jest/globals";
import { errorResponseSchema } from "../../../packages/schemas/src/core-api";
import { supportArchiveFailureCorpus, supportArchiveFailureDescriptors, replaySupportArchiveFailure, type SupportArchiveFailure } from "./test-fixtures/support-archive-failure-corpus";

let corpus: readonly SupportArchiveFailure[];
beforeAll(async () => { corpus = await supportArchiveFailureCorpus(); });
afterEach(() => jest.restoreAllMocks());
it("covers two support commands and four archive child metadata readers with unique bounded refusals", () => {
  expect(corpus).toHaveLength(35); expect(new Set(corpus.map(row => row.id)).size).toBe(35); expect(corpus.map(row => row.id)).toEqual(supportArchiveFailureDescriptors.map(row => row.id));
  expect(corpus.filter(row => row.family === "support")).toHaveLength(10); expect(corpus.filter(row => row.family === "archive")).toHaveLength(25);
});
it.each(supportArchiveFailureDescriptors)("saved $id preserves original refusal without effect/verification claims", async descriptor => {
  const entry = corpus.find(row => row.id === descriptor.id)!, serialized = JSON.stringify(entry.input), input = JSON.parse(serialized), report = await replaySupportArchiveFailure(entry.family, input);
  expect(report).toMatchObject(entry.expected); expect(Object.isFrozen(report)).toBe(true); expect(JSON.stringify(input)).toBe(serialized);
  expect(report).toMatchObject({ responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY", nativeBindingPerformed: false, productionAuthorizationVerified: false, serverAccepted: false, credentialStoreAccessed: false });
  if ("syntheticGetCalls" in report) {
    expect(report).toMatchObject({ nativeMetadataLimitChanged: false, originalFileBytesAccessed: false, originalChecksumVerified: false, cryptographicSignatureVerified: false, currentDocumentVersionInferred: false, keyProviderAccessed: false, networkRequests: 0, mutations: 0 });
    expect(report).not.toHaveProperty("resultKind"); expect(report).not.toHaveProperty("metadataRows");
  } else {
    expect(report).toMatchObject({ sourceResponseAccepted: false, nativeKeyProviderAccessed: false, businessEligibilityVerified: false, effectProven: false, independentPostResponseReadPerformed: false, privateFileBytesAccessed: false, realNetworkRequests: 0, realServerMutations: 0 });
    if (entry.failure === "parent-http-403") expect(report.syntheticCapturedKeyReads).toBe(0);
  }
  for (const field of ["scope", "input", "body", "requestBody", "parent", "records", "path", "expected", "error", "idempotencyKey"]) expect(report).not.toHaveProperty(field);
  for (const text of ["SYNTHETIC_AUXILIARY_ERROR", "SYNTHETIC support/archive failure", "00000000-", "synthetic-drift", "market.example.invalid"]) expect(JSON.stringify(report)).not.toContain(text);
});
it("error envelopes retain the actual source path and status rather than a second route inventory", () => {
  for (const row of corpus) {
    if (!row.failure.includes("http")) continue; const input = row.input;
    const record = "records" in input ? input.records[input.records.length - 1]! : row.failure === "parent-http-403" ? input.parent : input.operation;
    const body = errorResponseSchema.parse(record.body); expect(body.path).toBe(record.path); expect(body.statusCode).toBe(record.httpStatus);
  }
});
it("all generation and replays avoid global fetch", async () => { const fetcher = jest.spyOn(globalThis, "fetch").mockRejectedValue(Error("Unexpected offline network")); for (const row of await supportArchiveFailureCorpus()) expect((await replaySupportArchiveFailure(row.family, row.input)).status).toBe(row.expected.status); expect(fetcher).not.toHaveBeenCalled(); });
