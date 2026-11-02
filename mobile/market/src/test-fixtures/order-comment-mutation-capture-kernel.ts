import { createReadController, type ReadScope } from "../read-controller";
import { bindMarketReads } from "../market-transport";
import { createBuyerWorkspaceTransport, type BuyerWorkspaceMutationMethod } from "../buyer-workspace-transport";
import { commentCreateAuthorization } from "./order-comment-create-command";

export const commentMutationCaptureKinds = ["comment-create", "comment-edit"] as const;
export type CommentMutationCaptureKind = typeof commentMutationCaptureKinds[number];
/** Actual controller issues edit provenance. Saved fixture key only, no native key capability. */
export function createCommentMutationCaptureKernel(scope: ReadScope, kind: CommentMutationCaptureKind, parentRead: (path: string) => Promise<unknown>, commentsRead: (path: string) => Promise<unknown>, exchange: (method: BuyerWorkspaceMutationMethod, path: string, body?: Readonly<object>) => Promise<unknown>, savedKey: () => string) {
  let active = true, capturedKeyReads = 0;
  const raw = createBuyerWorkspaceTransport(scope, commentsRead, exchange, () => active), authorization = { ...commentCreateAuthorization(), scope };
  const client = {
    ...bindMarketReads(parentRead, scope.organizationId), orderCommentsFixture: raw.orderComments,
    ...(kind === "comment-create" ? { orderCommentCreateCommandFixture: { authorization, createOrderComment: raw.createOrderComment, nextOrderCommentIdempotencyKey: () => { capturedKeyReads++; return savedKey(); } } } : { orderCommentEditCommandFixture: { authorization, updateOrderComment: raw.updateOrderComment } }),
  };
  const controller = createReadController({ scope, client });
  return { controller, capturedKeyReads: () => capturedKeyReads, close() { active = false; controller.dispose(); raw.close(); } };
}
