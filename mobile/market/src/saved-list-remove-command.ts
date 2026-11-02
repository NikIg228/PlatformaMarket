import { nativeSavedListAvailable, type NativeSavedListCommands } from "./native-saved-list-commands";
import { z } from "zod";
import { errorResponseSchema } from "../../../packages/schemas/src/core-api";
import { authorizedSavedListMutation, createSavedListCommandContext, ownedSavedListsPage, type SavedListCommandContext, type SavedListMutationAuthorization } from "./saved-list-command-context";
import type { FixtureSavedList } from "./saved-lists-fixture-read";
import type { ReadScope } from "./read-controller";
export type SavedListRemoveFixture={authorization:SavedListMutationAuthorization;removeSavedListItem:(scope:ReadScope,listId:string,itemId:string)=>Promise<unknown>};
export type SavedListRemoveFixtureClient={savedListRemoveCommandFixture?:SavedListRemoveFixture};
type Item=FixtureSavedList["items"][number];
export type SavedListRemoval=Readonly<{listId:string;itemId:string;offerId:string;listName:string;quantity:string;note:string|null}>;
type Frame=Readonly<{page:readonly FixtureSavedList[];list:FixtureSavedList;item:Item;signature:string;target:SavedListRemoval}>;
type Attempt=Readonly<{number:number;frame:Frame}>;
export type UnknownSavedListRemoval=Readonly<{number:number;target:SavedListRemoval}>;
export type SavedListRemoveState=Readonly<{phase:"idle"|"prepared"|"pending"|"result"|"unknown"|"rejected"|"reading"|"review"|"read-error"|"observed";target?:SavedListRemoval;result?:true;latest?:readonly FixtureSavedList[];priorUnknown:readonly UnknownSavedListRemoval[];unresolved?:boolean;issue?:"authentication"|"denied"|"not-found"|"invalid-result"|"context"}>;
const deletedFixtureSchema=z.object({deleted:z.literal(true)}).strip(); // Local source-result decoder, not a shared/current API contract.
const emptyUnknown=Object.freeze([]) as readonly UnknownSavedListRemoval[],idle:SavedListRemoveState=Object.freeze({phase:"idle",priorUnknown:emptyUnknown});
export function createSavedListRemoveCommands(scope:ReadScope,fixture:SavedListRemoveFixture|undefined,currentPage:()=>readonly FixtureSavedList[]|null,reloadPage:()=>Promise<readonly FixtureSavedList[]|undefined>,isWorkspaceActive:()=>boolean,otherLocked:()=>boolean=()=>false,supportsRead=true,context:SavedListCommandContext=createSavedListCommandContext(scope),native?:NativeSavedListCommands){
 const owner=Object.freeze({...scope}),listeners=new Set<()=>void>(),unknownNumbers=new Set<number>(),completedIds=new Set<string>();let active=true,disposed=false,state=idle,sequence=0,counter=0,unknowns=emptyUnknown,prepared:Frame|null=null,attempt:Attempt|null=null,reviewed:readonly FixtureSavedList[]|null=null;
 const emit=(next:SavedListRemoveState)=>{state=Object.freeze({...next,priorUnknown:unknowns});listeners.forEach(listener=>listener());};
 const available=()=>active&&supportsRead&&context.isActive()&&context.matches(owner)&&(native?nativeSavedListAvailable(native,owner):authorizedSavedListMutation(owner,fixture?.authorization)&&typeof fixture?.removeSavedListItem==="function");
 const authority=()=>context.matches(owner)?context.authorityIssue():null,blocks=()=>active&&context.isActive()&&context.matches(owner)&&(!!authority()||!["idle","observed"].includes(state.phase));
 const ownedPage=(page:readonly FixtureSavedList[])=>ownedSavedListsPage(owner,page,currentPage());
 const frameFor=(page:readonly FixtureSavedList[],list:FixtureSavedList,item:Item):Frame|null=>{if(!ownedPage(page)||!page.includes(list)||!list.items.includes(item)||item.listId!==list.id)return null;const target=Object.freeze({listId:list.id,itemId:item.id,offerId:item.offerId,listName:list.name,quantity:item.quantity,note:item.note}),signature=JSON.stringify({target,updatedAt:list.updatedAt,itemUpdatedAt:item.updatedAt,itemCreatedAt:item.createdAt});return Object.freeze({page,list,item,target,signature});};
 const sourceCurrent=(frame:Frame)=>{const now=frameFor(frame.page,frame.list,frame.item);return !!now&&now.signature===frame.signature;};
 const unknown=(work:Attempt,issue?:SavedListRemoveState["issue"])=>{if(!unknownNumbers.has(work.number)){unknownNumbers.add(work.number);unknowns=Object.freeze([...unknowns,Object.freeze({number:work.number,target:work.frame.target})]);}emit({...state,phase:"unknown",issue,result:undefined,unresolved:true});};
 const denyAll=()=>{active=false;sequence++;prepared=null;attempt=null;reviewed=null;unknowns=emptyUnknown;unknownNumbers.clear();completedIds.clear();emit({...idle,phase:"rejected",issue:"denied"});};
 return {
  runtime:native?"native-session" as const:"fixture" as const,getSnapshot:()=>state,subscribe(listener:()=>void){listeners.add(listener);const off=context.subscribe(()=>{state=Object.freeze({...state});listener();});return()=>{listeners.delete(listener);off();};},isAvailable:available,authorityIssue:authority,blocksOtherMutations:blocks,
  canPrepare(page:readonly FixtureSavedList[],list:FixtureSavedList,item:Item){return available()&&!authority()&&!otherLocked()&&isWorkspaceActive()&&["idle","observed"].includes(state.phase)&&!!frameFor(page,list,item)&&!completedIds.has(item.id);},
  prepare(page:readonly FixtureSavedList[],list:FixtureSavedList,item:Item){if(!this.canPrepare(page,list,item))return false;const frame=frameFor(page,list,item);if(!frame)return false;prepared=frame;attempt=null;reviewed=null;emit({...idle,phase:"prepared",target:frame.target,priorUnknown:unknowns});return true;},
  canReview(page:readonly FixtureSavedList[]){return available()&&isWorkspaceActive()&&state.phase==="prepared"&&!!prepared&&prepared.page===page&&sourceCurrent(prepared);},
  cancelPreparation(){if(!available()||state.phase!=="prepared")return false;prepared=null;emit({...idle,priorUnknown:unknowns});return true;},
  canConfirm(){return available()&&!authority()&&!otherLocked()&&!!prepared&&this.canReview(prepared.page)&&!completedIds.has(prepared.target.itemId);},
  async confirm(){if(!prepared||!this.canConfirm())return;const work:Attempt=Object.freeze({number:++counter,frame:prepared});attempt=work;prepared=null;reviewed=null;const ownSequence=++sequence;emit({...state,phase:"pending",unresolved:false,issue:undefined});
   try{const body=await (native?native.remove(owner,work.frame.target.listId,work.frame.target.itemId):fixture!.removeSavedListItem(owner,work.frame.target.listId,work.frame.target.itemId));if(!active||ownSequence!==sequence)return;if(!available()){denyAll();return;}if(!isWorkspaceActive()||!sourceCurrent(work.frame)){unknown(work,"context");return;}const parsed=deletedFixtureSchema.safeParse(body);if(!parsed.success){unknown(work,"invalid-result");return;}completedIds.add(work.frame.target.itemId);emit({...state,phase:"result",result:true,unresolved:false,issue:undefined});
   }catch(error){if(!active||ownSequence!==sequence)return;if(!available()){denyAll();return;}if(!isWorkspaceActive()||!sourceCurrent(work.frame)){unknown(work,"context");return;}const parsed=typeof error==="object"&&error!==null&&"payload"in error&&"status"in error?errorResponseSchema.safeParse(error.payload):null,status=typeof error==="object"&&error!==null&&"status"in error?error.status:undefined;if(!parsed?.success||parsed.data.statusCode!==status||![401,403,404].includes(status as number)){unknown(work);return;}const issue=status===401?"authentication":status===403?"denied":"not-found";if(issue==="authentication"||issue==="denied")context.deny(issue);emit({...state,phase:"rejected",issue});}
  },
  canRead(){return available()&&!authority()&&isWorkspaceActive()&&(!!attempt||unknowns.length>0)&&["idle","result","unknown","rejected","read-error","review","observed"].includes(state.phase);},
  async readCurrent(){if(!this.canRead())return;const ownSequence=++sequence;reviewed=null;emit({...state,phase:"reading",latest:undefined});try{const page=await reloadPage();if(!active||ownSequence!==sequence)return;if(!available()){denyAll();return;}if(!page||!ownedPage(page)){emit({...state,phase:"read-error"});return;}reviewed=page;emit({...state,phase:"review",latest:page,issue:undefined});}catch{if(active&&ownSequence===sequence)emit({...state,phase:"read-error"});}},
  canAcknowledge(){return available()&&state.phase==="review"&&!!reviewed&&ownedPage(reviewed);},
  acknowledge(){if(!this.canAcknowledge())return false;reviewed=null;emit({...state,phase:"observed",latest:undefined});return true;},
  denyAll,activate(){if(disposed){disposed=false;active=true;}},dispose(){active=false;disposed=true;sequence++;prepared=null;attempt=null;reviewed=null;unknowns=emptyUnknown;unknownNumbers.clear();completedIds.clear();emit(idle);listeners.clear();},
 };
}
export type SavedListRemoveCommands=ReturnType<typeof createSavedListRemoveCommands>;
