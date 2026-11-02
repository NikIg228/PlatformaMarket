import { jest } from "@jest/globals";
import { errorResponseSchema } from "../../../packages/schemas/src/core-api";
import { supportRecoveryFailureCorpus, supportRecoveryFailureDescriptors, type SupportRecoveryFailure } from "./test-fixtures/support-recovery-failure-corpus";
import { replaySupportCommandRecovery } from "./test-fixtures/support-command-recovery-replay";

let corpus: readonly SupportRecoveryFailure[];
beforeAll(async () => { corpus = await supportRecoveryFailureCorpus(); });
afterEach(() => jest.restoreAllMocks());
it("covers all four original recovery contexts with38 unique bounded refusals", () => {
  expect(corpus).toHaveLength(38); expect(new Set(corpus.map(row => row.id)).size).toBe(38); expect(corpus.map(row => row.id)).toEqual(supportRecoveryFailureDescriptors.map(row => row.id));
  expect(new Set(corpus.map(row => row.sourceCase)).size).toBe(4); expect(corpus.filter(row => row.failure === "retained-older-ticket")).toHaveLength(2);
});
it.each(supportRecoveryFailureDescriptors)("saved $id retains source unresolved/key/observation boundaries", async descriptor => {
  const entry = corpus.find(row => row.id === descriptor.id)!, serialized = JSON.stringify(entry.input), input = JSON.parse(serialized), report = await replaySupportCommandRecovery(input);
  expect(report).toMatchObject(entry.expected); expect(Object.isFrozen(report)).toBe(true); expect(JSON.stringify(input)).toBe(serialized);
  expect(report).toMatchObject({ responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY", nativeBindingPerformed: false, nativeKeyProviderAccessed: false, businessEligibilityVerified: false, productionAuthorizationVerified: false, serverAccepted: false, effectProven: false, automaticRetryPerformed: false, returnedIdReadPerformed: false, privateFileBytesAccessed: false, credentialStoreAccessed: false, realNetworkRequests: 0, realServerMutations: 0 });
  for (const field of ["scope", "input", "expected", "body", "requestBody", "parent", "initial", "observation", "replay", "path", "error", "idempotencyKey"]) expect(report).not.toHaveProperty(field);
  for (const value of ["00000000-", "SYNTHETIC private", "SYNTHETIC_RECOVERY_ERROR", "synthetic-drift", "market.example.invalid"]) expect(JSON.stringify(report)).not.toContain(value);
});
it("a failed replay keeps the earlier unresolved result even for a definite retry HTTP refusal", async () => {
  for (const entry of corpus.filter(row => row.failure.startsWith("replay-http"))) expect(await replaySupportCommandRecovery(entry.input)).toMatchObject({ status: "CONSUMER_REJECTED", retryPhase: "unknown", unresolved: true, samePreparedRequest: true, commandCalls: 2, syntheticCapturedKeyReads: 1 });
});
it("error envelopes preserve actual original paths and statuses", () => {
  for (const entry of corpus) {
    if (!entry.failure.includes("http")) continue;
    const record = entry.failure.startsWith("initial") ? entry.input.initial : entry.failure.startsWith("observation") ? entry.input.observation : entry.input.replay, body = errorResponseSchema.parse(record.body);
    expect(body.path).toBe(record.path); expect(body.statusCode).toBe(record.httpStatus);
  }
});
it("all saved recovery refusals avoid global fetch", async () => {
  const fetcher = jest.spyOn(globalThis, "fetch").mockRejectedValue(Error("Unexpected offline network"));
  for (const entry of await supportRecoveryFailureCorpus()) expect((await replaySupportCommandRecovery(entry.input)).status).toBe(entry.expected.status);
  expect(fetcher).not.toHaveBeenCalled();
});
