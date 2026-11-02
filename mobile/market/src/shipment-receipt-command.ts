import type { ShipmentResponse } from "../../../packages/schemas/src/core-api";
import { nativeBuyerWorkflowAvailable, type NativeBuyerWorkflowCommands } from "./native-buyer-workflow-commands";
import { orderWorkflowCommandSchema, orderWorkflowResultSchema, orderWorkflowResponseSchema, type OrderWorkflowResponse, type OrderWorkflowResult } from "../../../packages/schemas/src/order-workflow";
import { supplierOrderResponseSchema, errorResponseSchema } from "../../../packages/schemas/src/core-api";
import type { ReadScope } from "./read-controller";
import { checkReceiptText, compareReceiptCounts, type ShipmentReceiptDrafts, type ReceiptTarget } from "./shipment-receipt-draft";
import { authorizedBuyerWorkflow, createBuyerWorkflowKeys, type BuyerWorkflowKeys, type BuyerWorkflowCommandFixture, type ReceiveShipmentInput } from "./order-workflow-command-fixture";
export type ReceiptBatchTarget=Readonly<{orderId:string;orderNumber:string;orderVersion:number;shipmentId:string;shipmentNumber:string;shipmentVersion:number;targets:readonly ReceiptTarget[]}>;
export type ReceiptBatchLine=Readonly<{shipmentItemId:string;target:ReceiptTarget;rawQuantity:string}>;
export type ReceiptBatchReport=Readonly<{target:ReceiptBatchTarget;lines:readonly ReceiptBatchLine[]}>;
export type ReceiptBatchView=Readonly<{target:ReceiptBatchTarget;phase:"editing"|"review"|"changed";lines:readonly ReceiptBatchLine[];preview?:readonly Readonly<{shipmentItemId:string;deliveredQuantity:string}>[];issue?:"validation"|"zero";invalidIndex:number|null}>;
type ReceiptBatchPlan={target:ReceiptBatchTarget;workflow:OrderWorkflowResponse;shipment:ShipmentResponse;reviewed:boolean;rawAtReview?:readonly string[];preview?:readonly Readonly<{shipmentItemId:string;deliveredQuantity:string}>[];issue?:"validation"|"zero"};
type Phase="idle"|"key-error"|"pending"|"receipt"|"unknown"|"rejected"|"reading"|"review"|"read-error"|"observed";
export type ReceiptCommandState=Readonly<{phase:Phase;orderId?:string;batch?:ReceiptBatchReport;input?:Readonly<ReceiveShipmentInput>;rawQuantity?:string;receipt?:OrderWorkflowResult;latest?:OrderWorkflowResponse;unresolved?:boolean;issue?:"key"|"authentication"|"denied"|"validation"|"not-found"|"conflict"|"invalid-result"|"context"}>;
type Attempt=Readonly<{workflow:OrderWorkflowResponse;target:ReceiptTarget;rawQuantity:string;input:Readonly<ReceiveShipmentInput>;batch?:ReceiptBatchReport}>;
type Operation={state:ReceiptCommandState;attempt:Attempt|null;receipt:OrderWorkflowResult|null;unresolved:boolean;sequence:number;reviewed:OrderWorkflowResponse|null};
const receiptBinding=orderWorkflowResultSchema.pick({orderId:true,version:true,status:true,paymentStatus:true}).strip();
const idle:ReceiptCommandState=Object.freeze({phase:"idle"});
const binding=orderWorkflowResponseSchema.pick({orderId:true,version:true,status:true,paymentStatus:true}).strip().extend({order:supplierOrderResponseSchema.pick({id:true,buyerOrganizationId:true,version:true,status:true,paymentStatus:true}).strip()});
const receiptBranch=orderWorkflowCommandSchema.options.find(option=>option.shape.action.value==="RECEIVE_SHIPMENT");
if(!receiptBranch)throw new Error("Existing RECEIVE_SHIPMENT branch missing");
const receiptSchema=receiptBranch;
export function createShipmentReceiptCommands(scope:ReadScope,fixture:BuyerWorkflowCommandFixture|undefined,drafts:ShipmentReceiptDrafts,currentWorkflow:(orderId:string)=>OrderWorkflowResponse|null,reloadWorkflow:(orderId:string)=>Promise<OrderWorkflowResponse|undefined>,isWorkflowActive:(orderId:string)=>boolean,otherOrderLocked:(orderId:string)=>boolean=()=>false,keyPool:BuyerWorkflowKeys|undefined=undefined,native?:NativeBuyerWorkflowCommands) {
 const commands=native??fixture,workflowKeys=keyPool??createBuyerWorkflowKeys(scope,fixture,native);
 const owner=Object.freeze({...scope}),operations=new Map<string,Operation>(),batchPlans=new Map<string,ReceiptBatchPlan>(),listeners=new Set<()=>void>();
 let active=true,disposed=false,snapshot:Readonly<Record<string,ReceiptCommandState>>=Object.freeze({});
 const available=()=>active&&(native?nativeBuyerWorkflowAvailable(native,owner):authorizedBuyerWorkflow(owner,fixture))&&typeof commands?.executeOrderWorkflow==="function"&&typeof commands.nextWorkflowIdempotencyKey==="function";
 const authority=()=>workflowKeys.authorityIssue();
 const stateFor=(id:string)=>snapshot[id]??idle;
 const opFor=(id:string)=>{let op=operations.get(id);if(!op){op={state:idle,attempt:null,receipt:null,unresolved:false,sequence:0,reviewed:null};operations.set(id,op);}return op;};
 const emit=(id:string,op:Operation,state:ReceiptCommandState)=>{op.state=Object.freeze(state);snapshot=Object.freeze({...snapshot,[id]:op.state});listeners.forEach(listener=>listener());};
 const owned=(workflow:OrderWorkflowResponse,orderId:string)=>{const parsed=binding.safeParse(workflow);if(!parsed.success)return false;const w=parsed.data;return w.orderId===orderId&&w.order.id===orderId&&w.order.buyerOrganizationId===owner.organizationId&&w.version>0&&w.version===w.order.version&&w.status===w.order.status&&w.paymentStatus===w.order.paymentStatus;};
 const sourceLine=(workflow:OrderWorkflowResponse,target:ReceiptTarget)=>{const shipment=workflow.order.shipments?.find(row=>row.id===target.shipmentId),item=shipment?.items.find(row=>row.id===target.itemId);return shipment&&item&&shipment.supplierOrderId===target.orderId&&item.shipmentId===shipment.id&&item.supplierOrderItemId===target.orderItemId&&drafts.entryForLine(workflow,shipment,item)?.target===target?{shipment,item}:null;};
 const knownBlock=(workflow:OrderWorkflowResponse,target:ReceiptTarget)=>{const source=sourceLine(workflow,target);if(!source)return "source";if(source.shipment.items.some(row=>row.resupplyQuantity===undefined||compareReceiptCounts(row.resupplyQuantity,"0")===null))return "unknown-resupply";if(source.shipment.items.some(row=>compareReceiptCounts(row.resupplyQuantity!,"0")!==0))return "resupply";const entry=drafts.entryForTarget(target);if(entry&&!source.shipment.items.some(row=>compareReceiptCounts(row.id===target.itemId?entry.text.trim().replace(",","."):row.deliveredQuantity,"0")===1))return "zero";return null;};
 const locked=(state:ReceiptCommandState)=>!["idle","observed","key-error"].includes(state.phase);
 const canSubmit=(workflow:OrderWorkflowResponse,target:ReceiptTarget)=>{
  if(!available()||authority()||otherOrderLocked(target.orderId)||reviewedBatchActive(target.orderId)||!isWorkflowActive(target.orderId)||currentWorkflow(target.orderId)!==workflow||!owned(workflow,target.orderId)||knownBlock(workflow,target))return false;
  const entry=drafts.entryForTarget(target),op=operations.get(target.orderId);
  return !!entry?.started&&entry.reviewing&&sourceLine(workflow,target)!==null&&checkReceiptText(entry.text,target)===null&&(!op||!locked(op.state)&&!op.unresolved);
 };
 const sameAttemptSource=(attempt:Attempt)=>{
  const current=currentWorkflow(attempt.target.orderId),entry=drafts.entryForTarget(attempt.target);
  if(attempt.batch)return current===attempt.workflow&&owned(current,attempt.target.orderId)&&batchTargetsCurrent(current,attempt.batch.target.targets)&&attempt.batch.lines.every(line=>{const value=drafts.entryForTarget(line.target);return value?.started&&value.reviewing&&value.text===line.rawQuantity;});
  return current===attempt.workflow&&owned(current,attempt.target.orderId)&&sourceLine(current,attempt.target)!==null&&!!entry?.started&&entry.reviewing&&entry.text===attempt.rawQuantity&&!knownBlock(current,attempt.target);
 };
 const uncertain=(id:string,op:Operation,issue?:ReceiptCommandState["issue"])=>{op.unresolved=true;emit(id,op,{...op.state,phase:"unknown",unresolved:true,issue,receipt:undefined});};
 const denyOrder=(id:string)=>{const op=operations.get(id);if(!op)return;op.sequence++;batchPlans.delete(id);op.attempt=null;op.reviewed=null;op.receipt=null;emit(id,op,{phase:"rejected",orderId:id,...(op.state.batch?{batch:op.state.batch}:{}),issue:"denied",unresolved:op.unresolved});};
 const execute=async(id:string,op:Operation,replay:boolean)=>{
  const attempt=op.attempt!,ownSequence=++op.sequence;op.reviewed=null;
  emit(id,op,{phase:"pending",orderId:id,input:attempt.input,rawQuantity:attempt.rawQuantity,unresolved:op.unresolved,...(attempt.batch?{batch:attempt.batch}:{})});
  const contextValid=()=>{const current=currentWorkflow(id);return isWorkflowActive(id)&&(!current||owned(current,id))&&(replay||sameAttemptSource(attempt));};
  try {
   const body=await commands!.executeOrderWorkflow(owner,id,attempt.input);
   if(!active||ownSequence!==op.sequence)return;if(!available()){denyOrder(id);return;}if(!contextValid()){uncertain(id,op,"context");return;}
   const root=receiptBinding.safeParse(body);
   if(!root.success||root.data.orderId!==id||root.data.version!==attempt.input.expectedVersion+1||!["PARTIALLY_FULFILLED","DELIVERED"].includes(root.data.status)||root.data.paymentStatus!=="PAID"){uncertain(id,op,"invalid-result");return;}
   const parsed=orderWorkflowResultSchema.safeParse(body);
   if(!parsed.success||parsed.data.orderId!==id||parsed.data.version!==attempt.input.expectedVersion+1||!["PARTIALLY_FULFILLED","DELIVERED"].includes(parsed.data.status)||parsed.data.paymentStatus!=="PAID"||parsed.data.cartId!==undefined||[...operations].some(([other,record])=>other!==id&&record.receipt?.eventId===parsed.data.eventId)){uncertain(id,op,"invalid-result");return;}
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
 const pulse=()=>{snapshot=Object.freeze({...snapshot});listeners.forEach(listener=>listener());};
 const batchTargetsCurrent=(workflow:OrderWorkflowResponse,targets:readonly ReceiptTarget[])=>{const first=targets[0],ship=first?workflow.order.shipments?.find(row=>row.id===first.shipmentId):undefined;if(!first||!ship||targets.length<2||targets.length>500||ship.items.length!==targets.length||new Set(targets.map(target=>target.itemId)).size!==targets.length||ship.items.some(item=>item.resupplyQuantity===undefined||compareReceiptCounts(item.resupplyQuantity,"0")!==0))return false;return targets.every((target,index)=>target.orderId===first.orderId&&target.shipmentId===first.shipmentId&&ship.items[index]?.id===target.itemId&&sourceLine(workflow,target)!==null);};
 const batchBaseAvailable=(workflow:OrderWorkflowResponse)=>!!native&&available()&&!authority()&&!otherOrderLocked(workflow.orderId)&&isWorkflowActive(workflow.orderId)&&currentWorkflow(workflow.orderId)===workflow&&owned(workflow,workflow.orderId)&&!locked(stateFor(workflow.orderId))&&!operations.get(workflow.orderId)?.unresolved;
 const planFor=(target:ReceiptBatchTarget)=>{const plan=batchPlans.get(target.orderId);return plan?.target===target?plan:undefined;};
 const planCurrent=(plan:ReceiptBatchPlan)=>currentWorkflow(plan.target.orderId)===plan.workflow&&owned(plan.workflow,plan.target.orderId)&&batchTargetsCurrent(plan.workflow,plan.target.targets);
 const reviewedBatchActive=(id:string)=>{const plan=batchPlans.get(id);return !!plan?.reviewed&&isWorkflowActive(id)&&planCurrent(plan);};
 const rawLines=(target:ReceiptBatchTarget)=>Object.freeze(target.targets.map(row=>Object.freeze({shipmentItemId:row.itemId,target:row,rawQuantity:drafts.entryForTarget(row)?.text??""})));
 const reviewedPlan=(plan:ReceiptBatchPlan)=>plan.reviewed&&!!plan.preview&&plan.target.targets.every((row,index)=>{const entry=drafts.entryForTarget(row);return entry?.started&&entry.reviewing&&entry.text===plan.rawAtReview?.[index]&&checkReceiptText(entry.text,row)===null;});
 const canReviewBatch=(target:ReceiptBatchTarget)=>{const plan=planFor(target);return !!plan&&batchBaseAvailable(plan.workflow)&&planCurrent(plan);};
 const canSubmitBatch=(target:ReceiptBatchTarget)=>{const plan=planFor(target);return !!plan&&canReviewBatch(target)&&reviewedPlan(plan)&&plan.preview!.some(line=>compareReceiptCounts(line.deliveredQuantity,"0")===1);};
 const clearBatchReview=(target:ReceiptBatchTarget)=>{const plan=planFor(target);if(!plan)return false;batchPlans.delete(target.orderId);if(plan.reviewed&&!locked(stateFor(target.orderId))&&!operations.get(target.orderId)?.unresolved)drafts.editMany(target.targets);pulse();return true;};
 return {
 runtime:native?"native-session" as const:"fixture" as const,
  getSnapshot:()=>snapshot,stateFor,subscribe(listener:()=>void){listeners.add(listener);const off=workflowKeys.subscribe(()=>{snapshot=Object.freeze({...snapshot});listener();});return()=>{listeners.delete(listener);off();};},
  isAvailable:available,authorityIssue:authority,canSubmit,
  canBeginBatch(workflow:OrderWorkflowResponse,shipment:ShipmentResponse){if(!batchBaseAvailable(workflow)||reviewedBatchActive(workflow.orderId)||!workflow.order.shipments?.includes(shipment)||shipment.supplierOrderId!==workflow.orderId||shipment.items.length<2||shipment.items.length>500)return false;const entries=shipment.items.map(item=>drafts.entryForLine(workflow,shipment,item));return entries.every(entry=>entry!==null)&&batchTargetsCurrent(workflow,entries.map(entry=>entry!.target));},
  beginBatch(workflow:OrderWorkflowResponse,shipment:ShipmentResponse):ReceiptBatchTarget|null {if(!this.canBeginBatch(workflow,shipment))return null;const number=supplierOrderResponseSchema.shape.orderNumber.safeParse(workflow.order.orderNumber);if(!number.success)return null;const prior=batchPlans.get(workflow.orderId);if(prior)clearBatchReview(prior.target);const targets=drafts.beginMany(workflow,shipment);if(!targets||!batchTargetsCurrent(workflow,targets))return null;const first=targets[0]!,target=Object.freeze({orderId:first.orderId,orderNumber:number.data,orderVersion:first.orderVersion,shipmentId:first.shipmentId,shipmentNumber:first.shipmentNumber,shipmentVersion:first.shipmentVersion,targets});batchPlans.set(target.orderId,{target,workflow,shipment,reviewed:false});pulse();return target;},
  batchView(target:ReceiptBatchTarget):ReceiptBatchView|undefined {const plan=planFor(target);if(!plan)return undefined;if(!available()||!planCurrent(plan))return Object.freeze({target,phase:"changed",lines:Object.freeze([]),invalidIndex:null});const lines=rawLines(target),invalid=lines.findIndex(line=>checkReceiptText(line.rawQuantity,line.target)!==null),review=reviewedPlan(plan);return Object.freeze({target,phase:review?"review":"editing",lines,preview:review?plan.preview:undefined,issue:plan.issue,invalidIndex:invalid<0?null:invalid});},
  canReviewBatch,canSubmitBatch,
  changeBatch(target:ReceiptBatchTarget,row:ReceiptTarget,text:string){if(!canReviewBatch(target)||!target.targets.includes(row))return false;const plan=planFor(target)!;plan.reviewed=false;plan.preview=undefined;plan.rawAtReview=undefined;plan.issue=undefined;drafts.editMany(target.targets);const result=drafts.change(row,text);pulse();return result;},
  reviewBatch(target:ReceiptBatchTarget){if(!canReviewBatch(target))return false;const plan=planFor(target)!;plan.reviewed=true;const valid=drafts.reviewMany(target.targets);plan.reviewed=false;plan.preview=undefined;plan.rawAtReview=undefined;if(!valid){plan.issue="validation";pulse();return false;}const lines=rawLines(target),preview=Object.freeze(lines.map(line=>Object.freeze({shipmentItemId:line.shipmentItemId,deliveredQuantity:line.rawQuantity.trim().replace(",",".")})));if(!preview.some(line=>compareReceiptCounts(line.deliveredQuantity,"0")===1)){drafts.editMany(target.targets);plan.issue="zero";pulse();return false;}plan.reviewed=true;plan.issue=undefined;plan.preview=preview;plan.rawAtReview=Object.freeze(lines.map(line=>line.rawQuantity));pulse();return true;},
  editBatch(target:ReceiptBatchTarget){if(!canReviewBatch(target))return false;const plan=planFor(target)!;plan.reviewed=false;plan.preview=undefined;plan.rawAtReview=undefined;plan.issue=undefined;drafts.editMany(target.targets);pulse();return true;},clearBatchReview,
  canResumeBatch(workflow:OrderWorkflowResponse){const op=operations.get(workflow.orderId);return !!native&&available()&&isWorkflowActive(workflow.orderId)&&currentWorkflow(workflow.orderId)===workflow&&owned(workflow,workflow.orderId)&&!!op?.state.batch&&!["idle","key-error"].includes(op.state.phase)&&(op.state.phase!=="observed"||op.unresolved);},
  async submitBatch(target:ReceiptBatchTarget){if(!canSubmitBatch(target))return;const plan=planFor(target)!,op=opFor(target.orderId),batch=Object.freeze({target,lines:rawLines(target)}),key=workflowKeys.next();if(!key){emit(target.orderId,op,{phase:"key-error",orderId:target.orderId,batch,issue:"key"});return;}if(!canSubmitBatch(target))return;const parsed=receiptSchema.safeParse({action:"RECEIVE_SHIPMENT",expectedVersion:target.orderVersion,idempotencyKey:key,shipmentId:target.shipmentId,items:plan.preview});if(!parsed.success||parsed.data.action!=="RECEIVE_SHIPMENT"){emit(target.orderId,op,{phase:"key-error",orderId:target.orderId,batch,issue:"key"});return;}const first=target.targets[0]!;op.attempt=Object.freeze({workflow:plan.workflow,target:first,rawQuantity:batch.lines[0]!.rawQuantity,batch,input:Object.freeze({...parsed.data,items:Object.freeze(parsed.data.items.map(item=>Object.freeze(item)))}) as unknown as Readonly<ReceiveShipmentInput>});op.receipt=null;op.unresolved=false;await execute(target.orderId,op,false);},
  shouldShow(id:string,workflow?:OrderWorkflowResponse){return available()&&(operations.has(id)||!!workflow&&owned(workflow,id)&&Object.values(drafts.getSnapshot().entries).some(entry=>entry.available&&entry.target.orderId===id&&drafts.sourceMatches(workflow,entry.target)));},
  blocksOtherCommands:(id:string)=>active&&(authority()!==null||operations.get(id)?.unresolved===true||reviewedBatchActive(id)||locked(stateFor(id))),
  isLocked:(id:string)=>active&&(authority()!==null||otherOrderLocked(id)||operations.get(id)?.unresolved===true||reviewedBatchActive(id)||locked(stateFor(id))),
  knownBlock(workflow:OrderWorkflowResponse,target:ReceiptTarget){return available()&&owned(workflow,workflow.orderId)?knownBlock(workflow,target):null;},
  async submit(workflow:OrderWorkflowResponse,target:ReceiptTarget){
   if(!canSubmit(workflow,target))return;const entry=drafts.entryForTarget(target)!,op=opFor(target.orderId),key=workflowKeys.next();
   if(!key){emit(target.orderId,op,{phase:"key-error",orderId:target.orderId,rawQuantity:entry.text,issue:"key"});return;}
   const parsed=receiptSchema.safeParse({action:"RECEIVE_SHIPMENT",expectedVersion:target.orderVersion,idempotencyKey:key,shipmentId:target.shipmentId,items:[{shipmentItemId:target.itemId,deliveredQuantity:entry.text.trim().replace(",",".")}] });
   if(!parsed.success||parsed.data.action!=="RECEIVE_SHIPMENT"){emit(target.orderId,op,{phase:"key-error",orderId:target.orderId,rawQuantity:entry.text,issue:"key"});return;}
   op.attempt=Object.freeze({workflow,target,rawQuantity:entry.text,input:Object.freeze({...parsed.data,items:Object.freeze(parsed.data.items.map(item=>Object.freeze(item)))}) as unknown as Readonly<ReceiveShipmentInput>});op.receipt=null;op.unresolved=false;await execute(target.orderId,op,false);
  },
  canReplay(id:string){const op=operations.get(id),current=currentWorkflow(id);return available()&&!authority()&&!otherOrderLocked(id)&&isWorkflowActive(id)&&(!current||owned(current,id))&&!!op?.attempt&&op.unresolved&&["unknown","rejected","read-error","review","observed"].includes(op.state.phase);},
  async replay(id:string){const op=operations.get(id);if(op&&this.canReplay(id))await execute(id,op,true);},
  canRead(id:string){const op=operations.get(id);return available()&&isWorkflowActive(id)&&!!op?.attempt&&["receipt","unknown","rejected","read-error","review","observed"].includes(op.state.phase)&&!["authentication","denied"].includes(op.state.issue??"");},
  async readCurrent(id:string){
   const op=operations.get(id);if(!op||!this.canRead(id))return;const ownSequence=++op.sequence;op.reviewed=null;emit(id,op,{...op.state,phase:"reading",latest:undefined});
   try{const workflow=await reloadWorkflow(id);if(!active||ownSequence!==op.sequence)return;if(!available()){denyOrder(id);return;}if(!workflow||!owned(workflow,id)||currentWorkflow(id)!==workflow||workflow.version<(op.receipt?.version??op.attempt!.input.expectedVersion)){emit(id,op,{...op.state,phase:"read-error"});return;}op.reviewed=workflow;emit(id,op,{...op.state,phase:"review",latest:workflow,issue:undefined});}
   catch{if(active&&ownSequence===op.sequence)emit(id,op,{...op.state,phase:"read-error"});}
  },
  canAcknowledge(id:string){const op=operations.get(id);return available()&&!!op&&op.state.phase==="review"&&!!op.reviewed&&currentWorkflow(id)===op.reviewed&&owned(op.reviewed,id);},
  acknowledge(id:string){const op=operations.get(id);if(!op||!this.canAcknowledge(id))return false;op.reviewed=null;if(!op.unresolved){for(const entry of Object.values(drafts.getSnapshot().entries))if(entry.target.orderId===id&&entry.started)drafts.edit(entry.target);}emit(id,op,{phase:"observed",orderId:id,input:op.attempt?.input,rawQuantity:op.attempt?.rawQuantity,receipt:op.receipt??undefined,unresolved:op.unresolved,...(op.state.batch?{batch:op.state.batch}:{})});return true;},
  denyOrder,denyAll(){active=false;for(const id of operations.keys())denyOrder(id);},
  activate(){if(disposed){disposed=false;active=true;}},
  dispose(){disposed=true;active=false;for(const op of operations.values())op.sequence++;operations.clear();batchPlans.clear();listeners.clear();snapshot=Object.freeze({});},
 };
}
export type ShipmentReceiptCommands=ReturnType<typeof createShipmentReceiptCommands>;
