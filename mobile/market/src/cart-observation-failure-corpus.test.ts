import { jest } from "@jest/globals";
import { errorResponseSchema } from "../../../packages/schemas/src/core-api";
import { cartObservationFailureCorpus, cartObservationFailureDescriptors, type CartObservationFailure } from "./test-fixtures/cart-observation-failure-corpus";
import { replayCartCommandObservation } from "./test-fixtures/cart-command-observation-replay";

let corpus: readonly CartObservationFailure[];
beforeAll(async () => { corpus = await cartObservationFailureCorpus(); });
afterEach(() => jest.restoreAllMocks());
it("covers ten source observation actions with66 unique bounded refusals", () => {
  expect(corpus).toHaveLength(66); expect(new Set(corpus.map(row => row.id)).size).toBe(66); expect(corpus.map(row => row.id)).toEqual(cartObservationFailureDescriptors.map(row => row.id));
  expect(new Set(corpus.map(row => row.sourceCase)).size).toBe(10);
  expect(corpus.filter(row => row.failure === "retained-older-current")).toHaveLength(6);
  expect(corpus.filter(row => row.failure === "foreign-current")).toHaveLength(8);
});
it.each(cartObservationFailureDescriptors)("saved $id refuses without nullable-current evidence or replay", async descriptor => {
  const entry = corpus.find(row => row.id === descriptor.id)!, serialized = JSON.stringify(entry.input), input = JSON.parse(serialized), report = await replayCartCommandObservation(input);
  expect(report).toMatchObject(entry.expected); expect(Object.isFrozen(report)).toBe(true); expect(JSON.stringify(input)).toBe(serialized);
  expect(report).toMatchObject({ responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY", nativeBindingPerformed: false, businessEligibilityVerified: false, productionAuthorizationVerified: false, serverAccepted: false, effectProven: false, observedEffectAttributed: false, writeReplayPerformed: false, keyProviderAccessed: false, credentialStoreAccessed: false, realNetworkRequests: 0, realServerMutations: 0, secondCommandAttempts: 0, workspaceObservationAccepted: false, readClosed: false, currentReadVersionPrepared: false });
  for (const field of ["scope", "input", "body", "requestBody", "parent", "operation", "observation", "expected", "path", "error", "idempotencyKey"]) expect(report).not.toHaveProperty(field);
  for (const value of ["00000000-", "SYNTHETIC private", "SYNTHETIC_OBSERVATION_ERROR", "synthetic-drift", "market.example.invalid"]) expect(JSON.stringify(report)).not.toContain(value);
});
it("keeps error envelopes bound to each original source path and HTTP status", () => {
  for (const row of corpus) {
    if (!row.failure.includes("http")) continue;
    const record = row.failure === "initial-http-401" ? row.input.operation : row.input.observation, body = errorResponseSchema.parse(record.body);
    expect(body.path).toBe(record.path); expect(body.statusCode).toBe(record.httpStatus);
  }
});
it("does not mutate another generated capture when preparing a failure", async () => {
  const before = corpus.map(row => JSON.stringify(row.input)); await cartObservationFailureCorpus(); expect(corpus.map(row => JSON.stringify(row.input))).toEqual(before);
});
it("all serialized refusals avoid global fetch", async () => {
  const fetcher = jest.spyOn(globalThis, "fetch").mockRejectedValue(Error("Unexpected offline network"));
  for (const row of await cartObservationFailureCorpus()) expect((await replayCartCommandObservation(row.input)).status).toBe(row.expected.status);
  expect(fetcher).not.toHaveBeenCalled();
});
