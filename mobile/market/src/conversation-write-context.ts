import { conversationMessageInputSchema } from "../../../packages/schemas/src/conversations";
import type { ReadScope } from "./read-controller";
const same=(a:ReadScope,b:ReadScope)=>a.product==="market"&&a.product===b.product&&a.environment===b.environment&&a.organizationId===b.organizationId&&a.userId===b.userId&&a.generation===b.generation;
/** Scope-owned UUID/authority metadata only, shared by conversation write protocols. */
export function createConversationWriteContext(scope:ReadScope){
 const owner=Object.freeze({...scope}),issued=new Set<string>(),listeners=new Set<()=>void>();let active=true,authority:"authentication"|"denied"|null=null;
 return {matches:(other:ReadScope)=>same(owner,other),isActive:()=>active,authorityIssue:()=>authority,
  issue(provider:()=>unknown){if(!active||authority||owner.product!=="market")return null;let raw:unknown;try{raw=provider();}catch{return null;}const parsed=conversationMessageInputSchema.shape.idempotencyKey.safeParse(raw);if(!parsed.success||issued.has(parsed.data))return null;issued.add(parsed.data);return parsed.data;},
  deny(issue:"authentication"|"denied"){if(!active)return;const next=authority==="authentication"?authority:issue;if(authority===next)return;authority=next;listeners.forEach(listener=>listener());},
  subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
  activate(){active=true;},close(){active=false;authority=null;issued.clear();listeners.clear();},
 };
}
export type ConversationWriteContext=ReturnType<typeof createConversationWriteContext>;
