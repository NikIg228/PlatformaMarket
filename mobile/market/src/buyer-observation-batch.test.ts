import { jest } from "@jest/globals";
import { buyerObservationBatchExample } from "./test-fixtures/buyer-observation-batch-example";
import { contractBatchCaptureExample } from "./test-fixtures/contract-batch-capture-example";
import { contractBatchFamilies, replayContractBatch, type ContractBatchInput } from "./test-fixtures/contract-batch-replay";

let dataset: ContractBatchInput;
beforeAll(async () => { dataset = await buyerObservationBatchExample(); });
afterEach(() => jest.restoreAllMocks());

it.each(Array.from({ length: 80 }, (_, index) => index))("preserves observation/recovery semantics in separate dataset row %i", async index => {
  const fetcher = jest.spyOn(globalThis, "fetch").mockRejectedValue(Error("Unexpected real network"));
  const input = JSON.parse(JSON.stringify({ formatVersion: 1, cases: [dataset.cases[index]] })), before = JSON.stringify(input);
  const report = await replayContractBatch(input), observed = report.results[0]?.observed;
  const failure = index < 20 ? -1 : (index - 20) % 6;
  expect(report).toMatchObject({ status: "EXPECTATIONS_MATCHED", caseCount: 1, checkedCases: 1, matchedCases: 1, expectedRefusalIsAPIAcceptance: false, serverAccepted: false, effectProven: false, networkRequests: 0, mutations: 0 });
  expect(observed).toMatchObject({ status: index < 20 ? "CONSISTENT_OBSERVATION" : failure === 3 ? "INPUT_INVALID" : failure === 5 ? "UNSUPPORTED_CONTEXT" : "CONSUMER_REJECTED", commandCalls: failure === 3 ? 0 : 1, syntheticCapturedKeyReads: failure === 3 ? 0 : 1, observationGetCalls: failure === 3 ? 0 : 1, initialUnresolved: failure !== 3, automaticRetryPerformed: false, writeReplayPerformed: false, returnedIdReadPerformed: false, observedEffectAttributed: false, readAcknowledged: false, newAttemptPrepared: false });
  if (index < 20 || failure === 1 || failure === 5) expect(observed).toMatchObject({ unresolved: true, sameAttemptInputRetained: true, originalUUIDRetained: true });
  expect(JSON.stringify(input)).toBe(before); expect(fetcher).not.toHaveBeenCalled();
  for (const privateText of ["00000000-", "idempotencyKey", "requestBody", "SYNTHETIC saved", "buyerOrganizationId"]) expect(JSON.stringify(report)).not.toContain(privateText);
});

it("keeps80 separate cases in stable source order with20 positives and60 refusals", async () => {
  expect(Object.isFrozen(dataset)).toBe(true); expect(Object.isFrozen(dataset.cases)).toBe(true);
  expect(dataset.cases).toHaveLength(80); expect(contractBatchFamilies).toHaveLength(17);
  const report = await replayContractBatch(dataset);
  expect(report).toMatchObject({ status: "EXPECTATIONS_MATCHED", checkedCases: 80, matchedCases: 80, mismatchedCases: 0 });
  expect(report.results.map(row => row.index)).toEqual(Array.from({ length: 80 }, (_, index) => index));
  expect(report.results.filter(row => row.observed.status === "CONSISTENT_OBSERVATION")).toHaveLength(20);
  expect(report.results.filter(row => row.observed.status === "CONSUMER_REJECTED")).toHaveLength(40);
  expect(report.results.filter(row => row.observed.status === "INPUT_INVALID")).toHaveLength(10);
  expect(report.results.filter(row => row.observed.status === "UNSUPPORTED_CONTEXT")).toHaveLength(10);
});

it("retains512 limit and rejects accidental447+80 merge before accessing saved input", async () => {
  const first = { ...dataset.cases[0] }, getter = jest.fn(() => { throw Error("Private input"); });
  Object.defineProperty(first, "input", { get: getter });
  const cases = [first, ...Array.from({ length: 526 }, () => dataset.cases[0])];
  expect(await replayContractBatch({ formatVersion: 1, cases })).toMatchObject({ status: "INPUT_INVALID", checkedCases: 0 });
  expect(getter).not.toHaveBeenCalled();
});

it("validates every new family expectation before reading any preceding saved body", async () => {
  const first = { ...dataset.cases[0] }, getter = jest.fn(() => { throw Error("Private input"); });
  Object.defineProperty(first, "input", { get: getter });
  const invalid = { ...dataset.cases[79], expected: { status: "INPUT_INVALID", originalUUIDRetained: { secret: true } } };
  expect(await replayContractBatch({ formatVersion: 1, cases: [first, invalid] })).toMatchObject({ status: "INPUT_INVALID", checkedCases: 0 });
  expect(getter).not.toHaveBeenCalled();
});

it("keeps extra observation fields outside legacy family expectations and reports", async () => {
  const legacy = await contractBatchCaptureExample();
  expect(legacy.cases).toHaveLength(447); expect(new Set(legacy.cases.map(row => row.family)).size).toBe(16);
  const report = await replayContractBatch({ formatVersion: 1, cases: legacy.cases.slice(0, 1) });
  for (const key of ["stage", "initialUnresolved", "workspaceGetCalls", "sameAttemptInputRetained", "originalUUIDRetained", "writeReplayPerformed"]) expect(report.results[0].observed).not.toHaveProperty(key);
  expect(await replayContractBatch({ formatVersion: 1, cases: [{ family: "core", expected: { status: "INPUT_INVALID", originalUUIDRetained: false }, input: null }] })).toMatchObject({ status: "INPUT_INVALID", checkedCases: 0 });
});

it("a deliberately false observation expectation fails and preserves subsequent independent rows", async () => {
  const report = await replayContractBatch({ formatVersion: 1, cases: [{ ...dataset.cases[0], expected: { ...dataset.cases[0].expected, writeReplayPerformed: true } }, dataset.cases[79]] });
  expect(report).toMatchObject({ status: "EXPECTATIONS_MISMATCHED", checkedCases: 2, matchedCases: 1, mismatchedCases: 1 });
  expect(report.results.map(row => row.matched)).toEqual([false, true]);
});
