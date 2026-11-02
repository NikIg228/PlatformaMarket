import { errorResponseSchema } from "../../../../packages/schemas/src/core-api";
import { cartMutationCaptureExample } from "./cart-mutation-capture-example";
import { cartMutationCaptureKinds } from "./cart-mutation-capture-kernel";
import { replayCartMutationCapture } from "./cart-mutation-capture-replay";
import { cartAddCaptureExample } from "./cart-add-capture-example";
import { replayCartAddCapture } from "./cart-add-capture-replay";
import { savedListMutationCaptureExample } from "./saved-list-mutation-capture-example";
import { savedListCaptureKinds } from "./saved-list-mutation-capture-kernel";
import { replaySavedListMutationCapture } from "./saved-list-mutation-capture-replay";
import { commentMutationCaptureExample } from "./order-comment-mutation-capture-example";
import { commentMutationCaptureKinds } from "./order-comment-mutation-capture-kernel";
import { replayCommentMutationCapture } from "./order-comment-mutation-capture-replay";
import { buyerWorkflowCaptureCases, buyerWorkflowCaptureExample } from "./buyer-workflow-capture-example";
import { replayBuyerWorkflowCapture } from "./buyer-workflow-capture-replay";
import { orderConversationCommandCaptureExample } from "./order-conversation-command-capture-example";
import { orderConversationCaptureCases } from "./order-conversation-command-capture-kernel";
import { replayOrderConversationCommandCapture } from "./order-conversation-command-capture-replay";
import { offerConversationCommandCaptureExample } from "./offer-conversation-command-capture-example";
import { offerConversationCaptureCases } from "./offer-conversation-command-capture-kernel";
import { replayOfferConversationCommandCapture } from "./offer-conversation-command-capture-replay";

export const commandFailureFamilies = ["cart-mutation", "cart-add", "saved-list", "comment", "buyer-workflow", "order-conversation", "offer-conversation"] as const;
export type CommandFailureFamily = typeof commandFailureFamilies[number];
type Input = Awaited<ReturnType<typeof cartMutationCaptureExample | typeof cartAddCaptureExample | typeof savedListMutationCaptureExample | typeof commentMutationCaptureExample | typeof buyerWorkflowCaptureExample | typeof orderConversationCommandCaptureExample | typeof offerConversationCommandCaptureExample>>;
type Source = Readonly<{ family: CommandFailureFamily; sourceCase: string; make: () => Promise<Input> }>;
const sources: readonly Source[] = Object.freeze([
  ...cartMutationCaptureKinds.map(sourceCase => ({ family: "cart-mutation" as const, sourceCase, make: () => cartMutationCaptureExample(sourceCase) })),
  ...([true, false] as const).map(existing => ({ family: "cart-add" as const, sourceCase: existing ? "existing-offer" : "new-offer", make: () => cartAddCaptureExample(existing) })),
  ...savedListCaptureKinds.map(sourceCase => ({ family: "saved-list" as const, sourceCase, make: () => savedListMutationCaptureExample(sourceCase) })),
  ...commentMutationCaptureKinds.map(sourceCase => ({ family: "comment" as const, sourceCase, make: () => commentMutationCaptureExample(sourceCase) })),
  ...buyerWorkflowCaptureCases.map(sourceCase => ({ family: "buyer-workflow" as const, sourceCase, make: () => buyerWorkflowCaptureExample(sourceCase) })),
  ...orderConversationCaptureCases.map(sourceCase => ({ family: "order-conversation" as const, sourceCase, make: () => orderConversationCommandCaptureExample(sourceCase) })),
  ...offerConversationCaptureCases.map(sourceCase => ({ family: "offer-conversation" as const, sourceCase, make: () => offerConversationCommandCaptureExample(sourceCase) })),
]);
export const commandFailureKinds = ["command-http-401", "command-http-429", "command-http-500", "command-path-drift", "parent-http-403"] as const;
type Failure = typeof commandFailureKinds[number];
export type SyntheticCommandFailure = Readonly<{
  id: string; family: CommandFailureFamily; sourceCase: string; failure: Failure; input: Input;
  expected: Readonly<{ status: "INPUT_INVALID" | "CONSUMER_REJECTED"; commandCalls: 0 | 1; parentPhase?: "denied"; operationPhase?: "unknown" | "rejected" }>;
}>;
export const commandFailureDescriptors = Object.freeze(sources.flatMap(({ family, sourceCase }) => commandFailureKinds.map(failure => Object.freeze({ id: `${family}-${sourceCase}-${failure}`, family, sourceCase, failure }))));

function httpError(record: Input["operation"], status: number) {
  record.httpStatus = status;
  record.body = errorResponseSchema.parse({ statusCode: status, code: "SYNTHETIC_COMMAND_ERROR", message: "SYNTHETIC command failure", path: record.path, timestamp: "2026-10-30T01:02:03.000Z" });
}
/** Expected refusals declared independently of replay output. All paths and inputs originate in existing factories. */
export async function syntheticCommandFailureCorpus(): Promise<readonly SyntheticCommandFailure[]> {
  const rows: SyntheticCommandFailure[] = [];
  for (const source of sources) {
    const original = await source.make();
    for (const failure of commandFailureKinds) {
      // Serialized records must be independent even when a positive producer shares source object references.
      const input = JSON.parse(JSON.stringify(original)) as Input;
      let expected: SyntheticCommandFailure["expected"];
      if (failure === "command-path-drift") { input.operation.path += "?synthetic-drift=true"; expected = { status: "INPUT_INVALID", commandCalls: 0 }; }
      else if (failure === "parent-http-403") { httpError(input.parent, 403); expected = { status: "CONSUMER_REJECTED", commandCalls: 0, parentPhase: "denied" }; }
      else {
        const status = failure === "command-http-401" ? 401 : failure === "command-http-429" ? 429 : 500; httpError(input.operation, status);
        // Conversation/public-ticket models retain their own distinct phases in the report.
        const operationPhase = source.family.endsWith("conversation") ? {} : { operationPhase: status === 401 ? "rejected" as const : "unknown" as const };
        expected = { status: "CONSUMER_REJECTED", commandCalls: 1, ...operationPhase };
      }
      rows.push(Object.freeze({ id: `${source.family}-${source.sourceCase}-${failure}`, family: source.family, sourceCase: source.sourceCase, failure, input, expected: Object.freeze(expected) }));
    }
  }
  return Object.freeze(rows);
}

/** Closed dispatcher over existing standalone consumers; never a network or native writer. */
export function replaySyntheticCommandFailure(family: CommandFailureFamily, input: unknown) {
  switch (family) {
    case "cart-mutation": return replayCartMutationCapture(input);
    case "cart-add": return replayCartAddCapture(input);
    case "saved-list": return replaySavedListMutationCapture(input);
    case "comment": return replayCommentMutationCapture(input);
    case "buyer-workflow": return replayBuyerWorkflowCapture(input);
    case "order-conversation": return replayOrderConversationCommandCapture(input);
    case "offer-conversation": return replayOfferConversationCommandCapture(input);
    default: throw Error("Unsupported synthetic command failure family");
  }
}
