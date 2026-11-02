import { jest } from "@jest/globals";
import { savedListObservationFailureCases, savedListObservationFailureExample, type SavedListObservationFailureCase } from "./test-fixtures/saved-list-observation-failure-corpus";
import { savedListObservationExample } from "./test-fixtures/saved-list-observation-example";
import { replaySavedListObservation } from "./test-fixtures/saved-list-observation-replay";

afterEach(() => jest.restoreAllMocks());
it.each(savedListObservationFailureCases)("replays one raw refused transcript with fixed original-source semantics: %s", async caseId => {
  const fetcher = jest.spyOn(globalThis, "fetch").mockRejectedValue(Error("Unexpected real network"));
  const sample = await savedListObservationFailureExample(caseId), saved = JSON.stringify(sample.input), raw = JSON.parse(saved), report = await replaySavedListObservation(raw);
  expect(report).toEqual(sample.expected); expect(report.status).not.toBe("CONSISTENT_OBSERVATION"); expect(JSON.stringify(raw)).toBe(saved); expect(fetcher).not.toHaveBeenCalled();
  const source = await savedListObservationExample(`${sample.sourceKind}-http-500`);
  expect({ ...raw, observation: source.observation }).toEqual(source);
  expect(report.serverAccepted).toBe(false); expect(report.effectProven).toBe(false); expect(report.writeReplayPerformed).toBe(false); expect(report.observedEffectAttributed).toBe(false);
  for (const privateText of ["00000000-", "SYNTHETIC saved", "requestBody", "rawName", "idempotencyKey"]) expect(JSON.stringify(report)).not.toContain(privateText);
});
it("enumerates exactly18 unique cases, with three original contexts and six failure classes", () => {
  expect(savedListObservationFailureCases).toHaveLength(18); expect(new Set(savedListObservationFailureCases).size).toBe(18);
  expect(savedListObservationFailureCases.filter(id => id.endsWith("observation-path-drift"))).toHaveLength(3);
});
it("does not interpret an unlisted failure as a source scenario", async () => { await expect(savedListObservationFailureExample("unlisted" as SavedListObservationFailureCase)).rejects.toThrow("Unknown synthetic saved-list observation failure case"); });
