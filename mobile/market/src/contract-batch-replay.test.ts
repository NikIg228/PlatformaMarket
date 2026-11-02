import { jest } from "@jest/globals";
import { contractBatchCaptureExample } from "./test-fixtures/contract-batch-capture-example";
import { contractBatchFamilies, replayContractBatch, type ContractBatchReport, type ContractBatchFamily } from "./test-fixtures/contract-batch-replay";

function row(family: ContractBatchFamily = "core") { return { family, expected: { status: "INPUT_INVALID" }, input: null }; }
function hidden(target: object, field: string) { const getter = jest.fn(() => { throw Error("SENSITIVE_BATCH_INPUT"); }); Object.defineProperty(target, field, { configurable: true, enumerable: true, get: getter }); return getter; }
function flags(report: ContractBatchReport) {
  expect(report).toMatchObject({ provenance: "EXISTING_SOURCE_CONSUMERS_ONLY", expectedRefusalIsAPIAcceptance: false, serverAccepted: false, effectProven: false, nativeBindingPerformed: false, keyProviderAccessed: false, credentialStoreAccessed: false, privateFileBytesAccessed: false, originalChecksumVerified: false, cryptographicSignatureVerified: false, networkRequests: 0, mutations: 0 });
  expect(Object.isFrozen(report)).toBe(true); expect(Object.isFrozen(report.results)).toBe(true);
  for (const result of report.results) { expect(Object.isFrozen(result)).toBe(true); expect(Object.isFrozen(result.observed)).toBe(true); for (const field of ["input", "expected", "body", "path", "scope", "error"]) expect(result).not.toHaveProperty(field); }
  for (const privateText of ["SENSITIVE", "00000000-", "SYNTHETIC user", "SYNTHETIC private", "market.example.invalid", "idempotencyKey"]) expect(JSON.stringify(report)).not.toContain(privateText);
}
afterEach(() => jest.restoreAllMocks());

it("replays 447 inline source cases including expected refusals without network or acceptance inference", async () => {
  const fetcher = jest.spyOn(globalThis, "fetch").mockRejectedValue(Error("Unexpected network")), input = await contractBatchCaptureExample(), before = JSON.stringify(input), report = await replayContractBatch(JSON.parse(before));
  expect(report.results.filter(row => !row.matched)).toEqual([]);
  expect(report).toMatchObject({ status: "EXPECTATIONS_MATCHED", caseCount: 447, checkedCases: 447, matchedCases: 447, mismatchedCases: 0, serverAccepted: false, effectProven: false, nativeBindingPerformed: false, networkRequests: 0, mutations: 0 });
  expect(JSON.stringify(input)).toBe(before);
  expect(new Set(input.cases.map(row => row.family)).size).toBe(16); expect(input.cases.filter(row => ["CONSISTENT_READ", "CONSISTENT_RESPONSE", "CONSISTENT_METADATA", "CONSISTENT_RECOVERY", "CONSISTENT_OBSERVATION"].includes(row.expected.status))).toHaveLength(82);
  expect(fetcher).not.toHaveBeenCalled(); flags(report);
});
it.each(contractBatchFamilies)("closed %s dispatcher retains the original expected input refusal", async family => { const report = await replayContractBatch({ formatVersion: 1, cases: [row(family)] }); expect(report).toMatchObject({ status: "EXPECTATIONS_MATCHED", caseCount: 1, matchedCases: 1, results: [{ index: 0, family, matched: true, consumerCompleted: true, observed: { status: "INPUT_INVALID" } }] }); flags(report); });
it.each([null, [], {}, { formatVersion: 2, cases: [] }, { formatVersion: 1, cases: [] }, { formatVersion: 1, cases: {} }])("invalid root stays fixed and redacted: %p", async input => { const report = await replayContractBatch(input); expect(report).toMatchObject({ status: "INPUT_INVALID", caseCount: 0, checkedCases: 0, matchedCases: 0, mismatchedCases: 0, results: [] }); flags(report); });
it.each(["root", "row", "expected"])("unexpected private %s metadata is rejected without reading its getter", async field => {
  const first = row(), input = { formatVersion: 1, cases: [first] }, body = hidden(first, "input"), secret = hidden(field === "root" ? input : field === "row" ? first : first.expected, "token");
  const report = await replayContractBatch(input); expect(report).toMatchObject({ status: "INPUT_INVALID", checkedCases: 0 }); expect(secret).not.toHaveBeenCalled(); expect(body).not.toHaveBeenCalled(); flags(report);
});
it.each(["family", "expected", "input-missing"])("invalid last row %s prevents any preceding saved input access", async field => {
  const first = row(), last = row(), body = hidden(first, "input"); if (field === "family") Object.assign(last, { family: "SENSITIVE" }); else if (field === "expected") Object.assign(last.expected, { status: "SENSITIVE" }); else Reflect.deleteProperty(last, "input");
  const report = await replayContractBatch({ formatVersion: 1, cases: [first, last] }); expect(report).toMatchObject({ status: "INPUT_INVALID", checkedCases: 0 }); expect(body).not.toHaveBeenCalled(); flags(report);
});
it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, 1_000_001, { private: "SENSITIVE" }])("invalid expected count %p stops before inputs", async commandCalls => {
  const first = row(), body = hidden(first, "input"), input = { formatVersion: 1, cases: [first, { ...row(), expected: { status: "INPUT_INVALID", commandCalls } }] };
  expect(await replayContractBatch(input)).toMatchObject({ status: "INPUT_INVALID", checkedCases: 0 }); expect(body).not.toHaveBeenCalled();
});
it("more than512 cases stop before input getters", async () => { const first = row(), body = hidden(first, "input"), cases = [first, ...Array.from({ length: 512 }, () => row())]; expect(await replayContractBatch({ formatVersion: 1, cases })).toMatchObject({ status: "INPUT_INVALID", checkedCases: 0 }); expect(body).not.toHaveBeenCalled(); });
it("512 minimal cases are allowed and keep stable ordered result indices", async () => { const cases = Array.from({ length: 512 }, () => row()), report = await replayContractBatch({ formatVersion: 1, cases }); expect(report).toMatchObject({ status: "EXPECTATIONS_MATCHED", checkedCases: 512, matchedCases: 512 }); expect(report.results.map(result => result.index)).toEqual(cases.map((_, index) => index)); flags(report); });
it.each(["sparse", "symbol", "array-extra"])("%s case list is invalid before saved input", async kind => {
  const first = row(), body = hidden(first, "input"), cases = [first]; if (kind === "sparse") cases.length = 2; else Object.defineProperty(cases, kind === "symbol" ? Symbol("SENSITIVE") : "secret", { value: "SENSITIVE" });
  expect(await replayContractBatch({ formatVersion: 1, cases })).toMatchObject({ status: "INPUT_INVALID", checkedCases: 0 }); expect(body).not.toHaveBeenCalled();
});
it("a mismatched expectation keeps its result and continues independent later rows", async () => {
  const input = { formatVersion: 1, cases: [{ ...row(), expected: { status: "CONSISTENT_READ" } }, row("metadata"), row("support")] }, before = JSON.stringify(input), report = await replayContractBatch(input);
  expect(report).toMatchObject({ status: "EXPECTATIONS_MISMATCHED", caseCount: 3, checkedCases: 3, matchedCases: 2, mismatchedCases: 1 }); expect(report.results.map(result => result.matched)).toEqual([false, true, true]); expect(JSON.stringify(input)).toBe(before); flags(report);
});
it("a throwing input getter cannot manufacture a matching expected refusal", async () => { const first = row(), getter = hidden(first, "input"), report = await replayContractBatch({ formatVersion: 1, cases: [first, row("support")] }); expect(report).toMatchObject({ status: "EXPECTATIONS_MISMATCHED", checkedCases: 2, matchedCases: 1, mismatchedCases: 1, results: [{ consumerCompleted: false, matched: false, observed: {} }, { consumerCompleted: true, matched: true }] }); expect(getter).toHaveBeenCalledTimes(1); flags(report); });
it("throwing header getters are fixed input failures before any saved data", async () => { const first = row(), body = hidden(first, "input"), last = row(), header = hidden(last.expected, "status"), report = await replayContractBatch({ formatVersion: 1, cases: [first, last] }); expect(report.status).toBe("INPUT_INVALID"); expect(header).toHaveBeenCalledTimes(1); expect(body).not.toHaveBeenCalled(); flags(report); });
it("prototype and symbol root metadata cannot be interpreted as a batch", async () => { for (const input of [new Date(), Object.assign(Object.create({ private: "SENSITIVE" }), { formatVersion: 1, cases: [row()] }), { formatVersion: 1, cases: [row()], [Symbol("SENSITIVE")]: true }]) { const report = await replayContractBatch(input); expect(report.status).toBe("INPUT_INVALID"); flags(report); } });

it("keeps all329 legacy inputs and expectations compatible after the additive recovery extension", async () => {
  const input = await contractBatchCaptureExample(), legacy = { formatVersion: 1, cases: input.cases.slice(0, 329) }, report = await replayContractBatch(legacy);
  expect(report).toMatchObject({ status: "EXPECTATIONS_MATCHED", caseCount: 329, checkedCases: 329, matchedCases: 329, mismatchedCases: 0 }); flags(report);
});
it("projects only fixed retained-key recovery metadata for all four additional cases", async () => {
  const input = await contractBatchCaptureExample(), cases = input.cases.filter(row => row.family === "support-recovery" && row.expected.status === "CONSISTENT_RECOVERY"), report = await replayContractBatch({ formatVersion: 1, cases });
  expect(cases).toHaveLength(4); expect(report).toMatchObject({ status: "EXPECTATIONS_MATCHED", matchedCases: 4 });
  for (const row of report.results) expect(row.observed).toMatchObject({ status: "CONSISTENT_RECOVERY", retryPhase: "success", initialResponseAccepted: false, sourceResponseAccepted: true, unresolved: false, samePreparedRequest: true, explicitSourceRetryPerformed: true, parentGetCalls: 1, observationGetCalls: 1, commandCalls: 2, syntheticCapturedKeyReads: 1 });
  flags(report);
});

it("keeps all333 legacy inputs and expectations compatible after adding source cart observations", async () => {
  const input = await contractBatchCaptureExample(), report = await replayContractBatch({ formatVersion: 1, cases: input.cases.slice(0, 333) });
  expect(report).toMatchObject({ status: "EXPECTATIONS_MATCHED", caseCount: 333, checkedCases: 333, matchedCases: 333, mismatchedCases: 0 }); flags(report);
});
it("projects only fixed source cart observation metadata without replay or effect attribution", async () => {
  const input = await contractBatchCaptureExample(), cases = input.cases.filter(row => row.family === "cart-observation" && row.expected.status === "CONSISTENT_OBSERVATION"), report = await replayContractBatch({ formatVersion: 1, cases });
  expect(cases).toHaveLength(10); expect(report).toMatchObject({ status: "EXPECTATIONS_MATCHED", matchedCases: 10 });
  for (const row of report.results) expect(row.observed).toMatchObject({ status: "CONSISTENT_OBSERVATION", initialPhase: "unknown", retainedPriorRead: false, priorUnknown: true, parentGetCalls: 1, observationGetCalls: 1, commandCalls: 1, secondCommandAttempts: 0 });
  flags(report);
});

it("keeps all343 sealed inputs and expectations compatible after adding expected cart observation refusals", async () => {
  const input = await contractBatchCaptureExample(), report = await replayContractBatch({ formatVersion: 1, cases: input.cases.slice(0, 343) });
  expect(report).toMatchObject({ status: "EXPECTATIONS_MATCHED", caseCount: 343, checkedCases: 343, matchedCases: 343, mismatchedCases: 0 }); flags(report);
});
it("matches66 source observation refusals while retaining zero second-command counters", async () => {
  const input = await contractBatchCaptureExample(), cases = input.cases.slice(343, 409), report = await replayContractBatch({ formatVersion: 1, cases });
  expect(cases).toHaveLength(66); expect(cases.every(row => row.family === "cart-observation")).toBe(true);
  expect(report).toMatchObject({ status: "EXPECTATIONS_MATCHED", caseCount: 66, checkedCases: 66, matchedCases: 66 });
  expect(cases.every(row => ["INPUT_INVALID", "CONSUMER_REJECTED", "UNSUPPORTED_CONTEXT"].includes(row.expected.status))).toBe(true);
  for (const row of report.results) expect(row.observed).toMatchObject({ secondCommandAttempts: 0, workspaceObservationAccepted: false, currentReadVersionPrepared: false, readClosed: false });
  expect(report.results.filter(row => row.observed.retainedPriorRead === true)).toHaveLength(6); flags(report);
});

it("keeps all409 sealed cases and expectations compatible after adding support recovery refusals", async () => {
  const input = await contractBatchCaptureExample(), report = await replayContractBatch({ formatVersion: 1, cases: input.cases.slice(0, 409) });
  expect(report).toMatchObject({ status: "EXPECTATIONS_MATCHED", caseCount: 409, checkedCases: 409, matchedCases: 409, mismatchedCases: 0 }); flags(report);
});
it("matches38 source recovery refusals without erasing unknown results or generating a second key", async () => {
  const input = await contractBatchCaptureExample(), cases = input.cases.slice(409), report = await replayContractBatch({ formatVersion: 1, cases });
  expect(cases).toHaveLength(38); expect(cases.every(row => row.family === "support-recovery")).toBe(true);
  expect(report).toMatchObject({ status: "EXPECTATIONS_MATCHED", caseCount: 38, checkedCases: 38, matchedCases: 38 });
  expect(cases.every(row => ["INPUT_INVALID", "CONSUMER_REJECTED", "UNSUPPORTED_CONTEXT"].includes(row.expected.status))).toBe(true);
  for (const row of report.results) expect(row.observed).toMatchObject({ syntheticCapturedKeyReads: 1, initialResponseAccepted: false, sourceResponseAccepted: false });
  expect(report.results.filter(row => row.observed.retainedPriorRead === true)).toHaveLength(2);
  expect(report.results.filter(row => row.observed.unresolved === true)).toHaveLength(34); flags(report);
});
