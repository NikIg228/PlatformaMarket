import { supportRecoveryFailureCorpus } from "./support-recovery-failure-corpus";
import { cartObservationFailureCorpus } from "./cart-observation-failure-corpus";
import { cartObservationCases, cartCommandObservationExample } from "./cart-command-observation-example";
import { supportRecoveryCases, supportCommandRecoveryExample } from "./support-command-recovery-example";
import { syntheticReadCaptureCorpus } from "./synthetic-read-corpus";
import { syntheticReadFailureCorpus } from "./synthetic-read-failure-corpus";
import { cartOperationCorpus } from "./cart-operation-corpus";
import { workspaceReadCaptureExample } from "./workspace-read-capture-example";
import { cartMutationCaptureExample } from "./cart-mutation-capture-example";
import { cartMutationCaptureKinds } from "./cart-mutation-capture-kernel";
import { cartAddCaptureExample } from "./cart-add-capture-example";
import { savedListMutationCaptureExample } from "./saved-list-mutation-capture-example";
import { savedListCaptureKinds } from "./saved-list-mutation-capture-kernel";
import { commentMutationCaptureExample } from "./order-comment-mutation-capture-example";
import { commentMutationCaptureKinds } from "./order-comment-mutation-capture-kernel";
import { buyerWorkflowCaptureCases, buyerWorkflowCaptureExample } from "./buyer-workflow-capture-example";
import { orderConversationCaptureCases } from "./order-conversation-command-capture-kernel";
import { orderConversationCommandCaptureExample } from "./order-conversation-command-capture-example";
import { offerConversationCaptureCases } from "./offer-conversation-command-capture-kernel";
import { offerConversationCommandCaptureExample } from "./offer-conversation-command-capture-example";
import { archiveChildCaptureKinds } from "./archive-child-capture-kernel";
import { archiveChildCaptureExample } from "./archive-child-capture-example";
import { supportCommandCaptureKinds } from "./support-command-capture-kernel";
import { supportCommandCaptureExample } from "./support-command-capture-example";
import { syntheticCommandFailureCorpus } from "./synthetic-command-failure-corpus";
import { supportArchiveFailureCorpus } from "./support-archive-failure-corpus";
import type { ContractBatchFamily, ContractBatchInput, ContractBatchExpectation } from "./contract-batch-replay";

/** One inline synthetic JSON, no filesystem references. Expected results come from declared original corpus expectations. */
export async function contractBatchCaptureExample(): Promise<ContractBatchInput> {
  const cases: ContractBatchInput["cases"][number][] = [], add = (family: ContractBatchFamily, input: unknown, expected: ContractBatchExpectation) => cases.push(Object.freeze({ family, input, expected: Object.freeze({ ...expected }) }));
  for (const row of await syntheticReadCaptureCorpus()) add(row.format, row.input, { status: "CONSISTENT_READ" });
  for (const row of await syntheticReadFailureCorpus()) add(row.format, row.input, { status: row.expected.status, [row.format === "conversation" ? "phase" : "consumerPhase"]: row.expected.phase, ...(row.expected.summaryIssue ? { summaryIssue: row.expected.summaryIssue } : {}) });
  for (const row of await cartOperationCorpus()) add("cart-operation", row.input, row.expected);
  for (const kind of ["saved-lists", "order-comments"] as const) add("workspace-read", await workspaceReadCaptureExample(kind), { status: "CONSISTENT_READ" });
  for (const kind of cartMutationCaptureKinds) add("cart-mutation", await cartMutationCaptureExample(kind), { status: "CONSISTENT_RESPONSE", commandCalls: 1 });
  for (const existing of [true, false]) add("cart-add", await cartAddCaptureExample(existing), { status: "CONSISTENT_RESPONSE", commandCalls: 1 });
  for (const kind of savedListCaptureKinds) add("saved-list", await savedListMutationCaptureExample(kind), { status: "CONSISTENT_RESPONSE", commandCalls: 1 });
  for (const kind of commentMutationCaptureKinds) add("comment", await commentMutationCaptureExample(kind), { status: "CONSISTENT_RESPONSE", commandCalls: 1 });
  for (const caseId of buyerWorkflowCaptureCases) add("buyer-workflow", await buyerWorkflowCaptureExample(caseId), { status: "CONSISTENT_RESPONSE", operationPhase: "receipt", commandCalls: 1 });
  for (const caseId of orderConversationCaptureCases) add("order-conversation", await orderConversationCommandCaptureExample(caseId), { status: "CONSISTENT_RESPONSE", sourceResponseAccepted: true, unresolved: caseId === "start" || caseId === "escalate", commandCalls: 1 });
  for (const caseId of offerConversationCaptureCases) add("offer-conversation", await offerConversationCommandCaptureExample(caseId), { status: "CONSISTENT_RESPONSE", sourceResponseAccepted: true, unresolved: caseId === "start" || caseId === "escalate", commandCalls: 1 });
  for (const kind of archiveChildCaptureKinds) add("archive", await archiveChildCaptureExample(kind), { status: "CONSISTENT_METADATA", syntheticGetCalls: kind === "archive-related" ? 4 : 2 });
  for (const kind of supportCommandCaptureKinds) add("support", await supportCommandCaptureExample(kind), { status: "CONSISTENT_RESPONSE", operationPhase: "success", commandCalls: 1 });
  for (const row of await syntheticCommandFailureCorpus()) add(row.family, row.input, row.expected);
  for (const row of await supportArchiveFailureCorpus()) add(row.family, row.input, row.expected);
  for (const caseId of supportRecoveryCases) add("support-recovery", await supportCommandRecoveryExample(caseId), { status: "CONSISTENT_RECOVERY", initialPhase: caseId.endsWith("http-500") ? "unknown" : "invalid-result", retryPhase: "success", initialResponseAccepted: false, sourceResponseAccepted: true, unresolved: false, samePreparedRequest: true, explicitSourceRetryPerformed: true, parentGetCalls: 1, observationGetCalls: 1, commandCalls: 2, syntheticCapturedKeyReads: 1 });
  for (const caseId of cartObservationCases) {
    const input = await cartCommandObservationExample(caseId), workspace = caseId.includes("workspace"), prepare = caseId.endsWith("prepare"), close = caseId.endsWith("close");
    add("cart-observation", input, { status: "CONSISTENT_OBSERVATION", initialPhase: "unknown", readPhase: workspace ? "source-changed" : "review", finalPhase: prepare ? caseId.startsWith("quantity") ? "prepared" : "confirm-remove" : workspace || close ? "observed" : "review", priorUnknown: true, retainedPriorRead: false, workspaceObservationAccepted: workspace, readClosed: close, currentReadVersionPrepared: prepare, parentGetCalls: 1, observationGetCalls: 1, commandCalls: 1, secondCommandAttempts: 0 });
  }
  for (const row of await cartObservationFailureCorpus()) add("cart-observation", row.input, { ...row.expected });
  for (const row of await supportRecoveryFailureCorpus()) add("support-recovery", row.input, { ...row.expected });
  return Object.freeze({ formatVersion: 1, cases: Object.freeze(cases) });
}
