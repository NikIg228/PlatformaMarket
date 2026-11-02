import { errorResponseSchema } from "../../../../packages/schemas/src/core-api";
import { savedListCaptureKinds } from "./saved-list-mutation-capture-kernel";
import { savedListMutationCaptureExample, type SavedListMutationCaptureExample } from "./saved-list-mutation-capture-example";
import { replaySavedListObservation } from "./saved-list-observation-replay";

export const savedListObservationLosses = ["http-500", "invalid-receipt"] as const;
export type SavedListObservationCase = `${typeof savedListCaptureKinds[number]}-${typeof savedListObservationLosses[number]}`;
export const savedListObservationCases: readonly SavedListObservationCase[] = savedListCaptureKinds.flatMap(kind => savedListObservationLosses.map(loss => `${kind}-${loss}` as SavedListObservationCase));
export type SavedListObservationExample = Omit<SavedListMutationCaptureExample, "operation"> & { mode: "saved-list-observation"; initial: SavedListMutationCaptureExample["operation"]; observation: SavedListMutationCaptureExample["parent"] };

/** An unchanged own-list snapshot does not identify the outcome of a previous unknown write. */
export async function savedListObservationExample(caseId: SavedListObservationCase = "list-create-http-500"): Promise<SavedListObservationExample> {
  const selected = savedListCaptureKinds.flatMap(kind => savedListObservationLosses.map(loss => ({ kind, loss, caseId: `${kind}-${loss}` }))).find(row => row.caseId === caseId);
  if (!selected) throw Error("Unknown synthetic saved-list observation case");
  const { operation, ...source } = await savedListMutationCaptureExample(selected.kind);
  const value: SavedListObservationExample = {
    ...source, mode: "saved-list-observation",
    initial: { ...operation, httpStatus: selected.loss === "http-500" ? 500 : 200, body: selected.loss === "http-500" ? errorResponseSchema.parse({ statusCode: 500, code: "SYNTHETIC_RESPONSE_UNKNOWN", message: "SYNTHETIC saved initial write error", path: operation.path, timestamp: "2026-10-30T01:02:03.000Z" }) : {} },
    observation: JSON.parse(JSON.stringify(source.parent)) as SavedListMutationCaptureExample["parent"],
  };
  const report = await replaySavedListObservation(value);
  if (report.status !== "CONSISTENT_OBSERVATION" || !report.initialUnresolved || !report.unresolved || !report.sameUnknownRecordRetained || !report.sameAttemptInputRetained || report.commandCalls !== 1 || report.observationGetCalls !== 1) throw Error("Synthetic saved-list observation source rejected: " + caseId);
  return value;
}
