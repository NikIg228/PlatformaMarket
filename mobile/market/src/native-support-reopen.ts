import { z } from "zod";
import { addSupportMessageSchema } from "../../../packages/schemas/src/commercial";
import { supportMessageResponseSchema, type SupportTicketDetail } from "../../../packages/schemas/src/support-workflow";
import type { ReadScope } from "./read-controller";
import { nativeSupportAvailable, type NativeSupportCommands, type NativeSupportReopenInput } from "./native-support-commands";
import { supportCommandRejection, type CommandIssue } from "./support-command-fixture";
import { checkSupportReplyText, type ReplyDraftIssue } from "./support-reply-draft";
export type SupportReopenTarget = Readonly<{ticketId:string;version:number;status:SupportTicketDetail["status"];selection:number}>;
export type SupportReopenReceipt = Readonly<{id:string;ticketId:string;authorId:string;body:string;createdAt:string}>;
export type SupportReopenView = Readonly<{target:SupportReopenTarget;body:string;phase:"editing"|"review"|"pending"|"unknown"|"invalid-result"|"success"|"rejected";previewBody?:string;validation?:ReplyDraftIssue;issue?:CommandIssue;receipt?:SupportReopenReceipt}>;
type Entry={source:SupportTicketDetail;signature:string;target:SupportReopenTarget;view:SupportReopenView;attempt?:Readonly<{input:NativeSupportReopenInput}>;sequence:number;unresolved:boolean};
export type SupportReopenGuard=Readonly<{isAvailable?:()=>boolean;otherWriteLocked?:(ticket:SupportTicketDetail)=>boolean;captureContext?:(ticket:SupportTicketDetail)=>unknown;isContextCurrent?:(proof:unknown)=>boolean;onAccessIssue?:(issue:"authentication"|"denied",ticketId:string)=>void}>;
const messageIdentity=supportMessageResponseSchema.pick({id:true,ticketId:true,authorId:true,isInternal:true});
const messageContent=supportMessageResponseSchema.pick({body:true}).extend({createdAt:z.iso.datetime()});
const terminal=(ticket:SupportTicketDetail)=>ticket.status==="RESOLVED"||ticket.status==="CLOSED";
const signature=(ticket:SupportTicketDetail)=>JSON.stringify([ticket.id,ticket.organizationId,ticket.version,ticket.status,ticket.number,ticket.subject,ticket.updatedAt]);
const locked=(view:SupportReopenView)=>["pending","unknown","invalid-result","success"].includes(view.phase);
/** Explicit own-ticket reopen message only. A reply receipt is not a causal proof of the ticket's current status. */
export function createNativeSupportReopen(scope:ReadScope,port:NativeSupportCommands|undefined,currentTicket:()=>SupportTicketDetail|null,guard:SupportReopenGuard={}){
 const owner=Object.freeze({...scope}),entries=new Map<string,Entry>(),listeners=new Set<()=>void>();let active=true,selection=0,snapshot:Readonly<Record<string,SupportReopenView>>=Object.freeze({});
 const available=()=>active&&!!port&&typeof port.reopenWithMessage==="function"&&nativeSupportAvailable(port,owner)&&(guard.isAvailable?.()??true);
 const own=(ticket:SupportTicketDetail)=>!!ticket&&typeof ticket==="object"&&available()&&currentTicket()===ticket&&ticket.organizationId===owner.organizationId&&z.uuid().safeParse(ticket.id).success;
 const current=(entry:Entry)=>{const ticket=currentTicket();return ticket&&own(ticket)&&ticket.id===entry.target.ticketId?ticket:null;};
 const original=(entry:Entry)=>{const ticket=current(entry);return !!ticket&&ticket===entry.source&&signature(ticket)===entry.signature;};
 const entryFor=(target:SupportReopenTarget)=>{if(!target||typeof target!=="object")return undefined;const entry=entries.get(target.ticketId);return entry?.target===target?entry:undefined;};
 const emit=(entry:Entry,view:SupportReopenView)=>{entry.view=Object.freeze(view);snapshot=Object.freeze({...snapshot,[entry.target.ticketId]:entry.view});listeners.forEach(fn=>fn());};
 const canOpen=(ticket:SupportTicketDetail)=>own(ticket)&&((terminal(ticket)&&!guard.otherWriteLocked?.(ticket))||!!entries.get(ticket.id)&&locked(entries.get(ticket.id)!.view));
 const canReview=(target:SupportReopenTarget)=>{const entry=entryFor(target);return !!entry&&original(entry)&&terminal(entry.source)&&!guard.otherWriteLocked?.(entry.source)&&["editing","rejected"].includes(entry.view.phase);};
 const canConfirm=(target:SupportReopenTarget)=>{const entry=entryFor(target);return !!entry&&entry.view.phase==="review"&&!!entry.view.previewBody&&original(entry)&&terminal(entry.source)&&!guard.otherWriteLocked?.(entry.source);};
 const canRetry=(target:SupportReopenTarget)=>{const entry=entryFor(target),ticket=entry?current(entry):null;return !!entry&&!!ticket&&!!entry.attempt&&!guard.otherWriteLocked?.(ticket)&&["unknown","invalid-result"].includes(entry.view.phase);};
 const execute=async(entry:Entry)=>{
  const ticket=current(entry);if(!ticket||!entry.attempt||entry.view.phase==="pending"||entry.view.phase==="success"||guard.otherWriteLocked?.(ticket))return false;
  const proof=guard.captureContext?.(ticket);if(guard.captureContext&&(proof==null||!guard.isContextCurrent?.(proof)))return false;
  const contextCurrent=()=>!guard.captureContext||!!guard.isContextCurrent?.(proof),attempt=entry.attempt,mine=++entry.sequence;
  const unresolved=(phase:"unknown"|"invalid-result")=>{entry.unresolved=true;emit(entry,{...entry.view,phase,issue:undefined,receipt:undefined});};
  emit(entry,{...entry.view,phase:"pending",validation:undefined,issue:undefined,receipt:undefined});
  try{
   const raw=await port!.reopenWithMessage!(owner,entry.target.ticketId,attempt.input);
   if(!active||entries.get(entry.target.ticketId)!==entry||mine!==entry.sequence)return false;
   if(!current(entry)||!contextCurrent()){unresolved("unknown");return false;}
   const ids=messageIdentity.safeParse(raw);
   if(!ids.success||ids.data.ticketId!==entry.target.ticketId||ids.data.authorId!==owner.userId||ids.data.isInternal){unresolved("invalid-result");return false;}
   const attachments=(raw as {attachments?:unknown}).attachments;
   if(attachments!==null&&(!Array.isArray(attachments)||attachments.length!==0)){unresolved("invalid-result");return false;}
   const content=messageContent.safeParse(raw);
   if(!content.success||content.data.body!==attempt.input.body){unresolved("invalid-result");return false;}
   entry.unresolved=false;emit(entry,{...entry.view,phase:"success",receipt:Object.freeze({id:ids.data.id,ticketId:ids.data.ticketId,authorId:ids.data.authorId,...content.data})});return true;
  }catch(error){
   if(!active||entries.get(entry.target.ticketId)!==entry||mine!==entry.sequence)return false;
   if(!current(entry)||!contextCurrent()){unresolved("unknown");return false;}
   const issue=supportCommandRejection(error);
   if(!issue||entry.unresolved)unresolved("unknown");else emit(entry,{...entry.view,phase:"rejected",issue});
   if(issue==="authentication"||issue==="denied")guard.onAccessIssue?.(issue,entry.target.ticketId);
   return false;
  }
 };
 return {
  getSnapshot:()=>snapshot,subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},
  canOpen,canReview,canConfirm,canRetry,
  viewFor:(ticket:SupportTicketDetail)=>currentTicket()===ticket&&ticket.organizationId===owner.organizationId&&port?.available(owner)===true?snapshot[ticket.id]:undefined,
  blocksTicket:(id:string)=>!!entries.get(id)&&locked(entries.get(id)!.view),
  begin(ticket:SupportTicketDetail){
   if(!canOpen(ticket))return null;const prior=entries.get(ticket.id);
   if(prior&&(locked(prior.view)||(prior.source===ticket&&prior.signature===signature(ticket))))return prior.target;
   const target=Object.freeze({ticketId:ticket.id,version:ticket.version,status:ticket.status,selection:++selection}),view=Object.freeze({target,body:prior?.view.body??"",phase:"editing" as const}),entry:Entry={source:ticket,signature:signature(ticket),target,view,sequence:0,unresolved:false};
   entries.set(ticket.id,entry);emit(entry,view);return target;
  },
  setBody(target:SupportReopenTarget,body:string){const entry=entryFor(target);if(!entry||!canReview(target)||typeof body!=="string")return false;entry.attempt=undefined;emit(entry,{target,body,phase:"editing"});return true;},
  readBody(target:SupportReopenTarget){const entry=entryFor(target);return active&&entry&&!locked(entry.view)?entry.view.body:null;},
  review(target:SupportReopenTarget){const entry=entryFor(target);if(!entry||!canReview(target))return false;const validation=checkSupportReplyText(entry.view.body);if(validation){emit(entry,{...entry.view,phase:"editing",validation});return false;}const previewBody=addSupportMessageSchema.shape.body.parse(entry.view.body);entry.attempt=undefined;emit(entry,{target,body:entry.view.body,phase:"review",previewBody});return true;},
  edit(target:SupportReopenTarget){const entry=entryFor(target);if(!entry||entry.view.phase!=="review"||!original(entry))return false;emit(entry,{target,body:entry.view.body,phase:"editing"});return true;},
  async confirm(target:SupportReopenTarget){const entry=entryFor(target);if(!entry||!canConfirm(target))return false;let key:string;try{key=port!.nextIdempotencyKey();}catch{emit(entry,{...entry.view,phase:"rejected",issue:"key"});return false;}
   const parsed=addSupportMessageSchema.safeParse({idempotencyKey:key,body:entry.view.previewBody,isInternal:false,reopen:true,attachments:[]});if(!parsed.success||parsed.data.reopen!==true){emit(entry,{...entry.view,phase:"rejected",issue:"contract"});return false;}Object.freeze(parsed.data.attachments);entry.attempt=Object.freeze({input:Object.freeze({...parsed.data,isInternal:false,reopen:true,attachments:parsed.data.attachments as []})});return execute(entry);
  },
  retry(target:SupportReopenTarget){const entry=entryFor(target);return entry&&canRetry(target)?execute(entry):Promise.resolve(false);},
  hide(target:SupportReopenTarget){const entry=entryFor(target);if(entry?.view.phase==="review")emit(entry,{target,body:entry.view.body,phase:"editing"});},
  hideAllReviews(){for(const entry of entries.values())if(entry.view.phase==="review")emit(entry,{target:entry.target,body:entry.view.body,phase:"editing"});},
  discard(target:SupportReopenTarget){const entry=entryFor(target);if(!entry||locked(entry.view))return false;entries.delete(target.ticketId);const{[target.ticketId]:_,...rest}=snapshot;snapshot=Object.freeze(rest);listeners.forEach(fn=>fn());return true;},
  complete(target:SupportReopenTarget){const entry=entryFor(target);if(!entry||entry.view.phase!=="success")return false;entries.delete(target.ticketId);const{[target.ticketId]:_,...rest}=snapshot;snapshot=Object.freeze(rest);listeners.forEach(fn=>fn());return true;},
  denyTicket(id:string){const entry=entries.get(id);if(!entry)return;entry.sequence++;entry.unresolved ||=entry.view.phase==="pending";entry.attempt=undefined;emit(entry,{...entry.view,phase:entry.unresolved?"unknown":"rejected",issue:entry.unresolved?undefined:entry.view.issue??"unavailable"});},
  denyAll(){active=false;for(const entry of entries.values()){entry.sequence++;entry.unresolved ||=entry.view.phase==="pending";entry.attempt=undefined;emit(entry,{...entry.view,phase:entry.unresolved?"unknown":"rejected",issue:entry.unresolved?undefined:entry.view.issue??"unavailable"});}},
  activate(){active=true;},dispose(){active=false;for(const entry of entries.values())entry.sequence++;entries.clear();snapshot=Object.freeze({});listeners.forEach(fn=>fn());listeners.clear();},
 };
}
export type NativeSupportReopen=ReturnType<typeof createNativeSupportReopen>;
