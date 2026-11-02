import { replayBuyerWorkflowObservation } from "./buyer-workflow-observation-replay";
import { replayCartCommandObservation } from "./cart-command-observation-replay";
import { replaySupportCommandRecovery } from "./support-command-recovery-replay";
import { replaySyntheticReadCapture } from "./synthetic-read-corpus";
import { replayCartOperationCapture } from "./cart-operation-capture-replay";
import { replayWorkspaceReadCapture } from "./workspace-read-capture-replay";
import { replayCartMutationCapture } from "./cart-mutation-capture-replay";
import { replayCartAddCapture } from "./cart-add-capture-replay";
import { replaySavedListMutationCapture } from "./saved-list-mutation-capture-replay";
import { replayCommentMutationCapture } from "./order-comment-mutation-capture-replay";
import { replayBuyerWorkflowCapture } from "./buyer-workflow-capture-replay";
import { replayOrderConversationCommandCapture } from "./order-conversation-command-capture-replay";
import { replayOfferConversationCommandCapture } from "./offer-conversation-command-capture-replay";
import { replayArchiveChildCapture } from "./archive-child-capture-replay";
import { replaySupportCommandCapture } from "./support-command-capture-replay";

export const contractBatchFamilies = ["core", "metadata", "conversation", "cart-operation", "workspace-read", "cart-mutation", "cart-add", "saved-list", "comment", "buyer-workflow", "order-conversation", "offer-conversation", "archive", "support", "support-recovery", "cart-observation", "buyer-observation"] as const;
export type ContractBatchFamily = typeof contractBatchFamilies[number];
export const contractBatchStatuses = ["INPUT_INVALID", "CONSISTENT_READ", "CONSISTENT_RESPONSE", "CONSISTENT_METADATA", "CONSISTENT_RECOVERY", "CONSISTENT_OBSERVATION", "CONSUMER_REJECTED", "UNSUPPORTED_READ", "UNSUPPORTED_CONTEXT", "LIMITED_READ"] as const;
type ConsumerStatus = typeof contractBatchStatuses[number];
type Scalar = string | number | boolean | null;
export type ContractBatchExpectation = Readonly<Record<string, Scalar> & { status: ConsumerStatus }>;
export type ContractBatchInput = Readonly<{ formatVersion: 1; cases: readonly Readonly<{ family: ContractBatchFamily; expected: ContractBatchExpectation; input: unknown }>[] }>;
const fields = ["status", "phase", "consumerPhase", "parentPhase", "operationPhase", "validationPhase", "validationIssue", "operationIssue", "summaryIssue", "savedReceiptStatus", "commandCalls", "syntheticGetCalls", "validationCalls", "keyRequests", "unresolved", "sourceResponseAccepted", "matchedRecords", "metadataRows", "initialPhase", "retryPhase", "retryIssue", "observationPhase", "initialResponseAccepted", "samePreparedRequest", "explicitSourceRetryPerformed", "parentGetCalls", "observationGetCalls", "syntheticCapturedKeyReads", "readPhase", "finalPhase", "priorUnknown", "retainedPriorRead", "workspaceObservationAccepted", "readClosed", "currentReadVersionPrepared", "secondCommandAttempts"] as const;
const buyerObservationFields = [...fields, "stage", "initialUnresolved", "workspaceGetCalls", "sameAttemptInputRetained", "originalUUIDRetained", "automaticRetryPerformed", "writeReplayPerformed", "returnedIdReadPerformed", "observedEffectAttributed", "readAcknowledged", "newAttemptPrepared"] as const;
type ReportField = typeof buyerObservationFields[number];
function reportFields(family: ContractBatchFamily): readonly ReportField[] { return family === "buyer-observation" ? buyerObservationFields : fields; }
type CaseResult = Readonly<{ index: number; family: ContractBatchFamily; matched: boolean; consumerCompleted: boolean; observed: Readonly<Partial<Record<ReportField, Scalar>>> }>;
export type ContractBatchReport = Readonly<{
  status: "INPUT_INVALID" | "EXPECTATIONS_MATCHED" | "EXPECTATIONS_MISMATCHED";
  caseCount: number; checkedCases: number; matchedCases: number; mismatchedCases: number; results: readonly CaseResult[];
  provenance: "EXISTING_SOURCE_CONSUMERS_ONLY"; expectedRefusalIsAPIAcceptance: false; serverAccepted: false; effectProven: false;
  nativeBindingPerformed: false; keyProviderAccessed: false; credentialStoreAccessed: false; privateFileBytesAccessed: false;
  originalChecksumVerified: false; cryptographicSignatureVerified: false; networkRequests: 0; mutations: 0;
}>;
class BatchInputError extends Error { constructor() { super("Invalid offline contract batch"); } }
function object(input: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new BatchInputError(); const prototype = Object.getPrototypeOf(input); if (prototype !== Object.prototype && prototype !== null) throw new BatchInputError();
  for (const key of Reflect.ownKeys(input)) if (typeof key !== "string" || !allowed.includes(key)) throw new BatchInputError(); return input as Record<string, unknown>;
}
function scalar(value: unknown): value is Scalar {
  return value === null || typeof value === "boolean" || typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000 || typeof value === "string" && value.length <= 64 && /^[A-Za-z]+(?:[-_][A-Za-z]+)*$/.test(value);
}
function expectation(input: unknown, family: ContractBatchFamily): ContractBatchExpectation {
  const raw = object(input, reportFields(family)), snapshot: Record<string, Scalar> = {};
  for (const field of Object.keys(raw)) { const value = raw[field]; if (!scalar(value)) throw new BatchInputError(); Object.defineProperty(snapshot, field, { value, enumerable: true }); }
  if (!contractBatchStatuses.includes(snapshot.status as ConsumerStatus)) throw new BatchInputError(); return Object.freeze(snapshot) as ContractBatchExpectation;
}
function dispatch(family: ContractBatchFamily, input: unknown) {
  switch (family) {
    case "core": case "metadata": case "conversation": return replaySyntheticReadCapture(family, input);
    case "cart-operation": return replayCartOperationCapture(input);
    case "workspace-read": return replayWorkspaceReadCapture(input);
    case "cart-mutation": return replayCartMutationCapture(input);
    case "cart-add": return replayCartAddCapture(input);
    case "saved-list": return replaySavedListMutationCapture(input);
    case "comment": return replayCommentMutationCapture(input);
    case "buyer-workflow": return replayBuyerWorkflowCapture(input);
    case "order-conversation": return replayOrderConversationCommandCapture(input);
    case "offer-conversation": return replayOfferConversationCommandCapture(input);
    case "archive": return replayArchiveChildCapture(input);
    case "support": return replaySupportCommandCapture(input);
    case "support-recovery": return replaySupportCommandRecovery(input);
    case "cart-observation": return replayCartCommandObservation(input);
    case "buyer-observation": return replayBuyerWorkflowObservation(input);
  }
}
function project(input: unknown, family: ContractBatchFamily): CaseResult["observed"] {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new BatchInputError(); const source = input as Record<string, unknown>;
  if (source.serverAccepted !== false || source.productionAuthorizationVerified !== false || (source.networkRequests ?? source.realNetworkRequests) !== 0 || (source.mutations ?? source.realServerMutations) !== 0) throw new BatchInputError();
  for (const field of ["credentialStoreAccessed", "nativeBindingPerformed", "keyProviderAccessed", "nativeKeyProviderAccessed", "effectProven", "privateFileBytesAccessed", "originalFileBytesAccessed", "originalChecksumVerified", "cryptographicSignatureVerified", "automaticRetryPerformed", "returnedIdReadPerformed", "observedEffectAttributed", "writeReplayPerformed"]) if (Object.hasOwn(source, field) && source[field] !== false) throw new BatchInputError();
  const observed: Partial<Record<ReportField, Scalar>> = {};
  for (const field of reportFields(family)) if (Object.hasOwn(source, field)) { const value = source[field]; if (value === undefined) continue; if (!scalar(value)) throw new BatchInputError(); observed[field] = value; }
  if (!contractBatchStatuses.includes(observed.status as ConsumerStatus)) throw new BatchInputError(); return Object.freeze(observed);
}
/** One bounded inline batch, no referenced files, code execution, real HTTP, grant or effect proof. */
export async function replayContractBatch(input: unknown): Promise<ContractBatchReport> {
  let caseCount = 0; const results: CaseResult[] = [];
  const report = (status: ContractBatchReport["status"]): ContractBatchReport => Object.freeze({ status, caseCount, checkedCases: results.length, matchedCases: results.filter(row => row.matched).length, mismatchedCases: results.filter(row => !row.matched).length, results: Object.freeze([...results]), provenance: "EXISTING_SOURCE_CONSUMERS_ONLY", expectedRefusalIsAPIAcceptance: false, serverAccepted: false, effectProven: false, nativeBindingPerformed: false, keyProviderAccessed: false, credentialStoreAccessed: false, privateFileBytesAccessed: false, originalChecksumVerified: false, cryptographicSignatureVerified: false, networkRequests: 0, mutations: 0 });
  try {
    const envelope = object(input, ["formatVersion", "cases"]); if (envelope.formatVersion !== 1) throw new BatchInputError(); const cases = envelope.cases;
    if (!Array.isArray(cases) || cases.length < 1 || cases.length > 512 || Reflect.ownKeys(cases).some(key => key !== "length" && (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/.test(key)))) throw new BatchInputError();
    // Validate every row header and expectation before accessing any saved input.
    const headers = Array.from({ length: cases.length }, (_, index) => {
      if (!Object.hasOwn(cases, index)) throw new BatchInputError(); const raw = object(cases[index], ["family", "expected", "input"]), family = raw.family;
      if (typeof family !== "string" || !contractBatchFamilies.includes(family as ContractBatchFamily) || !Object.hasOwn(raw, "input")) throw new BatchInputError();
      return { raw, family: family as ContractBatchFamily, expected: expectation(raw.expected, family as ContractBatchFamily) };
    });
    caseCount = headers.length;
    for (const [index, row] of headers.entries()) {
      try { const observed = project(await dispatch(row.family, row.raw.input), row.family), matched = Object.keys(row.expected).every(field => Object.is(observed[field as ReportField], row.expected[field])); results.push(Object.freeze({ index, family: row.family, matched, consumerCompleted: true, observed })); }
      catch { results.push(Object.freeze({ index, family: row.family, matched: false, consumerCompleted: false, observed: Object.freeze({}) })); }
    }
    return report(results.every(row => row.matched) ? "EXPECTATIONS_MATCHED" : "EXPECTATIONS_MISMATCHED");
  } catch { return report("INPUT_INVALID"); }
}
