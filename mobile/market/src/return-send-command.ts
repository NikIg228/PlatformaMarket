import { nativeBuyerWorkflowAvailable, type NativeBuyerWorkflowCommands } from "./native-buyer-workflow-commands";
import { orderWorkflowCommandSchema, orderWorkflowResponseSchema, orderWorkflowResultSchema, type OrderWorkflowResponse, type OrderWorkflowResult } from "../../../packages/schemas/src/order-workflow";
import { orderReturnSchema, type OrderReturn } from "../../../packages/schemas/src/order-returns";
import { supplierOrderResponseSchema, errorResponseSchema } from "../../../packages/schemas/src/core-api";
import { authorizedBuyerWorkflow, createBuyerWorkflowKeys, type BuyerWorkflowKeys, type BuyerWorkflowCommandFixture, type SendReturnGoodsInput, type ReceiveManualRefundInput } from "./order-workflow-command-fixture";
import type { ReadScope } from "./read-controller";
type ReturnRecordInput=SendReturnGoodsInput|ReceiveManualRefundInput;
export type ReturnRecordAction=ReturnRecordInput["action"];
type Phase="idle"|"prepared"|"key-error"|"pending"|"receipt"|"unknown"|"rejected"|"reading"|"review"|"read-error"|"observed";
export type ReturnSendReview=Readonly<Pick<OrderReturn,"id"|"kind"|"status"|"amountMinor"|"currency"|"reason">&{items:readonly Readonly<OrderReturn["items"][number]>[];orderId:string;orderVersion:number;orderStatus:string;paymentStatus:string}>;
export type ReturnSendState=Readonly<{phase:Phase;orderId?:string;review?:ReturnSendReview;declared?:boolean;input?:Readonly<ReturnRecordInput>;receipt?:OrderWorkflowResult;latest?:OrderWorkflowResponse;unresolved?:boolean;issue?:"key"|"authentication"|"denied"|"validation"|"not-found"|"conflict"|"invalid-result"|"context"}>;
type Prepared=Readonly<{workflow:OrderWorkflowResponse;record:OrderReturn;review:ReturnSendReview}>;
type Attempt=Readonly<Prepared&{input:Readonly<ReturnRecordInput>}>;
type Operation={state:ReturnSendState;prepared:Prepared|null;attempt:Attempt|null;receipt:OrderWorkflowResult|null;unresolved:boolean;sequence:number;observed:OrderWorkflowResponse|null};
const idle:ReturnSendState=Object.freeze({phase:"idle"});
const binding=orderWorkflowResponseSchema.pick({orderId:true,version:true,status:true,paymentStatus:true}).strip().extend({order:supplierOrderResponseSchema.pick({id:true,buyerOrganizationId:true,currency:true,version:true,status:true,paymentStatus:true}).strip()});
const recordBinding=orderReturnSchema.pick({id:true,supplierOrderId:true,kind:true,status:true,currency:true}).strip();
const lineBinding=orderReturnSchema.shape.items.element.pick({orderItemId:true}).strip().array().max(500);
const receiptBinding=orderWorkflowResultSchema.pick({orderId:true,version:true,status:true,paymentStatus:true}).strip();
export function createReturnSendCommands(scope:ReadScope,fixture:BuyerWorkflowCommandFixture|undefined,currentWorkflow:(id:string)=>OrderWorkflowResponse|null,reloadWorkflow:(id:string)=>Promise<OrderWorkflowResponse|undefined>,isWorkflowActive:(id:string)=>boolean,otherOrderLocked:(id:string)=>boolean=()=>false,keyPool:BuyerWorkflowKeys|undefined=undefined,action:ReturnRecordAction="SEND_RETURN_GOODS",native?:NativeBuyerWorkflowCommands){
 const commands=native??fixture,workflowKeys=keyPool??createBuyerWorkflowKeys(scope,fixture,native);
 const owner=Object.freeze({...scope}),operations=new Map<string,Operation>(),listeners=new Set<()=>void>(),completedReturns=new Set<string>();let active=true,disposed=false,snapshot:Readonly<Record<string,ReturnSendState>>=Object.freeze({});
 const available=()=>active&&(native?nativeBuyerWorkflowAvailable(native,owner):authorizedBuyerWorkflow(owner,fixture))&&typeof commands?.executeOrderWorkflow==="function"&&typeof commands.nextWorkflowIdempotencyKey==="function";
 const authority=()=>workflowKeys.authorityIssue(),stateFor=(id:string)=>snapshot[id]??idle;
 const emit=(id:string,op:Operation,state:ReturnSendState)=>{op.state=Object.freeze(state);snapshot=Object.freeze({...snapshot,[id]:op.state});listeners.forEach(listener=>listener());};
 const opFor=(id:string)=>{let op=operations.get(id);if(!op){op={state:idle,prepared:null,attempt:null,receipt:null,unresolved:false,sequence:0,observed:null};operations.set(id,op);}return op;};
 const owned=(workflow:OrderWorkflowResponse,id:string)=>{const parsed=binding.safeParse(workflow);if(!parsed.success)return false;const w=parsed.data;return w.orderId===id&&w.order.id===id&&w.order.buyerOrganizationId===owner.organizationId&&w.version>0&&w.version===w.order.version&&w.status===w.order.status&&w.paymentStatus===w.order.paymentStatus;};
 const ownLock=(id:string)=>{const op=operations.get(id);return active&&(!!authority()||!!op?.prepared||op?.unresolved===true||!["idle","observed","key-error"].includes(stateFor(id).phase));};
 const selected=(workflow:OrderWorkflowResponse,record:OrderReturn)=>{
  if(!owned(workflow,workflow.orderId)||!workflow.returns?.includes(record)||new Set(workflow.returns.map(row=>row.id)).size!==workflow.returns.length)return false;
  const root=recordBinding.safeParse(record);if(!root.success||root.data.supplierOrderId!==workflow.orderId||(action==="SEND_RETURN_GOODS"&&root.data.kind!=="GOODS")||root.data.status!==(action==="SEND_RETURN_GOODS"?"AGREED":"REFUND_SENT")||root.data.currency!==workflow.order.currency)return false;
  const orderIds=new Set(workflow.order.items.map(item=>item.id)),lines=lineBinding.safeParse(record.items);if(orderIds.size!==workflow.order.items.length||workflow.order.items.some(item=>item.supplierOrderId!==workflow.orderId)||!lines.success||new Set(lines.data.map(item=>item.orderItemId)).size!==lines.data.length||lines.data.some(line=>!orderIds.has(line.orderItemId)))return false;
  if(root.data.kind==="GOODS"?lines.data.length===0:lines.data.length!==0)return false;
  if(action==="RECEIVE_MANUAL_REFUND"&&(!/^\d+$/.test(record.amountMinor)||!/[1-9]/.test(record.amountMinor)))return false;
  return orderReturnSchema.safeParse(record).success;
 };
 const reviewOf=(workflow:OrderWorkflowResponse,record:OrderReturn):ReturnSendReview=>Object.freeze({id:record.id,kind:record.kind,status:record.status,amountMinor:record.amountMinor,currency:record.currency,reason:record.reason,items:Object.freeze(record.items.map(line=>Object.freeze({...line}))),orderId:workflow.orderId,orderVersion:workflow.version,orderStatus:workflow.status,paymentStatus:workflow.paymentStatus});
 const sameSource=(prepared:Prepared)=>currentWorkflow(prepared.review.orderId)===prepared.workflow&&selected(prepared.workflow,prepared.record)&&JSON.stringify(reviewOf(prepared.workflow,prepared.record))===JSON.stringify(prepared.review);
 const canPrepare=(workflow:OrderWorkflowResponse,record:OrderReturn)=>available()&&!authority()&&!otherOrderLocked(workflow.orderId)&&!ownLock(workflow.orderId)&&isWorkflowActive(workflow.orderId)&&currentWorkflow(workflow.orderId)===workflow&&!completedReturns.has(record.id)&&selected(workflow,record);
 const uncertain=(id:string,op:Operation,issue?:ReturnSendState["issue"])=>{op.unresolved=true;emit(id,op,{...op.state,phase:"unknown",unresolved:true,receipt:undefined,issue});};
 const denyOrder=(id:string)=>{const op=operations.get(id);if(!op)return;op.sequence++;op.prepared=null;op.attempt=null;op.receipt=null;op.observed=null;emit(id,op,{phase:"rejected",orderId:id,unresolved:op.unresolved,issue:"denied"});};
 const acceptedPayment=(value:string,attempt:Attempt)=>value===attempt.review.paymentStatus||(action==="RECEIVE_MANUAL_REFUND"&&attempt.review.orderStatus==="CANCELLED"&&value==="REFUNDED");
 const execute=async(id:string,op:Operation,replay:boolean)=>{
  const attempt=op.attempt!,sequence=++op.sequence;op.prepared=null;op.observed=null;emit(id,op,{phase:"pending",orderId:id,review:attempt.review,input:attempt.input,unresolved:op.unresolved});
  const contextValid=()=>{const current=currentWorkflow(id);return isWorkflowActive(id)&&(!current||owned(current,id))&&(replay||sameSource(attempt));};
  try{
   const body=await commands!.executeOrderWorkflow(owner,id,attempt.input);if(!active||sequence!==op.sequence)return;if(!available()){denyOrder(id);return;}if(!contextValid()){uncertain(id,op,"context");return;}
   const root=receiptBinding.safeParse(body);if(!root.success||root.data.orderId!==id||root.data.version!==attempt.input.expectedVersion+1||root.data.status!==attempt.review.orderStatus||!acceptedPayment(root.data.paymentStatus,attempt)){uncertain(id,op,"invalid-result");return;}
   const parsed=orderWorkflowResultSchema.safeParse(body);if(!parsed.success||parsed.data.orderId!==id||parsed.data.version!==attempt.input.expectedVersion+1||parsed.data.status!==attempt.review.orderStatus||!acceptedPayment(parsed.data.paymentStatus,attempt)||parsed.data.cartId!==undefined||!workflowKeys.acceptEvent(id,parsed.data.eventId,attempt.input.idempotencyKey)){uncertain(id,op,"invalid-result");return;}
   completedReturns.add(attempt.input.returnId);op.receipt=Object.freeze(parsed.data);op.unresolved=false;emit(id,op,{...op.state,phase:"receipt",receipt:op.receipt,unresolved:false,issue:undefined});
  }catch(error){
   if(!active||sequence!==op.sequence)return;if(!available()){denyOrder(id);return;}if(!contextValid()){uncertain(id,op,"context");return;}
   const parsed=typeof error==="object"&&error!==null&&"payload"in error&&"status"in error?errorResponseSchema.safeParse(error.payload):null,status=typeof error==="object"&&error!==null&&"status"in error?error.status:undefined;
   if(!parsed?.success||parsed.data.statusCode!==status||![400,401,403,404,409].includes(status as number)){uncertain(id,op);return;}
   const issue=status===400?"validation":status===401?"authentication":status===403?"denied":status===404?"not-found":"conflict";if(issue==="authentication"||issue==="denied")workflowKeys.denyAuthority(issue);emit(id,op,{...op.state,phase:"rejected",issue,unresolved:op.unresolved});
  }
 };
 return {
 runtime:native?"native-session" as const:"fixture" as const,
  getSnapshot:()=>snapshot,stateFor,isAvailable:available,authorityIssue:authority,canPrepare,
  subscribe(listener:()=>void){listeners.add(listener);const off=workflowKeys.subscribe(()=>{snapshot=Object.freeze({...snapshot});listener();});return()=>{listeners.delete(listener);off();};},
  blocksOtherCommands:ownLock,isLocked:(id:string)=>ownLock(id)||otherOrderLocked(id),
  shouldShow(id:string,workflow?:OrderWorkflowResponse){return available()&&(operations.has(id)||!!workflow&&owned(workflow,id)&&workflow.returns?.some(record=>selected(workflow,record))===true);},
  prepare(workflow:OrderWorkflowResponse,record:OrderReturn){if(!canPrepare(workflow,record))return false;const op=opFor(workflow.orderId),review=reviewOf(workflow,record);op.prepared=Object.freeze({workflow,record,review});op.receipt=null;emit(workflow.orderId,op,{phase:"prepared",orderId:workflow.orderId,review,declared:false});return true;},
  canReview(workflow:OrderWorkflowResponse){const op=operations.get(workflow.orderId);return available()&&isWorkflowActive(workflow.orderId)&&!!op?.prepared&&["prepared","key-error"].includes(op.state.phase)&&sameSource(op.prepared);},
  declare(id:string,value:boolean){const op=operations.get(id);if(!op?.prepared||!this.canReview(op.prepared.workflow)||authority()||otherOrderLocked(id))return;emit(id,op,{...op.state,declared:value===true});},
  cancel(id:string){const op=operations.get(id);if(!available()||!op?.prepared||!["prepared","key-error"].includes(op.state.phase))return false;op.prepared=null;op.sequence++;emit(id,op,{phase:"idle"});return true;},
  canConfirm(id:string){const op=operations.get(id);return available()&&!authority()&&!otherOrderLocked(id)&&!!op?.prepared&&op.state.declared===true&&this.canReview(op.prepared.workflow);},
  async confirm(id:string){const op=operations.get(id);if(!op?.prepared||!this.canConfirm(id))return;const key=workflowKeys.next();if(!key){emit(id,op,{...op.state,phase:"key-error",issue:"key"});return;}const prepared=op.prepared,parsed=orderWorkflowCommandSchema.safeParse({action,expectedVersion:prepared.review.orderVersion,idempotencyKey:key,returnId:prepared.review.id});if(!parsed.success||(parsed.data.action!=="SEND_RETURN_GOODS"&&parsed.data.action!=="RECEIVE_MANUAL_REFUND")||parsed.data.action!==action){emit(id,op,{...op.state,phase:"key-error",issue:"key"});return;}const input=Object.freeze(parsed.data);if(!sameSource(prepared))return;op.attempt=Object.freeze({...prepared,input});op.unresolved=false;await execute(id,op,false);},
  canReplay(id:string){const op=operations.get(id),current=currentWorkflow(id);return available()&&!authority()&&!otherOrderLocked(id)&&isWorkflowActive(id)&&(!current||owned(current,id))&&!!op?.attempt&&op.unresolved&&!op.receipt&&["unknown","rejected","read-error","review","observed"].includes(op.state.phase);},
  async replay(id:string){const op=operations.get(id);if(op&&this.canReplay(id))await execute(id,op,true);},
  canRead(id:string){const op=operations.get(id);return available()&&isWorkflowActive(id)&&!!op?.attempt&&["receipt","unknown","rejected","read-error","review","observed"].includes(op.state.phase)&&!["authentication","denied"].includes(op.state.issue??"");},
  async readCurrent(id:string){const op=operations.get(id);if(!op||!this.canRead(id))return;const sequence=++op.sequence;op.observed=null;emit(id,op,{...op.state,phase:"reading",latest:undefined});try{const workflow=await reloadWorkflow(id);if(!active||sequence!==op.sequence)return;if(!available()){denyOrder(id);return;}if(!workflow||!owned(workflow,id)||currentWorkflow(id)!==workflow||workflow.version<(op.receipt?.version??op.attempt!.input.expectedVersion)){emit(id,op,{...op.state,phase:"read-error"});return;}op.observed=workflow;emit(id,op,{...op.state,phase:"review",latest:workflow,issue:undefined});}catch{if(active&&sequence===op.sequence)emit(id,op,{...op.state,phase:"read-error"});}},
  canAcknowledge(id:string){const op=operations.get(id);return available()&&!!op&&op.state.phase==="review"&&!!op.observed&&currentWorkflow(id)===op.observed&&owned(op.observed,id);},
  acknowledge(id:string){const op=operations.get(id);if(!op||!this.canAcknowledge(id))return false;op.observed=null;emit(id,op,{phase:"observed",orderId:id,review:op.attempt?.review,input:op.attempt?.input,receipt:op.receipt??undefined,unresolved:op.unresolved});return true;},
  denyOrder,denyAll(){active=false;for(const id of operations.keys())denyOrder(id);},activate(){if(disposed){disposed=false;active=true;}},
  dispose(){active=false;disposed=true;for(const op of operations.values())op.sequence++;operations.clear();listeners.clear();completedReturns.clear();snapshot=Object.freeze({});},
 };
}
export type ReturnSendCommands=ReturnType<typeof createReturnSendCommands>;
