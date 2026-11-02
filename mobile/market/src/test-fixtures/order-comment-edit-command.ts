import { orderCommentRowFixtureSchema } from "../order-comment-row-fixture";
import type { EditOrderCommentInput } from "../order-comment-edit-command";
import { orderComment, commentScope, commentId } from "./order-comments";
export { commentScope as commentEditScope, commentId as commentEditId } from "./order-comments";
export { commentCreateAuthorization as commentEditAuthorization } from "./order-comment-create-command";
export function commentEditRawRow(){return orderCommentRowFixtureSchema.parse(orderComment({id:commentId(19401),authorUserId:commentScope.userId,body:"  SYNTHETIC original own comment\nБастапқы мәтін  ",version:2}));}
export function commentEditResult(row:ReturnType<typeof commentEditRawRow>,input:Readonly<EditOrderCommentInput>,version=input.version+1){return orderCommentRowFixtureSchema.parse({...row,version,body:input.body,editedAt:"2026-10-30T11:12:13.000Z",updatedAt:"2026-10-30T11:12:13.000Z"});}
export function commentEditError(status:number){return {status,payload:{statusCode:status,code:"SYNTHETIC_COMMENT_EDIT_ERROR",message:"SYNTHETIC private edit error",path:"/trust/comments/synthetic",timestamp:"2026-10-30T11:12:13.000Z"}};}
