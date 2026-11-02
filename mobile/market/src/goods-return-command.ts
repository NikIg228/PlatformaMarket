import { nativeBuyerWorkflowAvailable, type NativeBuyerWorkflowCommands } from "./native-buyer-workflow-commands";
import { compareReceiptCounts } from "./shipment-receipt-draft";
import { orderReturnSchema } from "../../../packages/schemas/src/order-returns";
import { orderWorkflowCommandSchema, orderWorkflowResultSchema, orderWorkflowResponseSchema, type OrderWorkflowResponse, type OrderWorkflowResult } from "../../../packages/schemas/src/order-workflow";
import { supplierOrderResponseSchema, errorResponseSchema } from "../../../packages/schemas/src/core-api";
import type { ReadScope } from "./read-controller";
import { checkGoodsReturnFields, type GoodsReturnDrafts, type GoodsReturnTarget } from "./goods-return-draft";
import { authorizedBuyerWorkflow, createBuyerWorkflowKeys, type BuyerWorkflowKeys, type BuyerWorkflowCommandFixture, type GoodsReturnInput } from "./order-workflow-command-fixture";
export type GoodsReturnBatchTarget=Readonly<{orderId:string;orderNumber:string;orderVersion:number;names:readonly Readonly<{itemId:string;name:string|null}>[];targets:readonly GoodsReturnTarget[]}>;
export type GoodsReturnBatchLine=Readonly<{target:GoodsReturnTarget;rawQuantity:string;rawCondition:string}>;
export type GoodsReturnBatchReport=Readonly<{target:GoodsReturnBatchTarget;rawReason:string;lines:readonly GoodsReturnBatchLine[]}>;
export type GoodsReturnBatchPreview=Readonly<{reason:string;items:readonly Readonly<{orderItemId:string;quantity:string;condition:string}>[]}>;
export type GoodsReturnBatchView=Readonly<{target:GoodsReturnBatchTarget;phase:"editing"|"review"|"changed";reason:string;lines:readonly Readonly<GoodsReturnBatchLine&{selected:boolean}>[];preview?:GoodsReturnBatchPreview;issue?:"empty"|"validation"|"blocked";invalidIndex:number|null;block?:string}>;
type GoodsReturnBatchPlan={target:GoodsReturnBatchTarget;workflow:OrderWorkflowResponse;reason:string;selected:Set<GoodsReturnTarget>;reviewed:boolean;review?:GoodsReturnBatchReport;preview?:GoodsReturnBatchPreview;issue?:"empty"|"validation"|"blocked";invalidIndex:number|null;block?:string};
type Phase="idle"|"key-error"|"pending"|"receipt"|"unknown"|"rejected"|"reading"|"review"|"read-error"|"observed";
export type GoodsReturnCommandState=Readonly<{phase:Phase;orderId?:string;batch?:GoodsReturnBatchReport;input?:Readonly<GoodsReturnInput>;rawFields?:Readonly<{reason:string;quantityText:string;condition:string}>;receipt?:OrderWorkflowResult;latest?:OrderWorkflowResponse;unresolved?:boolean;issue?:"key"|"authentication"|"denied"|"validation"|"not-found"|"conflict"|"invalid-result"|"context"}>;
type Attempt=Readonly<{batch?:GoodsReturnBatchReport;workflow:OrderWorkflowResponse;target:GoodsReturnTarget;rawFields:Readonly<{reason:string;quantityText:string;condition:string}>;input:Readonly<GoodsReturnInput>}>;
type Operation={state:GoodsReturnCommandState;attempt:Attempt|null;receipt:OrderWorkflowResult|null;unresolved:boolean;sequence:number;reviewed:OrderWorkflowResponse|null};
const receiptBinding=orderWorkflowResultSchema.pick({orderId:true,version:true,status:true,paymentStatus:true}).strip();
const idle:GoodsReturnCommandState=Object.freeze({phase:"idle"});
const binding=orderWorkflowResponseSchema.pick({orderId:true,version:true,status:true,paymentStatus:true}).strip().extend({order:supplierOrderResponseSchema.pick({id:true,buyerOrganizationId:true,version:true,status:true,paymentStatus:true}).strip()});
const returnBranch=orderWorkflowCommandSchema.options.find(option=>option.shape.action.value==="REQUEST_RETURN");
if(!returnBranch)throw new Error("Existing REQUEST_RETURN branch missing");
const returnSchema=returnBranch;
export function createGoodsReturnCommands(scope:ReadScope,fixture:BuyerWorkflowCommandFixture|undefined,drafts:GoodsReturnDrafts,currentWorkflow:(orderId:string)=>OrderWorkflowResponse|null,reloadWorkflow:(orderId:string)=>Promise<OrderWorkflowResponse|undefined>,isWorkflowActive:(orderId:string)=>boolean,otherOrderLocked:(orderId:string)=>boolean=()=>false,keyPool:BuyerWorkflowKeys|undefined=undefined,native?:NativeBuyerWorkflowCommands) {
 const commands=native??fixture,workflowKeys=keyPool??createBuyerWorkflowKeys(scope,fixture,native);
 const owner=Object.freeze({...scope}),operations=new Map<string,Operation>(),batchPlans=new Map<string,GoodsReturnBatchPlan>(),listeners=new Set<()=>void>();
 let active=true,disposed=false,snapshot:Readonly<Record<string,GoodsReturnCommandState>>=Object.freeze({});
 const available=()=>active&&(native?nativeBuyerWorkflowAvailable(native,owner):authorizedBuyerWorkflow(owner,fixture))&&typeof commands?.executeOrderWorkflow==="function"&&typeof commands.nextWorkflowIdempotencyKey==="function";
 const authority=()=>workflowKeys.authorityIssue();
 const stateFor=(id:string)=>snapshot[id]??idle;
 const opFor=(id:string)=>{let op=operations.get(id);if(!op){op={state:idle,attempt:null,receipt:null,unresolved:false,sequence:0,reviewed:null};operations.set(id,op);}return op;};
 const emit=(id:string,op:Operation,state:GoodsReturnCommandState)=>{op.state=Object.freeze(state);snapshot=Object.freeze({...snapshot,[id]:op.state});listeners.forEach(listener=>listener());};
 const owned=(workflow:OrderWorkflowResponse,orderId:string)=>{const parsed=binding.safeParse(workflow);if(!parsed.success)return false;const w=parsed.data;return w.orderId===orderId&&w.order.id===orderId&&w.order.buyerOrganizationId===owner.organizationId&&w.version>0&&w.version===w.order.version&&w.status===w.order.status&&w.paymentStatus===w.order.paymentStatus;};
 const sourceLine=(workflow:OrderWorkflowResponse,target:GoodsReturnTarget)=>{const item=workflow.order.items.find(row=>row.id===target.itemId);if(!item||drafts.entryForItem(workflow,item)?.target!==target)return null;const shipments=workflow.order.shipments??[];if(shipments.some(shipment=>shipment.supplierOrderId!==target.orderId||shipment.items.some(line=>line.shipmentId!==shipment.id)))return null;const dispatches=shipments.filter(shipment=>shipment.status!=="CANCELLED"&&shipment.dispatchedAt!==null&&shipment.items.some(line=>line.supplierOrderItemId===target.itemId)).map(shipment=>({id:shipment.id,version:shipment.version,status:shipment.status,dispatchedAt:shipment.dispatchedAt})).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);return JSON.stringify(dispatches)===JSON.stringify(target.dispatches)?item:null;};
 const knownBlock=(workflow:OrderWorkflowResponse,target:GoodsReturnTarget)=>{if(!sourceLine(workflow,target))return "source";const entry=drafts.entryForTarget(target);if(entry&&compareReceiptCounts(entry.quantityText.trim().replace(",","."),target.acceptedQuantity)===1)return "accepted-limit";if(workflow.returns===undefined)return "unknown-returns";if(workflow.returns.some(row=>row.supplierOrderId!==target.orderId||row.currency!==workflow.order.currency||row.items.some(line=>!workflow.order.items.some(item=>item.id===line.orderItemId)))||new Set(workflow.returns.map(row=>row.id)).size!==workflow.returns.length||!orderReturnSchema.array().safeParse(workflow.returns).success)return "invalid-returns";if(workflow.returns.some(row=>!["REJECTED","REFUND_RECEIVED"].includes(row.status)))return "open-return";if(!workflow.claims.length||workflow.claims.some(claim=>claim.status!=="CONFIRMED"))return "claims";return null;};
 const locked=(state:GoodsReturnCommandState)=>!["idle","observed","key-error"].includes(state.phase);
 const canSubmit=(workflow:OrderWorkflowResponse,target:GoodsReturnTarget)=>{
  if(!available()||authority()||otherOrderLocked(target.orderId)||reviewedBatchActive(target.orderId)||!isWorkflowActive(target.orderId)||currentWorkflow(target.orderId)!==workflow||!owned(workflow,target.orderId)||knownBlock(workflow,target))return false;
  const entry=drafts.entryForTarget(target),op=operations.get(target.orderId);
  return !!entry?.started&&entry.reviewing&&sourceLine(workflow,target)!==null&&Object.keys(checkGoodsReturnFields(target.itemId,entry.reason,entry.quantityText,entry.condition)).length===0&&(!op||!locked(op.state)&&!op.unresolved);
 };
 const sameAttemptSource=(attempt:Attempt)=>{
  const current=currentWorkflow(attempt.target.orderId),entry=drafts.entryForTarget(attempt.target);
  if(attempt.batch)return current===attempt.workflow&&owned(current,attempt.target.orderId)&&attempt.batch.lines.every(line=>{const value=drafts.entryForTarget(line.target);return sourceLine(current,line.target)!==null&&value?.started&&value.quantityText===line.rawQuantity&&value.condition===line.rawCondition&&!knownBlock(current,line.target);});
  return current===attempt.workflow&&owned(current,attempt.target.orderId)&&sourceLine(current,attempt.target)!==null&&!!entry?.started&&entry.reviewing&&entry.reason===attempt.rawFields.reason&&entry.quantityText===attempt.rawFields.quantityText&&entry.condition===attempt.rawFields.condition&&!knownBlock(current,attempt.target);
 };
 const uncertain=(id:string,op:Operation,issue?:GoodsReturnCommandState["issue"])=>{op.unresolved=true;emit(id,op,{...op.state,phase:"unknown",unresolved:true,issue,receipt:undefined});};
 const denyOrder=(id:string)=>{const op=operations.get(id);if(!op)return;op.sequence++;batchPlans.delete(id);op.attempt=null;op.reviewed=null;op.receipt=null;emit(id,op,{phase:"rejected",orderId:id,...(op.state.batch?{batch:op.state.batch}:{}),issue:"denied",unresolved:op.unresolved});};
 const execute=async(id:string,op:Operation,replay:boolean)=>{
  const attempt=op.attempt!,ownSequence=++op.sequence;op.reviewed=null;
  emit(id,op,{phase:"pending",orderId:id,input:attempt.input,rawFields:attempt.rawFields,unresolved:op.unresolved,...(attempt.batch?{batch:attempt.batch}:{})});
  const contextValid=()=>{const current=currentWorkflow(id);return isWorkflowActive(id)&&(!current||owned(current,id))&&(replay||sameAttemptSource(attempt));};
  try {
   const body=await commands!.executeOrderWorkflow(owner,id,attempt.input);
   if(!active||ownSequence!==op.sequence)return;if(!available()){denyOrder(id);return;}if(!contextValid()){uncertain(id,op,"context");return;}
   const root=receiptBinding.safeParse(body);
   if(!root.success||root.data.orderId!==id||root.data.version!==attempt.input.expectedVersion+1||root.data.status!==attempt.target.orderStatus||root.data.paymentStatus!=="PAID"){uncertain(id,op,"invalid-result");return;}
   const parsed=orderWorkflowResultSchema.safeParse(body);
   if(!parsed.success||parsed.data.orderId!==id||parsed.data.version!==attempt.input.expectedVersion+1||parsed.data.status!==attempt.target.orderStatus||parsed.data.paymentStatus!=="PAID"||parsed.data.cartId!==undefined||[...operations].some(([other,record])=>other!==id&&record.receipt?.eventId===parsed.data.eventId)){uncertain(id,op,"invalid-result");return;}
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
 const planFor=(target:GoodsReturnBatchTarget)=>{const plan=batchPlans.get(target.orderId);return plan?.target===target?plan:undefined;};
 const itemName=(workflow:OrderWorkflowResponse,target:GoodsReturnTarget)=>{try{const item=sourceLine(workflow,target),offer=item?.offer;if(!item||!offer||offer.id!==item.offerId||offer.productVariant.id!==item.productVariantId)return null;const name=offer.productVariant.product.canonicalName;return typeof name==="string"&&name.trim()?name:null;}catch{return null;}};
 const candidatesCurrent=(workflow:OrderWorkflowResponse,targets:readonly GoodsReturnTarget[])=>targets.length>=2&&targets.length<=500&&new Set(targets.map(row=>row.itemId)).size===targets.length&&targets.every(row=>row.orderId===workflow.orderId&&sourceLine(workflow,row)!==null);
 const planCurrent=(plan:GoodsReturnBatchPlan)=>currentWorkflow(plan.target.orderId)===plan.workflow&&owned(plan.workflow,plan.target.orderId)&&candidatesCurrent(plan.workflow,plan.target.targets);
 const reviewedBatchActive=(id:string)=>{const plan=batchPlans.get(id);return !!plan?.reviewed&&isWorkflowActive(id)&&planCurrent(plan);};
 const batchBaseAvailable=(workflow:OrderWorkflowResponse)=>!!native&&available()&&!authority()&&!otherOrderLocked(workflow.orderId)&&isWorkflowActive(workflow.orderId)&&currentWorkflow(workflow.orderId)===workflow&&owned(workflow,workflow.orderId)&&!locked(stateFor(workflow.orderId))&&!operations.get(workflow.orderId)?.unresolved;
 const canReviewBatch=(target:GoodsReturnBatchTarget)=>{const plan=planFor(target);return !!plan&&batchBaseAvailable(plan.workflow)&&planCurrent(plan);};
 const selectedLines=(plan:GoodsReturnBatchPlan)=>Object.freeze(plan.target.targets.filter(row=>plan.selected.has(row)).map(target=>{const value=drafts.entryForTarget(target)!;return Object.freeze({target,rawQuantity:value.quantityText,rawCondition:value.condition});}));
 const reviewedPlan=(plan:GoodsReturnBatchPlan)=>!!plan.reviewed&&!!plan.review&&!!plan.preview&&plan.reason===plan.review.rawReason&&plan.selected.size===plan.review.lines.length&&plan.review.lines.every(line=>{const value=drafts.entryForTarget(line.target);return plan.selected.has(line.target)&&value?.started&&value.quantityText===line.rawQuantity&&value.condition===line.rawCondition&&!knownBlock(plan.workflow,line.target);});
 const canSubmitBatch=(target:GoodsReturnBatchTarget)=>{const plan=planFor(target);return !!plan&&canReviewBatch(target)&&reviewedPlan(plan);};
 const clearBatchReview=(target:GoodsReturnBatchTarget)=>{const plan=planFor(target);if(!plan||locked(stateFor(target.orderId))||operations.get(target.orderId)?.unresolved)return false;plan.reviewed=false;plan.review=undefined;plan.preview=undefined;plan.issue=undefined;plan.invalidIndex=null;plan.block=undefined;pulse();return true;};
 return {
 runtime:native?"native-session" as const:"fixture" as const,
  getSnapshot:()=>snapshot,stateFor,subscribe(listener:()=>void){listeners.add(listener);const off=workflowKeys.subscribe(()=>{snapshot=Object.freeze({...snapshot});listener();});return()=>{listeners.delete(listener);off();};},
  isAvailable:available,authorityIssue:authority,canSubmit,
  canBeginBatch(workflow:OrderWorkflowResponse){if(!batchBaseAvailable(workflow)||reviewedBatchActive(workflow.orderId))return false;const targets=workflow.order.items.map(item=>drafts.entryForItem(workflow,item)?.target).filter((row):row is GoodsReturnTarget=>row!==undefined);return candidatesCurrent(workflow,targets);},
  beginBatch(workflow:OrderWorkflowResponse):GoodsReturnBatchTarget|null {if(!this.canBeginBatch(workflow))return null;const prior=batchPlans.get(workflow.orderId);if(prior&&planCurrent(prior))return prior.target;const targets=Object.freeze(workflow.order.items.map(item=>drafts.entryForItem(workflow,item)?.target).filter((row):row is GoodsReturnTarget=>row!==undefined));if(!candidatesCurrent(workflow,targets))return null;const first=targets[0]!,target=Object.freeze({orderId:first.orderId,orderNumber:first.orderNumber,orderVersion:first.orderVersion,names:Object.freeze(targets.map(row=>Object.freeze({itemId:row.itemId,name:itemName(workflow,row)}))),targets});batchPlans.set(target.orderId,{target,workflow,reason:"",selected:new Set(),reviewed:false,invalidIndex:null});pulse();return target;},
  batchReason(target:GoodsReturnBatchTarget){const plan=planFor(target);return plan&&available()&&planCurrent(plan)?plan.reason:null;},
  batchView(target:GoodsReturnBatchTarget):GoodsReturnBatchView|undefined {const plan=planFor(target);if(!plan)return undefined;if(!available()||!planCurrent(plan))return Object.freeze({target,phase:"changed",reason:"",lines:Object.freeze([]),invalidIndex:null});const lines=Object.freeze(target.targets.map(target=>{const value=drafts.entryForTarget(target)!;return Object.freeze({target,selected:plan.selected.has(target),rawQuantity:value.quantityText,rawCondition:value.condition});}));return Object.freeze({target,phase:reviewedPlan(plan)?"review":"editing",reason:plan.reason,lines,preview:reviewedPlan(plan)?plan.preview:undefined,issue:plan.issue,invalidIndex:plan.invalidIndex,block:plan.block});},
  canReviewBatch,canSubmitBatch,clearBatchReview,
  changeBatchReason(target:GoodsReturnBatchTarget,text:string){if(!canReviewBatch(target)||typeof text!=="string")return false;clearBatchReview(target);planFor(target)!.reason=text;pulse();return true;},
  selectBatchLine(target:GoodsReturnBatchTarget,row:GoodsReturnTarget,selected:boolean){if(!canReviewBatch(target)||!target.targets.includes(row))return false;const plan=planFor(target)!;if(selected){const item=plan.workflow.order.items.find(item=>item.id===row.itemId)!;if(drafts.begin(plan.workflow,item)!==row)return false;}clearBatchReview(target);if(selected)plan.selected.add(row);else plan.selected.delete(row);pulse();return true;},
  changeBatchLine(target:GoodsReturnBatchTarget,row:GoodsReturnTarget,field:"quantityText"|"condition",text:string){if(!canReviewBatch(target)||!planFor(target)!.selected.has(row)||!target.targets.includes(row))return false;clearBatchReview(target);const changed=drafts.change(row,field,text);pulse();return changed;},
  reviewBatch(target:GoodsReturnBatchTarget){if(!canReviewBatch(target))return false;const plan=planFor(target)!;clearBatchReview(target);const lines=selectedLines(plan);if(!lines.length){plan.issue="empty";pulse();return false;}const invalid=lines.find(line=>Object.keys(checkGoodsReturnFields(line.target.itemId,plan.reason,line.rawQuantity,line.rawCondition)).length>0);if(invalid){plan.issue="validation";plan.invalidIndex=target.targets.indexOf(invalid.target);pulse();return false;}const blocked=lines.find(line=>knownBlock(plan.workflow,line.target)!==null);if(blocked){plan.issue="blocked";plan.block=knownBlock(plan.workflow,blocked.target)!;plan.invalidIndex=target.targets.indexOf(blocked.target);pulse();return false;}plan.review=Object.freeze({target,rawReason:plan.reason,lines});plan.preview=Object.freeze({reason:plan.reason.trim(),items:Object.freeze(lines.map(line=>Object.freeze({orderItemId:line.target.itemId,quantity:line.rawQuantity.trim().replace(",","."),condition:line.rawCondition.trim()})))});plan.reviewed=true;pulse();return true;},
  canResumeBatch(workflow:OrderWorkflowResponse){const op=operations.get(workflow.orderId);return !!native&&available()&&isWorkflowActive(workflow.orderId)&&currentWorkflow(workflow.orderId)===workflow&&owned(workflow,workflow.orderId)&&!!op?.state.batch&&!["idle","key-error"].includes(op.state.phase)&&(op.state.phase!=="observed"||op.unresolved);},
  async submitBatch(target:GoodsReturnBatchTarget){if(!canSubmitBatch(target))return;const plan=planFor(target)!,op=opFor(target.orderId),batch=plan.review!,key=workflowKeys.next();if(!key){emit(target.orderId,op,{phase:"key-error",orderId:target.orderId,batch,issue:"key"});return;}if(!canSubmitBatch(target))return;const parsed=returnSchema.safeParse({action:"REQUEST_RETURN",expectedVersion:target.orderVersion,kind:"GOODS",...plan.preview,idempotencyKey:key});if(!parsed.success||parsed.data.action!=="REQUEST_RETURN"||parsed.data.kind!=="GOODS"){emit(target.orderId,op,{phase:"key-error",orderId:target.orderId,batch,issue:"key"});return;}const first=batch.lines[0]!;op.attempt=Object.freeze({workflow:plan.workflow,target:first.target,rawFields:Object.freeze({reason:batch.rawReason,quantityText:first.rawQuantity,condition:first.rawCondition}),batch,input:Object.freeze({...parsed.data,items:Object.freeze(parsed.data.items.map(item=>Object.freeze(item)))}) as unknown as Readonly<GoodsReturnInput>});op.receipt=null;op.unresolved=false;await execute(target.orderId,op,false);},

  shouldShow(id:string,workflow?:OrderWorkflowResponse){return available()&&(operations.has(id)||!!workflow&&owned(workflow,id)&&Object.values(drafts.getSnapshot().entries).some(entry=>entry.available&&entry.target.orderId===id&&drafts.sourceMatches(workflow,entry.target)));},
  blocksOtherCommands:(id:string)=>active&&(authority()!==null||operations.get(id)?.unresolved===true||reviewedBatchActive(id)||locked(stateFor(id))),
  isLocked:(id:string)=>active&&(authority()!==null||otherOrderLocked(id)||operations.get(id)?.unresolved===true||reviewedBatchActive(id)||locked(stateFor(id))),
  knownBlock(workflow:OrderWorkflowResponse,target:GoodsReturnTarget){return available()&&owned(workflow,workflow.orderId)?knownBlock(workflow,target):null;},
  async submit(workflow:OrderWorkflowResponse,target:GoodsReturnTarget){
   if(!canSubmit(workflow,target))return;const entry=drafts.entryForTarget(target)!,op=opFor(target.orderId),key=workflowKeys.next();
   if(!key){emit(target.orderId,op,{phase:"key-error",orderId:target.orderId,rawFields:Object.freeze({reason:entry.reason,quantityText:entry.quantityText,condition:entry.condition}),issue:"key"});return;}
   const parsed=returnSchema.safeParse({action:"REQUEST_RETURN",expectedVersion:target.orderVersion,idempotencyKey:key,kind:"GOODS",reason:entry.reason,items:[{orderItemId:target.itemId,quantity:entry.quantityText.trim().replace(",","."),condition:entry.condition}] });
   if(!parsed.success||parsed.data.action!=="REQUEST_RETURN"||parsed.data.kind!=="GOODS"){emit(target.orderId,op,{phase:"key-error",orderId:target.orderId,rawFields:Object.freeze({reason:entry.reason,quantityText:entry.quantityText,condition:entry.condition}),issue:"key"});return;}
   op.attempt=Object.freeze({workflow,target,rawFields:Object.freeze({reason:entry.reason,quantityText:entry.quantityText,condition:entry.condition}),input:Object.freeze({...parsed.data,items:Object.freeze(parsed.data.items.map(item=>Object.freeze(item)))}) as unknown as Readonly<GoodsReturnInput>});op.receipt=null;op.unresolved=false;await execute(target.orderId,op,false);
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
  acknowledge(id:string){const op=operations.get(id);if(!op||!this.canAcknowledge(id))return false;op.reviewed=null;if(!op.unresolved){for(const entry of Object.values(drafts.getSnapshot().entries))if(entry.target.orderId===id&&entry.started)drafts.edit(entry.target);}emit(id,op,{phase:"observed",orderId:id,input:op.attempt?.input,rawFields:op.attempt?.rawFields,receipt:op.receipt??undefined,unresolved:op.unresolved,...(op.state.batch?{batch:op.state.batch}:{})});return true;},
  denyOrder,denyAll(){active=false;for(const id of operations.keys())denyOrder(id);},
  activate(){if(disposed){disposed=false;active=true;}},
  dispose(){disposed=true;active=false;for(const op of operations.values())op.sequence++;operations.clear();batchPlans.clear();listeners.clear();snapshot=Object.freeze({});},
 };
}
export type GoodsReturnCommands=ReturnType<typeof createGoodsReturnCommands>;
