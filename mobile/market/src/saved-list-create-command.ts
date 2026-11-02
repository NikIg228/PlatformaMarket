import { nativeSavedListAvailable, type NativeSavedListCommands } from "./native-saved-list-commands";
import { createSavedListSchema } from "../../../packages/schemas/src/commercial";
import { errorResponseSchema } from "../../../packages/schemas/src/core-api";
import { authorizedSavedListMutation, createSavedListCommandContext, ownedSavedListsPage, type SavedListCommandContext, type SavedListMutationAuthorization } from "./saved-list-command-context";
import { savedListHeaderFixtureSchema, type FixtureSavedList } from "./saved-lists-fixture-read";
import { checkListText, type ListTextIssue } from "./local-list-draft";
import type { ReadScope } from "./read-controller";
import type { z } from "zod";
export type SavedListCreateInput=z.output<typeof createSavedListSchema>;
export type SavedListCreateFixture={authorization:SavedListMutationAuthorization;createSavedList:(scope:ReadScope,input:Readonly<SavedListCreateInput>)=>Promise<unknown>};
export type SavedListCreateFixtureClient={savedListCreateCommandFixture?:SavedListCreateFixture};
type Header=z.output<typeof savedListHeaderFixtureSchema>;
type Frame=Readonly<{page:readonly FixtureSavedList[];signature:string;ids:readonly string[];defaults:readonly Readonly<{id:string;name:string}>[];sameNames:number}>;
type Prepared=Readonly<{frame:Frame;formKey:object;rawName:string;input:Readonly<SavedListCreateInput>}>;
type Attempt=Readonly<Prepared&{number:number}>;
export type UnknownSavedListCreate=Readonly<{number:number;rawName:string;input:Readonly<SavedListCreateInput>}>;
export type SavedListCreateState=Readonly<{phase:"idle"|"editing"|"paused"|"prepared"|"pending"|"result"|"unknown"|"rejected"|"reading"|"review"|"read-error"|"observed";started:boolean;formKey:object|null;rawName:string;isDefault:boolean;checked:boolean;nameIssue?:ListTextIssue;frame?:Frame;input?:Readonly<SavedListCreateInput>;result?:Header;latest?:readonly FixtureSavedList[];priorUnknown:readonly UnknownSavedListCreate[];unresolved?:boolean;issue?:"validation"|"authentication"|"denied"|"invalid-result"|"context"}>;
const defaultFlag=createSavedListSchema.shape.isDefault.parse(undefined),emptyUnknown=Object.freeze([]) as readonly UnknownSavedListCreate[];
const idle:SavedListCreateState=Object.freeze({phase:"idle",started:false,formKey:null,rawName:"",isDefault:defaultFlag,checked:false,priorUnknown:emptyUnknown});
const rootBinding=savedListHeaderFixtureSchema.pick({id:true,organizationId:true,createdById:true}).strip();
export function createSavedListCreateCommands(scope:ReadScope,fixture:SavedListCreateFixture|undefined,currentPage:()=>readonly FixtureSavedList[]|null,reloadPage:()=>Promise<readonly FixtureSavedList[]|undefined>,isWorkspaceActive:()=>boolean,otherLocked:()=>boolean=()=>false,supportsRead=true,context:SavedListCommandContext=createSavedListCommandContext(scope),native?:NativeSavedListCommands){
 const owner=Object.freeze({...scope}),listeners=new Set<()=>void>(),unknownNumbers=new Set<number>();let active=true,disposed=false,state=idle,sequence=0,counter=0,unknowns=emptyUnknown,prepared:Prepared|null=null,attempt:Attempt|null=null,reviewed:readonly FixtureSavedList[]|null=null,resumeAfterRead:"paused"|"observed"="observed";
 const emit=(next:SavedListCreateState)=>{state=Object.freeze({...next,priorUnknown:unknowns});listeners.forEach(listener=>listener());};
 const available=()=>active&&supportsRead&&context.isActive()&&context.matches(owner)&&(native?nativeSavedListAvailable(native,owner):authorizedSavedListMutation(owner,fixture?.authorization)&&typeof fixture?.createSavedList==="function");
 const authority=()=>context.matches(owner)?context.authorityIssue():null,blocks=()=>active&&context.matches(owner)&&context.isActive()&&(!!authority()||!["idle","editing","paused","observed"].includes(state.phase));
 const ownedPage=(page:readonly FixtureSavedList[])=>ownedSavedListsPage(owner,page,currentPage());
 const frameFor=(page:readonly FixtureSavedList[],input:Readonly<SavedListCreateInput>):Frame|null=>{if(!ownedPage(page))return null;const signature=JSON.stringify(page.map(list=>({id:list.id,name:list.name,isDefault:list.isDefault,updatedAt:list.updatedAt})));return Object.freeze({page,signature,ids:Object.freeze(page.map(list=>list.id)),defaults:Object.freeze(page.filter(list=>list.isDefault).map(list=>Object.freeze({id:list.id,name:list.name}))),sameNames:page.filter(list=>list.name===input.name).length});};
 const sourceCurrent=(work:Prepared)=>{const now=frameFor(work.frame.page,work.input);return !!now&&now.signature===work.frame.signature&&state.formKey===work.formKey&&state.rawName===work.rawName&&state.isDefault===work.input.isDefault;};
 const rememberUnknown=(work:Attempt)=>{if(unknownNumbers.has(work.number))return;unknownNumbers.add(work.number);unknowns=Object.freeze([...unknowns,Object.freeze({number:work.number,rawName:work.rawName,input:work.input})]);};
 const unknown=(work:Attempt,issue?:SavedListCreateState["issue"])=>{rememberUnknown(work);emit({...state,phase:"unknown",issue,result:undefined,unresolved:true});};
 const denyAll=()=>{active=false;sequence++;prepared=null;attempt=null;reviewed=null;unknowns=emptyUnknown;unknownNumbers.clear();emit({...idle,phase:"rejected",issue:"denied"});};
 const check=()=>{if(!available()||state.phase!=="editing")return false;const issue=checkListText("name",state.rawName);emit({...state,checked:true,nameIssue:issue??undefined});return issue===null;};
 return {
  runtime:native?"native-session" as const:"fixture" as const,getSnapshot:()=>state,subscribe(listener:()=>void){listeners.add(listener);const off=context.subscribe(()=>{state=Object.freeze({...state});listener();});return()=>{listeners.delete(listener);off();};},isAvailable:available,authorityIssue:authority,blocksOtherMutations:blocks,
  canStart(){return available()&&!authority()&&!otherLocked()&&["idle","editing","paused","observed"].includes(state.phase);},
  start(seedRawName?:string){if(!this.canStart()||seedRawName!==undefined&&typeof seedRawName!=="string")return false;prepared=null;reviewed=null;if((state.phase==="paused"||state.phase==="editing")&&state.started){attempt=null;emit({...state,phase:"editing",frame:undefined,input:undefined,latest:undefined,issue:undefined,result:undefined});return true;}attempt=null;emit({...idle,phase:"editing",started:true,formKey:Object.freeze({}),rawName:seedRawName??"",priorUnknown:unknowns});return true;},
  isEditing:()=>available()&&isWorkspaceActive()&&state.phase==="editing"&&state.started,
  setName(rawName:string){if(!available()||state.phase!=="editing"||typeof rawName!=="string")return false;emit({...state,rawName,checked:false,nameIssue:undefined});return true;},
  setDefault(value:boolean){if(!available()||state.phase!=="editing")return false;emit({...state,isDefault:value===true});return true;},check,
  pause(){if(!available()||state.phase!=="editing")return false;emit({...state,phase:"paused"});return true;},
  discard(){if(!available()||!["editing","paused"].includes(state.phase))return false;prepared=null;emit({...idle,priorUnknown:unknowns});return true;},
  canPrepare(page:readonly FixtureSavedList[]){return available()&&!authority()&&!otherLocked()&&isWorkspaceActive()&&state.phase==="editing"&&!!state.formKey&&ownedPage(page);},
  prepare(page:readonly FixtureSavedList[]){if(!available()||authority()||otherLocked()||!isWorkspaceActive()||state.phase!=="editing"||!state.formKey||!check())return false;const input=Object.freeze(createSavedListSchema.parse({name:state.rawName,isDefault:state.isDefault})),frame=frameFor(page,input);if(!frame)return false;prepared=Object.freeze({frame,rawName:state.rawName,formKey:state.formKey,input});emit({...state,phase:"prepared",frame,input});return true;},
  canReview(page:readonly FixtureSavedList[]){return available()&&isWorkspaceActive()&&state.phase==="prepared"&&!!prepared&&prepared.frame.page===page&&sourceCurrent(prepared);},
  editPreparation(){if(!available()||state.phase!=="prepared"||!prepared)return false;prepared=null;emit({...state,phase:"editing",frame:undefined,input:undefined});return true;},
  canConfirm(){return available()&&!authority()&&!otherLocked()&&!!prepared&&this.canReview(prepared.frame.page);},
  async confirm(){
   if(!prepared||!this.canConfirm())return;const work:Attempt=Object.freeze({...prepared,number:++counter});attempt=work;prepared=null;reviewed=null;const ownSequence=++sequence;emit({...state,phase:"pending",frame:work.frame,input:work.input,unresolved:false,issue:undefined});
   try{const body=await (native?native.create(owner,work.input):fixture!.createSavedList(owner,work.input));if(!active||ownSequence!==sequence)return;if(!available()){denyAll();return;}if(!isWorkspaceActive()||!sourceCurrent(work)){unknown(work,"context");return;}
    const root=rootBinding.safeParse(body);if(!root.success||root.data.organizationId!==owner.organizationId||root.data.createdById!==owner.userId||work.frame.ids.includes(root.data.id)){unknown(work,"invalid-result");return;}
    const parsed=savedListHeaderFixtureSchema.safeParse(body);if(!parsed.success||parsed.data.id!==root.data.id||parsed.data.organizationId!==owner.organizationId||parsed.data.createdById!==owner.userId||parsed.data.name!==work.input.name||parsed.data.isDefault!==work.input.isDefault){unknown(work,"invalid-result");return;}emit({...state,phase:"result",result:Object.freeze(parsed.data),unresolved:false,issue:undefined});
   }catch(error){if(!active||ownSequence!==sequence)return;if(!available()){denyAll();return;}if(!isWorkspaceActive()||!sourceCurrent(work)){unknown(work,"context");return;}
    const parsed=typeof error==="object"&&error!==null&&"payload"in error&&"status"in error?errorResponseSchema.safeParse(error.payload):null,status=typeof error==="object"&&error!==null&&"status"in error?error.status:undefined;
    if(!parsed?.success||parsed.data.statusCode!==status||![400,401,403].includes(status as number)){unknown(work);return;}const issue=status===400?"validation":status===401?"authentication":"denied";if(issue==="authentication"||issue==="denied")context.deny(issue);emit({...state,phase:"rejected",issue});
   }
  },
  canRead(){return available()&&!authority()&&isWorkspaceActive()&&(!!attempt||unknowns.length>0)&&["idle","paused","result","unknown","rejected","read-error","review","observed"].includes(state.phase);},
  async readCurrent(){if(!this.canRead())return;const ownSequence=++sequence;resumeAfterRead=state.started&&(attempt===null||!state.unresolved&&!state.result)?"paused":"observed";reviewed=null;emit({...state,phase:"reading",latest:undefined});try{const page=await reloadPage();if(!active||ownSequence!==sequence)return;if(!available()){denyAll();return;}if(!page||!ownedPage(page)){emit({...state,phase:"read-error"});return;}reviewed=page;emit({...state,phase:"review",latest:page,issue:undefined});}catch{if(active&&ownSequence===sequence)emit({...state,phase:"read-error"});}},
  canAcknowledge(){return available()&&state.phase==="review"&&!!reviewed&&ownedPage(reviewed);},
  acknowledge(){if(!this.canAcknowledge())return false;reviewed=null;emit({...state,phase:resumeAfterRead,latest:undefined});return true;},
  denyAll,activate(){if(disposed){disposed=false;active=true;}},dispose(){active=false;disposed=true;sequence++;prepared=null;attempt=null;reviewed=null;unknowns=emptyUnknown;unknownNumbers.clear();emit(idle);listeners.clear();},
 };
}
export type SavedListCreateCommands=ReturnType<typeof createSavedListCreateCommands>;
