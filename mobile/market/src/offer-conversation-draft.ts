import { checkConversationText, type ConversationTextIssue } from "./order-conversation-draft";
import type { OfferConversationWindow } from "./offer-conversation-read";
import type { ReadScope } from "./read-controller";
export type OfferConversationDraftTarget=Readonly<{offerId:string;productId:string|null;variantId:string|null;buyerOrganizationId:string;supplierOrganizationId:string;conversationId:string|null;version:number|null}>;
export type OfferConversationDraftEntry=Readonly<{target:OfferConversationDraftTarget;formKey:object;intent:"start"|"message";started:boolean;phase:"editing"|"paused";rawBody:string;checked:boolean;issue:ConversationTextIssue|null}>;
export function createOfferConversationDrafts(scope:ReadScope,currentWindow:()=>OfferConversationWindow|null,locked:(offerId:string)=>boolean=()=>false){
 const owner=Object.freeze({...scope}),listeners=new Set<()=>void>();let active=true,frame:OfferConversationWindow|null=null,snapshot:Readonly<Record<string,OfferConversationDraftEntry>>=Object.freeze({});
 const emit=(next:Readonly<Record<string,OfferConversationDraftEntry>>)=>{snapshot=Object.freeze(next);listeners.forEach(listener=>listener());};
 const put=(row:OfferConversationDraftEntry)=>emit({...snapshot,[row.target.offerId]:Object.freeze(row)});
 const owned=(w:OfferConversationWindow)=>active&&owner.product==="market"&&currentWindow()===w&&w.context.buyerOrganizationId===owner.organizationId&&w.context.supplierOrganizationId!==owner.organizationId&&(!w.conversation||w.conversation.contextType==="OFFER"&&w.conversation.contextId===w.context.offerId&&w.conversation.productId===w.context.productId&&w.conversation.buyerOrganizationId===owner.organizationId&&w.conversation.supplierOrganizationId===w.context.supplierOrganizationId);
 const targetFor=(w:OfferConversationWindow):OfferConversationDraftTarget=>Object.freeze({offerId:w.context.offerId,productId:w.context.productId,variantId:w.context.variantId,buyerOrganizationId:w.context.buyerOrganizationId,supplierOrganizationId:w.context.supplierOrganizationId,conversationId:w.conversation?.id??null,version:w.conversation?.version??null});
 const same=(a:OfferConversationDraftTarget,b:OfferConversationDraftTarget)=>a.offerId===b.offerId&&a.productId===b.productId&&a.variantId===b.variantId&&a.buyerOrganizationId===b.buyerOrganizationId&&a.supplierOrganizationId===b.supplierOrganizationId;
 const entryFor=(w:OfferConversationWindow)=>{const row=snapshot[w.context.offerId];return owned(w)&&frame===w&&row&&same(row.target,targetFor(w))&&row.target.conversationId===(w.conversation?.id??null)&&row.target.version===(w.conversation?.version??null)?row:null;};
 const editing=(target:OfferConversationDraftTarget)=>{const w=currentWindow(),row=w?entryFor(w):null;return row?.target===target&&row.started&&row.phase==="editing"&&!locked(target.offerId)?row:null;};
 return {getSnapshot:()=>snapshot,subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},entryFor,
  syncWindow(w:OfferConversationWindow){if(!owned(w)||frame===w)return;frame=w;const next=targetFor(w),old=snapshot[next.offerId],retain=old&&same(old.target,next)&&(!old.target.conversationId||old.target.conversationId===next.conversationId)&&(old.target.version===null||next.version!==null&&next.version>=old.target.version);put({target:next,formKey:retain?old.formKey:Object.freeze({}),intent:retain&&old.started?old.intent:w.conversation?"message":"start",started:retain?old.started:false,phase:"paused",rawBody:retain?old.rawBody:"",checked:retain?old.checked:false,issue:retain?old.issue:null});},
  begin(w:OfferConversationWindow){const row=entryFor(w);if(!row||locked(w.context.offerId))return null;const target=targetFor(w);put({...row,target,intent:row.started?row.intent:w.conversation?"message":"start",started:true,phase:"editing"});return target;},
  isEditing(w:OfferConversationWindow){const row=entryFor(w);return !!row&&!!editing(row.target);},
  setText(target:OfferConversationDraftTarget,rawBody:string){const row=editing(target);if(!row||typeof rawBody!=="string")return false;put({...row,rawBody,checked:false,issue:null});return true;},
  check(target:OfferConversationDraftTarget){const row=editing(target);if(!row)return false;const issue=checkConversationText(row.rawBody);put({...row,checked:true,issue});return issue===null;},
  pause(target:OfferConversationDraftTarget){const row=editing(target);if(!row)return false;put({...row,phase:"paused"});return true;},
  discard(target:OfferConversationDraftTarget){const row=editing(target);if(!row)return false;put({...row,target:Object.freeze({...target}),formKey:Object.freeze({}),intent:target.conversationId?"message":"start",started:false,phase:"paused",rawBody:"",checked:false,issue:null});return true;},
  rebaseIntent(w:OfferConversationWindow){const row=entryFor(w);if(!row?.started||row.phase!=="paused"||locked(w.context.offerId))return false;put({...row,target:targetFor(w),intent:w.conversation?"message":"start",checked:false,issue:null});return true;},
  deactivate(){frame=null;let changed=false;const next={...snapshot};for(const [id,row]of Object.entries(next))if(row.phase==="editing"){next[id]=Object.freeze({...row,phase:"paused"});changed=true;}if(changed)emit(next);},
  invalidateOffer(offerId:string){if(!snapshot[offerId])return;const next={...snapshot};delete next[offerId];if(frame?.context.offerId===offerId)frame=null;emit(next);},
  clear(){frame=null;if(Object.keys(snapshot).length)emit({});},activate(){active=true;},close(){active=false;frame=null;if(Object.keys(snapshot).length)emit({});},
 };
}
export type OfferConversationDrafts=ReturnType<typeof createOfferConversationDrafts>;
