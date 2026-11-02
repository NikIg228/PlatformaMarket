import { nativeSavedListAvailable, type NativeSavedListCommands } from "./native-saved-list-commands";
import { ownedSavedListsPage, authorizedSavedListMutation, createSavedListCommandContext, type SavedListCommandContext, type SavedListMutationAuthorization } from "./saved-list-command-context";
import { upsertSavedListItemSchema } from "../../../packages/schemas/src/commercial";
import { errorResponseSchema, type OfferComparisonResponse } from "../../../packages/schemas/src/core-api";
import { selectComparedOffer } from "../../../contracts/mobile-read/read-adapter";
import { savedListItemFixtureSchema, type FixtureSavedList } from "./saved-lists-fixture-read";
import { checkListQuantity, checkListText, type LocalListDraft, type LocalListTarget, type ListQuantityIssue, type ListTextIssue } from "./local-list-draft";
import { decimalIdentity } from "./cart-quantity-draft";
import type { ReadScope } from "./read-controller";
import type { z } from "zod";
export type SavedListItemInput=z.output<typeof upsertSavedListItemSchema>;
export type SavedListItemCommandFixture={authorization:SavedListMutationAuthorization;upsertSavedListItem:(scope:ReadScope,listId:string,input:Readonly<SavedListItemInput>)=>Promise<unknown>};
export type SavedListItemFixtureClient={savedListItemCommandFixture?:SavedListItemCommandFixture};
export type SavedListStorageIssue=ListQuantityIssue|{kind:"storage"};
export function checkSavedListStorageQuantity(raw:string):SavedListStorageIssue|null{
 const issue=checkListQuantity(raw);if(issue)return issue;const identity=decimalIdentity(raw.trim().replace(",","."))!,parts=/^([1-9]\d*)e(-?\d+)$/.exec(identity);if(!parts)return {kind:"storage"};const exponent=Number(parts[2]);return !Number.isSafeInteger(exponent)||exponent< -6||parts[1]!.length+exponent>12?{kind:"storage"}:null;
}
type Item=FixtureSavedList["items"][number];
type Choice=Readonly<{target:LocalListTarget;rawQuantity:string;rawNote:string;input:Readonly<SavedListItemInput>;productName:string;supplierName:string;packagingName:string}>;
type Frame=Readonly<{page:readonly FixtureSavedList[];list:FixtureSavedList;listId:string;listName:string;isDefault:boolean;updatedAt:string;previous:Readonly<Item>|null}>;
type Attempt=Readonly<{number:number;choice:Choice;frame:Frame;input:Readonly<SavedListItemInput>}>;
export type UnknownSavedListWrite=Readonly<{number:number;listId:string;listName:string;offerId:string;input:Readonly<SavedListItemInput>;rawQuantity:string;rawNote:string}>;
export type SavedListItemCommandState=Readonly<{phase:"idle"|"selected"|"prepared"|"pending"|"result"|"unknown"|"rejected"|"reading"|"review"|"read-error"|"observed";choice?:Choice;frame?:Frame;input?:Readonly<SavedListItemInput>;result?:Item;latest?:readonly FixtureSavedList[];priorUnknown:readonly UnknownSavedListWrite[];unresolved?:boolean;selectionTarget?:LocalListTarget;checkedQuantity?:string;checkedNote?:string;quantityIssue?:SavedListStorageIssue;noteIssue?:ListTextIssue;selectionIssue?:"source";issue?:"validation"|"authentication"|"denied"|"not-found"|"invalid-result"|"context"}>;
const emptyUnknown=Object.freeze([]) as readonly UnknownSavedListWrite[],idle:SavedListItemCommandState=Object.freeze({phase:"idle",priorUnknown:emptyUnknown});
const resultBinding=savedListItemFixtureSchema.pick({id:true,listId:true,offerId:true}).strip();
export function createSavedListItemCommands(scope:ReadScope,fixture:SavedListItemCommandFixture|undefined,draft:LocalListDraft,currentComparison:()=>OfferComparisonResponse|null,currentPage:()=>readonly FixtureSavedList[]|null,reloadPage:()=>Promise<readonly FixtureSavedList[]|undefined>,isWorkspaceActive:()=>boolean,otherLocked:()=>boolean=()=>false,supportsRead=true,context:SavedListCommandContext=createSavedListCommandContext(scope),native?:NativeSavedListCommands){
 const owner=Object.freeze({...scope}),listeners=new Set<()=>void>(),unknownNumbers=new Set<number>();let active=true,disposed=false,sequence=0,attemptCounter=0,state=idle,attempt:Attempt|null=null,prepared:Omit<Attempt,"number">|null=null,reviewed:readonly FixtureSavedList[]|null=null,unknowns=emptyUnknown;
 const emit=(next:SavedListItemCommandState)=>{state=Object.freeze({...next,priorUnknown:unknowns});listeners.forEach(listener=>listener());};
 const sameScope=()=>owner.product===draft.context.product&&owner.environment===draft.context.environment&&owner.userId===draft.context.userId&&owner.organizationId===draft.context.organizationId&&owner.generation===draft.context.generation;
 const authority=()=>context.matches(owner)?context.authorityIssue():null;
 const available=()=>active&&supportsRead&&sameScope()&&context.isActive()&&context.matches(owner)&&(native?nativeSavedListAvailable(native,owner):authorizedSavedListMutation(owner,fixture?.authorization)&&typeof fixture?.upsertSavedListItem==="function");
 const blocks=()=>active&&context.matches(owner)&&context.isActive()&&(!!authority()||!["idle","selected","observed"].includes(state.phase));
 const choiceCurrent=(choice:Choice)=>{const entry=draft.entryFor(choice.target);return !!entry&&entry.quantityText===choice.rawQuantity&&entry.noteText===choice.rawNote;};
 const ownedPage=(page:readonly FixtureSavedList[])=>ownedSavedListsPage(owner,page,currentPage());
 const frameFor=(page:readonly FixtureSavedList[],list:FixtureSavedList,choice:Choice):Frame|null=>{if(!ownedPage(page)||!page.includes(list))return null;const previous=list.items.find(row=>row.offerId===choice.target.offerId);return Object.freeze({page,list,listId:list.id,listName:list.name,isDefault:list.isDefault,updatedAt:list.updatedAt,previous:previous?Object.freeze({...previous}):null});};
 const sameFrame=(frame:Frame,choice:Choice)=>{const now=frameFor(frame.page,frame.list,choice);return !!now&&now.listId===frame.listId&&now.listName===frame.listName&&now.isDefault===frame.isDefault&&now.updatedAt===frame.updatedAt&&JSON.stringify(now.previous)===JSON.stringify(frame.previous);};
 const rememberUnknown=(work:Attempt)=>{if(unknownNumbers.has(work.number))return;unknownNumbers.add(work.number);unknowns=Object.freeze([...unknowns,Object.freeze({number:work.number,listId:work.frame.listId,listName:work.frame.listName,offerId:work.input.offerId,input:work.input,rawQuantity:work.choice.rawQuantity,rawNote:work.choice.rawNote})]);};
 const unknown=(work:Attempt,issue?:SavedListItemCommandState["issue"])=>{rememberUnknown(work);emit({...state,phase:"unknown",unresolved:true,issue,result:undefined});};
 const denyAll=()=>{active=false;sequence++;attempt=null;prepared=null;reviewed=null;unknowns=emptyUnknown;unknownNumbers.clear();emit({phase:"rejected",issue:"denied",priorUnknown:unknowns});};
 const canChoose=(target:LocalListTarget)=>available()&&!authority()&&!otherLocked()&&!blocks()&&!!draft.entryFor(target);
 const canPrepare=(page:readonly FixtureSavedList[],list:FixtureSavedList)=>available()&&!authority()&&!otherLocked()&&isWorkspaceActive()&&["selected","observed"].includes(state.phase)&&!!state.choice&&choiceCurrent(state.choice)&&!!frameFor(page,list,state.choice);
 return {
  runtime:native?"native-session" as const:"fixture" as const,getSnapshot:()=>state,subscribe(listener:()=>void){listeners.add(listener);const off=context.subscribe(()=>{state=Object.freeze({...state});listener();});return()=>{listeners.delete(listener);off();};},isAvailable:available,authorityIssue:authority,blocksOtherMutations:blocks,canChoose,canPrepare,choiceIsCurrent:()=>available()&&!!state.choice&&choiceCurrent(state.choice),
  select(target:LocalListTarget,comparison:OfferComparisonResponse):"selected"|"quantity"|"note"|"unavailable"{
   if(!canChoose(target)||currentComparison()!==comparison||!draft.canSelect(comparison,target.offerId))return "unavailable";const offer=selectComparedOffer(comparison,target.variantId,target.offerId),entry=draft.entryFor(target)!;
   if(!offer){emit({...state,selectionIssue:"source",selectionTarget:target});return "unavailable";}
   const quantityIssue=checkSavedListStorageQuantity(entry.quantityText),noteIssue=checkListText("note",entry.noteText);
   if(quantityIssue||noteIssue){emit({...state,selectionTarget:target,checkedQuantity:entry.quantityText,checkedNote:entry.noteText,quantityIssue:quantityIssue??undefined,noteIssue:noteIssue??undefined,selectionIssue:undefined});return quantityIssue?"quantity":"note";}
   const input=Object.freeze(upsertSavedListItemSchema.parse({offerId:target.offerId,quantity:Number(entry.quantityText.trim().replace(",",".")),note:entry.noteText}));const choice=Object.freeze({target,rawQuantity:entry.quantityText,rawNote:entry.noteText,input,productName:comparison.product.name,supplierName:offer.supplier.name,packagingName:offer.packaging.name});attempt=null;prepared=null;reviewed=null;emit({phase:"selected",choice,priorUnknown:unknowns});return "selected";
  },
  prepare(page:readonly FixtureSavedList[],list:FixtureSavedList){if(!canPrepare(page,list))return false;const choice=state.choice!,frame=frameFor(page,list,choice)!;prepared=Object.freeze({choice,frame,input:choice.input});emit({phase:"prepared",choice,frame,input:choice.input,priorUnknown:unknowns});return true;},
  canReview(page:readonly FixtureSavedList[]){return available()&&isWorkspaceActive()&&!!prepared&&state.phase==="prepared"&&prepared.frame.page===page&&choiceCurrent(prepared.choice)&&sameFrame(prepared.frame,prepared.choice);},
  cancelPreparation(){if(!available()||state.phase!=="prepared"||!prepared)return false;prepared=null;emit({phase:"selected",choice:state.choice,priorUnknown:unknowns});return true;},
  cancelSelection(){if(!available()||!["selected","observed"].includes(state.phase))return false;prepared=null;emit({phase:"idle",priorUnknown:unknowns});return true;},
  canConfirm(){return available()&&!authority()&&!otherLocked()&&!!prepared&&this.canReview(prepared.frame.page);},
  async confirm(){
   if(!prepared||!this.canConfirm())return;const work:Attempt=Object.freeze({...prepared,number:++attemptCounter});attempt=work;prepared=null;reviewed=null;const ownSequence=++sequence;emit({phase:"pending",choice:work.choice,frame:work.frame,input:work.input,priorUnknown:unknowns,unresolved:false});
   try{
    const body=await (native?native.upsert(owner,work.frame.listId,work.input):fixture!.upsertSavedListItem(owner,work.frame.listId,work.input));if(!active||sequence!==ownSequence)return;if(!available()){denyAll();return;}if(!isWorkspaceActive()||!choiceCurrent(work.choice)||!sameFrame(work.frame,work.choice)){unknown(work,"context");return;}
    const root=resultBinding.safeParse(body);if(!root.success||root.data.listId!==work.frame.listId||root.data.offerId!==work.input.offerId||work.frame.page.some(list=>list.items.some(row=>row.id===root.data.id&&(list.id!==work.frame.listId||row.offerId!==work.input.offerId)))){unknown(work,"invalid-result");return;}
    const parsed=savedListItemFixtureSchema.safeParse(body);if(!parsed.success||parsed.data.id!==root.data.id||parsed.data.listId!==work.frame.listId||parsed.data.offerId!==work.input.offerId||decimalIdentity(parsed.data.quantity)!==decimalIdentity(String(work.input.quantity))||parsed.data.note!==work.input.note){unknown(work,"invalid-result");return;}emit({...state,phase:"result",result:Object.freeze(parsed.data),issue:undefined,unresolved:false});
   }catch(error){
    if(!active||sequence!==ownSequence)return;if(!available()){denyAll();return;}if(!isWorkspaceActive()||!choiceCurrent(work.choice)||!sameFrame(work.frame,work.choice)){unknown(work,"context");return;}
    const parsed=typeof error==="object"&&error!==null&&"payload"in error&&"status"in error?errorResponseSchema.safeParse(error.payload):null,status=typeof error==="object"&&error!==null&&"status"in error?error.status:undefined;
    if(!parsed?.success||parsed.data.statusCode!==status||![400,401,403,404].includes(status as number)){unknown(work);return;}
    const issue=status===400?"validation":status===401?"authentication":status===403?"denied":"not-found";if(issue==="authentication"||issue==="denied")context.deny(issue);emit({...state,phase:"rejected",issue});
   }
  },
  canRead(){return available()&&!authority()&&isWorkspaceActive()&&(!!attempt||unknowns.length>0)&&["idle","result","unknown","rejected","read-error","review","observed","selected"].includes(state.phase);},
  async readCurrent(){if(!this.canRead())return;const ownSequence=++sequence;reviewed=null;emit({...state,phase:"reading",latest:undefined});try{const page=await reloadPage();if(!active||ownSequence!==sequence)return;if(!available()){denyAll();return;}if(!page||!ownedPage(page)){emit({...state,phase:"read-error"});return;}reviewed=page;emit({...state,phase:"review",latest:page,issue:undefined});}catch{if(active&&ownSequence===sequence)emit({...state,phase:"read-error"});}},
  canAcknowledge(){return available()&&state.phase==="review"&&!!reviewed&&ownedPage(reviewed);},
  acknowledge(){if(!this.canAcknowledge())return false;reviewed=null;emit({...state,phase:"observed",latest:undefined});return true;},
  denyAll,activate(){if(disposed){disposed=false;active=true;}},dispose(){active=false;disposed=true;sequence++;attempt=null;prepared=null;reviewed=null;unknowns=emptyUnknown;unknownNumbers.clear();listeners.clear();state=idle;},
 };
}
export type SavedListItemCommands=ReturnType<typeof createSavedListItemCommands>;
