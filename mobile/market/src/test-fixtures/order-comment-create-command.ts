import { orderCommentCreateReceiptFixtureSchema, type CreateOrderCommentInput, type OrderCommentCreateFixture } from "../order-comment-create-command";
import { orderCommentContext, decodeOrderCommentsFixture } from "../order-comments-fixture-read";
import { commentScope, commentId, commentWorkflow, orderComments } from "./order-comments";
export const commentCreateScope=commentScope,commentCreateId=commentId;
export function commentCreateAuthorization():OrderCommentCreateFixture["authorization"]{return {provenance:"synthetic-source-contract",scope:{...commentScope},side:"BUYER",operator:false,permissions:["trust.comment.view","trust.comment.manage"]};}
export function commentCreateWindow(empty=false){const context=orderCommentContext(commentWorkflow(),commentScope.organizationId)!;return {context,comments:decodeOrderCommentsFixture(empty?[]:orderComments(),context)!};}
export function commentCreateResult(orderId:string,input:Readonly<CreateOrderCommentInput>,id=commentId(19001)){return orderCommentCreateReceiptFixtureSchema.parse({id,supplierOrderId:orderId,authorOrganizationId:commentScope.organizationId,authorUserId:commentScope.userId,idempotencyKey:input.idempotencyKey,visibility:"PARTIES_AND_OPERATOR",version:1,body:input.body,createdAt:"2026-10-30T09:10:11.000Z",updatedAt:"2026-10-30T09:10:11.000Z",editedAt:null});}
export function commentCreateError(status:number){return {status,payload:{statusCode:status,code:"SYNTHETIC_COMMENT_ERROR",message:"SYNTHETIC private comment error",path:"/trust/orders/synthetic/comments",timestamp:"2026-10-30T09:10:11.000Z"}};}
