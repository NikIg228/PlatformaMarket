import { orderWorkflowResponseSchema, orderWorkflowResultSchema } from "../../../../packages/schemas/src/order-workflow";
import { buyerWorkflowCaptureCases, buyerWorkflowCaptureExample, type BuyerWorkflowCaptureCase, type BuyerWorkflowCaptureExample } from "./buyer-workflow-capture-example";
import { replayBuyerWorkflowObservation } from "./buyer-workflow-observation-replay";

export const buyerWorkflowObservationLosses = ["http-500", "invalid-receipt"] as const;
type Loss = typeof buyerWorkflowObservationLosses[number];
export type BuyerWorkflowObservationCase = `${BuyerWorkflowCaptureCase}-${Loss}`;
export const buyerWorkflowObservationCases: readonly BuyerWorkflowObservationCase[] = buyerWorkflowCaptureCases.flatMap(caseId => buyerWorkflowObservationLosses.map(loss => `${caseId}-${loss}` as BuyerWorkflowObservationCase));
export type BuyerWorkflowObservationExample = Omit<BuyerWorkflowCaptureExample, "kind" | "operation"> & {
  kind: "buyer-workflow-observation";
  initial: BuyerWorkflowCaptureExample["operation"];
  observation: BuyerWorkflowCaptureExample["parent"];
};

/** Saved source-only unknown result and independent original-order GET; no command-effect receipt. */
export async function buyerWorkflowObservationExample(caseId: BuyerWorkflowObservationCase = "cancel-http-500"): Promise<BuyerWorkflowObservationExample> {
  const selected = buyerWorkflowCaptureCases.flatMap(sourceCase => buyerWorkflowObservationLosses.map(loss => ({ sourceCase, loss, caseId: `${sourceCase}-${loss}` }))).find(row => row.caseId === caseId);
  if (!selected) throw Error("Unknown synthetic BUYER observation case");
  const source = await buyerWorkflowCaptureExample(selected.sourceCase);
  const observationBody = orderWorkflowResponseSchema.parse(source.parent.body);
  observationBody.version++; observationBody.order.version = observationBody.version;
  const invalidReceipt = orderWorkflowResultSchema.parse(source.operation.body); invalidReceipt.version = source.expected.orderVersion;
  const value: BuyerWorkflowObservationExample = {
    formatVersion: 1, kind: "buyer-workflow-observation", action: source.action, scope: source.scope,
    expected: source.expected, parent: source.parent, ...(source.workspace ? { workspace: source.workspace } : {}),
    initial: { ...source.operation, httpStatus: selected.loss === "http-500" ? 500 : 200, body: selected.loss === "http-500" ? { statusCode: 500, code: "SYNTHETIC_RESPONSE_UNCONFIRMED", message: "SYNTHETIC saved HTTP500" } : invalidReceipt },
    observation: { method: "GET", path: source.parent.path, httpStatus: 200, body: observationBody },
  };
  const report = await replayBuyerWorkflowObservation(value);
  if (report.status !== "CONSISTENT_OBSERVATION" || !report.initialUnresolved || !report.unresolved || !report.sameAttemptInputRetained || !report.originalUUIDRetained || report.commandCalls !== 1 || report.syntheticCapturedKeyReads !== 1 || report.observationGetCalls !== 1) throw Error("Synthetic BUYER observation source rejected: " + caseId);
  return value;
}
