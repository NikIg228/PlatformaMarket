import { jest } from "@jest/globals";
import { errorResponseSchema } from "../../../packages/schemas/src/core-api";
import { commandFailureDescriptors, commandFailureFamilies, commandFailureKinds, replaySyntheticCommandFailure, syntheticCommandFailureCorpus, type SyntheticCommandFailure } from "./test-fixtures/synthetic-command-failure-corpus";

let corpus: readonly SyntheticCommandFailure[];
beforeAll(async () => { corpus = await syntheticCommandFailureCorpus(); });
afterEach(() => jest.restoreAllMocks());
it("covers all 33 original initial command contexts with five serialized refusal cases each", () => {
  expect(corpus).toHaveLength(165); expect(new Set(corpus.map(row => row.id)).size).toBe(165);
  expect(corpus.map(row => row.id)).toEqual(commandFailureDescriptors.map(row => row.id));
  for (const family of commandFailureFamilies) {
    const rows = corpus.filter(row => row.family === family);
    expect(rows.length).toBe(({ "cart-mutation": 4, "cart-add": 2, "saved-list": 3, comment: 2, "buyer-workflow": 10, "order-conversation": 6, "offer-conversation": 6 })[family] * 5);
    for (const sourceCase of new Set(rows.map(row => row.sourceCase))) expect(rows.filter(row => row.sourceCase === sourceCase).map(row => row.failure)).toEqual(commandFailureKinds);
  }
});
it.each(commandFailureDescriptors)("saved $id retains original refusal/unknown state", async descriptor => {
  const entry = corpus.find(row => row.id === descriptor.id)!;
  const serialized = JSON.stringify(entry.input), input = JSON.parse(serialized), report = await replaySyntheticCommandFailure(entry.family, input);
  expect(report).toMatchObject(entry.expected);
  expect(report).toMatchObject({ nativeBindingPerformed: false, businessEligibilityVerified: false, productionAuthorizationVerified: false, serverAccepted: false, effectProven: false, credentialStoreAccessed: false, realNetworkRequests: 0, realServerMutations: 0 });
  for (const flag of ["keyProviderAccessed", "nativeKeyProviderAccessed", "privateFileBytesAccessed", "sourceResponseAccepted", "sourceReceived", "independentPostResponseReadPerformed"] as const) if (flag in report) expect(report).toHaveProperty(flag, false);
  expect(JSON.stringify(input)).toBe(serialized); expect(Object.isFrozen(report)).toBe(true);
  for (const field of ["input", "parent", "operation", "body", "requestBody", "path", "scope", "error"]) expect(report).not.toHaveProperty(field);
  for (const privateText of ["SYNTHETIC command failure", "SYNTHETIC_COMMAND_ERROR", "00000000-", "synthetic-drift", "market.example.invalid"]) expect(JSON.stringify(report)).not.toContain(privateText);
  if (entry.failure === "parent-http-403") { expect(report).not.toHaveProperty("operationPhase"); if ("syntheticCapturedKeyReads" in report) expect(report.syntheticCapturedKeyReads).toBe(0); }
});
it("error envelopes bind to the actual saved source path and numeric status", () => {
  for (const row of corpus) {
    if (row.failure === "command-path-drift") continue;
    const record = row.failure === "parent-http-403" ? row.input.parent : row.input.operation;
    const body = errorResponseSchema.parse(record.body); expect(body.statusCode).toBe(record.httpStatus); expect(body.path).toBe(record.path);
  }
});
it("each capture owns independent records and cannot mutate its sibling cases", () => {
  const [first, next] = corpus; const saved = JSON.stringify(next!.input); expect(first!.input.parent).not.toBe(next!.input.parent); expect(first!.input.operation).not.toBe(next!.input.operation);
  const path = first!.input.operation.path; first!.input.operation.path += "-changed"; expect(JSON.stringify(next!.input)).toBe(saved); first!.input.operation.path = path;
});
it("generation and all failure replays avoid global fetch", async () => {
  const fetcher = jest.spyOn(globalThis, "fetch").mockRejectedValue(Error("Unexpected synthetic network"));
  for (const row of await syntheticCommandFailureCorpus()) expect((await replaySyntheticCommandFailure(row.family, row.input)).status).toBe(row.expected.status);
  expect(fetcher).not.toHaveBeenCalled();
});
