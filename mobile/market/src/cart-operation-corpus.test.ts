import { jest } from "@jest/globals";
import { cartOperationCorpus, type CartOperationCorpusCase } from "./test-fixtures/cart-operation-corpus";
import { replayCartOperationCapture } from "./test-fixtures/cart-operation-capture-replay";

let corpus: readonly CartOperationCorpusCase[];
beforeAll(async () => { corpus = await cartOperationCorpus(); });
afterEach(() => jest.restoreAllMocks());
it("declares eight compatible synthetic responses and41 source/input/context refusals with unique safe names", () => {
  expect(corpus).toHaveLength(49); expect(new Set(corpus.map(row => row.id)).size).toBe(49); expect(Object.isFrozen(corpus)).toBe(true);
  for (const row of corpus) { expect(row.id).toMatch(/^[a-z][a-z0-9-]+$/); expect(Object.isFrozen(row)).toBe(true); expect(Object.isFrozen(row.expected)).toBe(true); }
  expect(corpus.filter(row => row.expected.status === "CONSISTENT_RESPONSE")).toHaveLength(8);
  expect(corpus.filter(row => row.expected.status !== "CONSISTENT_RESPONSE")).toHaveLength(41);
});
it.each(Array.from({ length: 49 }, (_, index) => index))("case%# survives saved JSON serialization and actual protected source replay", async index => {
  const row = corpus[index]!, text = JSON.stringify(row.input), input: unknown = JSON.parse(text), report = await replayCartOperationCapture(input);
  expect(report).toMatchObject(row.expected); expect(report).toMatchObject({ kind: row.input.kind, modelAuthorization: "SYNTHETIC_ONLY", nativeBindingPerformed: false, businessEligibilityVerified: false, productionAuthorizationVerified: false, serverAccepted: false, effectProven: false, realNetworkRequests: 0, realServerMutations: 0, credentialStoreAccessed: false });
  expect(JSON.stringify(input)).toBe(text); expect(JSON.stringify(report)).not.toContain("00000000-"); expect(JSON.stringify(report)).not.toContain("90071992547409931234"); expect(JSON.stringify(report)).not.toContain("SYNTHETIC_UNRECOGNIZED_CONFLICT");
});
it("corpus generation and replay use no global fetch", async () => {
  const fetcher = jest.spyOn(globalThis, "fetch").mockRejectedValue(Error("Unexpected network"));
  for (const row of await cartOperationCorpus()) expect((await replayCartOperationCapture(row.input)).status).toBe(row.expected.status);
  expect(fetcher).not.toHaveBeenCalled();
});
