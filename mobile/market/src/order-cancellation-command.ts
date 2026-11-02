import { nativeBuyerWorkflowAvailable, type NativeBuyerWorkflowCommands } from "./native-buyer-workflow-commands";
import { orderWorkflowCommandSchema, orderWorkflowResultSchema, orderWorkflowResponseSchema, type OrderWorkflowResponse, type OrderWorkflowResult } from "../../../packages/schemas/src/order-workflow";
import { supplierOrderResponseSchema, errorResponseSchema } from "../../../packages/schemas/src/core-api";
import type { ReadScope } from "./read-controller";
import { checkCancellationFields, type OrderCancellationDrafts, type CancellationTarget } from "./order-cancellation-draft";
import { authorizedBuyerWorkflow, createBuyerWorkflowKeys, type BuyerWorkflowKeys, type BuyerWorkflowCommandFixture, type CancelOrderInput } from "./order-workflow-command-fixture";
type Phase="idle"|"key-error"|"pending"|"receipt"|"unknown"|"rejected"|"reading"|"review"|"read-error"|"observed";
export type CancellationCommandState=Readonly<{phase:Phase;orderId?:string;input?:Readonly<CancelOrderInput>;rawReason?:string;receipt?:OrderWorkflowResult;latest?:OrderWorkflowResponse;unresolved?:boolean;issue?:"key"|"authentication"|"denied"|"validation"|"not-found"|"conflict"|"invalid-result"|"context"}>;
type Attempt=Readonly<{workflow:OrderWorkflowResponse;target:CancellationTarget;rawReason:string;input:Readonly<CancelOrderInput>}>;
type Operation={state:CancellationCommandState;attempt:Attempt|null;receipt:OrderWorkflowResult|null;unresolved:boolean;sequence:number;reviewed:OrderWorkflowResponse|null};
const receiptBinding=orderWorkflowResultSchema.pick({orderId:true,version:true,status:true,paymentStatus:true}).strip();
const idle:CancellationCommandState=Object.freeze({phase:"idle"});
const binding=orderWorkflowResponseSchema.pick({orderId:true,version:true,status:true,paymentStatus:true}).strip().extend({order:supplierOrderResponseSchema.pick({id:true,buyerOrganizationId:true,version:true,status:true,paymentStatus:true}).strip()});
const cancelBranch=orderWorkflowCommandSchema.options.find(option=>option.shape.action.value==="CANCEL");
if(!cancelBranch)throw new Error("Existing CANCEL branch missing");
const cancelSchema=cancelBranch;
export function createOrderCancellationCommands(scope:ReadScope,fixture:BuyerWorkflowCommandFixture|undefined,drafts:OrderCancellationDrafts,currentWorkflow:(orderId:string)=>OrderWorkflowResponse|null,reloadWorkflow:(orderId:string)=>Promise<OrderWorkflowResponse|undefined>,isWorkflowActive:(orderId:string)=>boolean,otherOrderLocked:(orderId:string)=>boolean=()=>false,keyPool:BuyerWorkflowKeys|undefined=undefined,native?:NativeBuyerWorkflowCommands) {
 const commands=native??fixture,workflowKeys=keyPool??createBuyerWorkflowKeys(scope,fixture,native);
 const owner=Object.freeze({...scope}),operations=new Map<string,Operation>(),listeners=new Set<()=>void>();
 let active=true,disposed=false,snapshot:Readonly<Record<string,CancellationCommandState>>=Object.freeze({});
 const available=()=>active&&(native?nativeBuyerWorkflowAvailable(native,owner):authorizedBuyerWorkflow(owner,fixture))&&typeof commands?.executeOrderWorkflow==="function"&&typeof commands.nextWorkflowIdempotencyKey==="function";
 const authority=()=>workflowKeys.authorityIssue();
 const stateFor=(id:string)=>snapshot[id]??idle;
 const opFor=(id:string)=>{let op=operations.get(id);if(!op){op={state:idle,attempt:null,receipt:null,unresolved:false,sequence:0,reviewed:null};operations.set(id,op);}return op;};
 const emit=(id:string,op:Operation,state:CancellationCommandState)=>{op.state=Object.freeze(state);snapshot=Object.freeze({...snapshot,[id]:op.state});listeners.forEach(listener=>listener());};
 const owned=(workflow:OrderWorkflowResponse,orderId:string)=>{const parsed=binding.safeParse(workflow);if(!parsed.success)return false;const w=parsed.data;return w.orderId===orderId&&w.order.id===orderId&&w.order.buyerOrganizationId===owner.organizationId&&w.version>0&&w.version===w.order.version&&w.status===w.order.status&&w.paymentStatus===w.order.paymentStatus;};
 const knownBlock=(workflow:OrderWorkflowResponse)=>workflow.claims.length>0?"claim":workflow.order.shipments?.length?"shipment":null;
 const locked=(state:CancellationCommandState)=>!["idle","observed","key-error"].includes(state.phase);
 const canSubmit=(workflow:OrderWorkflowResponse,target:CancellationTarget)=>{
  if(!available()||authority()||otherOrderLocked(target.orderId)||!isWorkflowActive(target.orderId)||currentWorkflow(target.orderId)!==workflow||!owned(workflow,target.orderId)||knownBlock(workflow))return false;
  const entry=drafts.entryForTarget(target),op=operations.get(target.orderId);
  return !!entry?.started&&entry.reviewing&&drafts.entryFor(workflow)?.target===target&&Object.keys(checkCancellationFields(entry.reason,entry.transferNotMade)).length===0&&(!op||!locked(op.state)&&!op.unresolved&&!op.receipt);
 };
 const sameAttemptSource=(attempt:Attempt)=>{
  const current=currentWorkflow(attempt.target.orderId),entry=drafts.entryForTarget(attempt.target);
  return current===attempt.workflow&&owned(current,attempt.target.orderId)&&drafts.entryFor(current)?.target===attempt.target&&!!entry?.started&&entry.reviewing&&entry.reason===attempt.rawReason&&entry.transferNotMade===true;
 };
 const uncertain=(id:string,op:Operation,issue?:CancellationCommandState["issue"])=>{op.unresolved=true;emit(id,op,{...op.state,phase:"unknown",unresolved:true,issue,receipt:undefined});};
 const denyOrder=(id:string)=>{const op=operations.get(id);if(!op)return;op.sequence++;op.attempt=null;op.reviewed=null;op.receipt=null;emit(id,op,{phase:"rejected",orderId:id,issue:"denied",unresolved:op.unresolved});};
 const execute=async(id:string,op:Operation,replay:boolean)=>{
  const attempt=op.attempt!,ownSequence=++op.sequence;op.reviewed=null;
  emit(id,op,{phase:"pending",orderId:id,input:attempt.input,rawReason:attempt.rawReason,unresolved:op.unresolved});
  const contextValid=()=>{const current=currentWorkflow(id);return isWorkflowActive(id)&&(!current||owned(current,id))&&(replay||sameAttemptSource(attempt));};
  try {
   const body=await commands!.executeOrderWorkflow(owner,id,attempt.input);
   if(!active||ownSequence!==op.sequence)return;if(!available()){denyOrder(id);return;}if(!contextValid()){uncertain(id,op,"context");return;}
   const root=receiptBinding.safeParse(body);
   if(!root.success||root.data.orderId!==id||root.data.version!==attempt.input.expectedVersion+1||root.data.status!=="CANCELLED"||root.data.paymentStatus!=="UNPAID"){uncertain(id,op,"invalid-result");return;}
   const parsed=orderWorkflowResultSchema.safeParse(body);
   if(!parsed.success||parsed.data.orderId!==id||parsed.data.version!==attempt.input.expectedVersion+1||parsed.data.status!=="CANCELLED"||parsed.data.paymentStatus!=="UNPAID"||parsed.data.cartId!==undefined||[...operations].some(([other,record])=>other!==id&&record.receipt?.eventId===parsed.data.eventId)){uncertain(id,op,"invalid-result");return;}
   if(!workflowKeys.acceptEvent(id,parsed.data.eventId,attempt.input.idempotencyKey)){uncertain(id,op,"invalid-result");return;}
   op.receipt=Object.freeze(parsed.data);op.unresolved=false;emit(id,op,{...op.state,phase:"receipt",receipt:op.receipt,unresolved:false,issue:undefined});
  } catch(error) {
   if(!active||ownSequence!==op.sequence)return;if(!available()){denyOrder(id);return;}if(!contextValid()){uncertain(id,op,"context");return;}
   const parsed=typeof error==="object"&&error!==null&&"payload"in error&&"status"in error?errorResponseSchema.safeParse(error.payload):null;
   const status=typeof error==="object"&&error!==null&&"status"in error?error.status:undefined;
   if(!parsed?.success||parsed.data.statusCode!==status||![400,401,403,404,409].includes(status as number)){uncertain(id,op);return;}
   const issue=status===400?"validation":status===401?"authentication":status===403?"denied":status===404?"not-found":"conflict";
   if(issue==="authentication"||issue==="denied")workflowKeys.denyAuthority(issue);
   emit(id,op,{...op.state,phase:"rejected",issue,unresolved:op.unresolved});
  }
 };
 return {
 runtime:native?"native-session" as const:"fixture" as const,
  getSnapshot:()=>snapshot,stateFor,subscribe(listener:()=>void){listeners.add(listener);const off=workflowKeys.subscribe(()=>{snapshot=Object.freeze({...snapshot});listener();});return()=>{listeners.delete(listener);off();};},
  isAvailable:available,authorityIssue:authority,canSubmit,
  shouldShow(id:string,workflow?:OrderWorkflowResponse){return available()&&(operations.has(id)||!!workflow&&owned(workflow,id)&&!!drafts.entryFor(workflow)?.available);},
  blocksOtherCommands:(id:string)=>active&&(authority()!==null||operations.get(id)?.unresolved===true||locked(stateFor(id))),
  isLocked:(id:string)=>active&&(authority()!==null||otherOrderLocked(id)||operations.get(id)?.unresolved===true||locked(stateFor(id))),
  knownBlock(workflow:OrderWorkflowResponse){return available()&&owned(workflow,workflow.orderId)?knownBlock(workflow):null;},
  async submit(workflow:OrderWorkflowResponse,target:CancellationTarget){
   if(!canSubmit(workflow,target))return;const entry=drafts.entryForTarget(target)!,op=opFor(target.orderId),key=workflowKeys.next();
   if(!key){emit(target.orderId,op,{phase:"key-error",orderId:target.orderId,rawReason:entry.reason,issue:"key"});return;}
   const parsed=cancelSchema.safeParse({action:"CANCEL",expectedVersion:target.version,idempotencyKey:key,reason:entry.reason,transferNotMade:entry.transferNotMade});
   if(!parsed.success){emit(target.orderId,op,{phase:"key-error",orderId:target.orderId,rawReason:entry.reason,issue:"key"});return;}
   op.attempt=Object.freeze({workflow,target,rawReason:entry.reason,input:Object.freeze(parsed.data) as Readonly<CancelOrderInput>});op.receipt=null;op.unresolved=false;await execute(target.orderId,op,false);
  },
  canReplay(id:string){const op=operations.get(id),current=currentWorkflow(id);return available()&&!authority()&&!otherOrderLocked(id)&&isWorkflowActive(id)&&(!current||owned(current,id))&&!!op?.attempt&&op.unresolved&&!op.receipt&&["unknown","rejected","read-error","review","observed"].includes(op.state.phase);},
  async replay(id:string){const op=operations.get(id);if(op&&this.canReplay(id))await execute(id,op,true);},
  canRead(id:string){const op=operations.get(id);return available()&&isWorkflowActive(id)&&!!op?.attempt&&["receipt","unknown","rejected","read-error","review","observed"].includes(op.state.phase)&&!["authentication","denied"].includes(op.state.issue??"");},
  async readCurrent(id:string){
   const op=operations.get(id);if(!op||!this.canRead(id))return;const ownSequence=++op.sequence;op.reviewed=null;emit(id,op,{...op.state,phase:"reading",latest:undefined});
   try{const workflow=await reloadWorkflow(id);if(!active||ownSequence!==op.sequence)return;if(!available()){denyOrder(id);return;}if(!workflow||!owned(workflow,id)||currentWorkflow(id)!==workflow||workflow.version<op.attempt!.input.expectedVersion){emit(id,op,{...op.state,phase:"read-error"});return;}op.reviewed=workflow;emit(id,op,{...op.state,phase:"review",latest:workflow,issue:undefined});}
   catch{if(active&&ownSequence===op.sequence)emit(id,op,{...op.state,phase:"read-error"});}
  },
  canAcknowledge(id:string){const op=operations.get(id);return available()&&!!op&&op.state.phase==="review"&&!!op.reviewed&&currentWorkflow(id)===op.reviewed&&owned(op.reviewed,id);},
  acknowledge(id:string){const op=operations.get(id);if(!op||!this.canAcknowledge(id))return false;op.reviewed=null;if(!op.unresolved&&!op.receipt){const current=currentWorkflow(id),entry=current&&drafts.entryFor(current);if(entry?.started)drafts.edit(entry.target);}emit(id,op,{phase:"observed",orderId:id,input:op.attempt?.input,rawReason:op.attempt?.rawReason,receipt:op.receipt??undefined,unresolved:op.unresolved});return true;},
  denyOrder,denyAll(){active=false;for(const id of operations.keys())denyOrder(id);},
  activate(){if(disposed){disposed=false;active=true;}},
  dispose(){disposed=true;active=false;for(const op of operations.values())op.sequence++;operations.clear();listeners.clear();snapshot=Object.freeze({});},
 };
}
export type OrderCancellationCommands=ReturnType<typeof createOrderCancellationCommands>;
