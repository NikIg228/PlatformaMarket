import { conversationReadSchema } from "../../../../packages/schemas/src/conversations";
import { conversationSendAuthorization } from "./order-conversation-send";
import { conversationScope, existingConversationId, conversationReadError } from "./order-conversation";
export const readMarkerAuthorization=()=>conversationSendAuthorization({permissions:["support.ticket.view"]});
/** Personal source cursor fixture only; GET flags and conversation snapshots stay separately scripted. */
export function readMarkerProtocol(initial=0){let cursor=initial,calls=0;return {cursor:()=>cursor,calls:()=>calls,accept(scope:typeof conversationScope,id:string,input:Readonly<{throughSequence:number}>){conversationReadSchema.parse(input);if(scope.organizationId!==conversationScope.organizationId||scope.userId!==conversationScope.userId||id!==existingConversationId)throw conversationReadError(404);if(input.throughSequence>200)throw conversationReadError(400);calls++;cursor=Math.max(cursor,input.throughSequence);return {throughSequence:cursor};}};}
