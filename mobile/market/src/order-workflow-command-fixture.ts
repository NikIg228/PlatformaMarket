import { nativeBuyerWorkflowAvailable, type NativeBuyerWorkflowCommands } from "./native-buyer-workflow-commands";
import { orderWorkflowCommandSchema, type OrderWorkflowCommand } from "../../../packages/schemas/src/order-workflow";
import type { ReadScope } from "./read-controller";
export type BuyerWorkflowInput = Extract<OrderWorkflowCommand,{action:"CANCEL"|"RECEIVE_SHIPMENT"|"REQUEST_RETURN"|"SEND_RETURN_GOODS"|"RECEIVE_MANUAL_REFUND"|"REORDER"|"ACCEPT_COMPOSITION"|"OPEN_PAYMENT_DISPUTE"}>;
export type DecidePaymentReductionInput = Extract<OrderWorkflowCommand,{action:"DECIDE_PAYMENT_REDUCTION"}>;
export type ProposePaymentReductionInput = Extract<OrderWorkflowCommand,{action:"PROPOSE_PAYMENT_REDUCTION"}>;
export type NativeBuyerWorkflowInput = BuyerWorkflowInput | DecidePaymentReductionInput | ProposePaymentReductionInput;
export type OpenPaymentDisputeInput = Extract<BuyerWorkflowInput,{action:"OPEN_PAYMENT_DISPUTE"}>;
export type AcceptCompositionInput = Extract<BuyerWorkflowInput,{action:"ACCEPT_COMPOSITION"}>;
export type ReorderOrderInput = Extract<BuyerWorkflowInput,{action:"REORDER"}>;
export type ReceiveManualRefundInput = Extract<BuyerWorkflowInput,{action:"RECEIVE_MANUAL_REFUND"}>;
export type SendReturnGoodsInput = Extract<BuyerWorkflowInput,{action:"SEND_RETURN_GOODS"}>;
export type GoodsReturnInput = Extract<BuyerWorkflowInput,{action:"REQUEST_RETURN"}> & {kind:"GOODS"};
export type ReceiveShipmentInput = Extract<BuyerWorkflowInput,{action:"RECEIVE_SHIPMENT"}>;
export type CancelOrderInput = Extract<BuyerWorkflowInput,{action:"CANCEL"}>;
export type BuyerWorkflowCommandFixture = {
 authorization: Readonly<{provenance:"synthetic-source-contract";scope:ReadScope;side:"BUYER";operator:false;permissions:readonly string[]}>;
 nextWorkflowIdempotencyKey:()=>string;
 executeOrderWorkflow:(scope:ReadScope,orderId:string,input:Readonly<BuyerWorkflowInput>)=>Promise<unknown>;
};
export type BuyerWorkflowFixtureClient={buyerWorkflowCommandFixture?:BuyerWorkflowCommandFixture};
export function authorizedBuyerWorkflow(scope:ReadScope,fixture?:BuyerWorkflowCommandFixture,action?:"REORDER") {
 const auth=fixture?.authorization,other=auth?.scope;
 return !!auth&&auth.provenance==="synthetic-source-contract"&&auth.side==="BUYER"&&auth.operator===false&&!!other&&scope.product==="market"&&scope.product===other.product&&scope.environment===other.environment&&scope.userId===other.userId&&scope.organizationId===other.organizationId&&scope.generation===other.generation&&Array.isArray(auth.permissions)&&(action==="REORDER"?auth.permissions.includes("order.create"):auth.permissions.includes("order.approve")&&(auth.permissions.includes("order.create")||auth.permissions.includes("order.confirm")));
}
const cancellationBranch=orderWorkflowCommandSchema.options.find(option=>option.shape.action.value==="CANCEL");
if(!cancellationBranch)throw new Error("Existing CANCEL command branch missing");
const workflowKeySchema=cancellationBranch.shape.idempotencyKey;
/** One scope-owned issued UUID pool can be reused by the selected buyer actions. */
export function createBuyerWorkflowKeys(scope:ReadScope,fixture?:BuyerWorkflowCommandFixture,native?:NativeBuyerWorkflowCommands) {
 const commands=native??fixture;
 const owner=Object.freeze({...scope}),issued=new Set<string>(),events=new Map<string,string>(),listeners=new Set<()=>void>();let active=true,authority:"authentication"|"denied"|null=null;
 return {
  next(action?:"REORDER"):string|null {if(!active||authority||!(native?nativeBuyerWorkflowAvailable(native,owner):authorizedBuyerWorkflow(owner,fixture,action))||typeof commands?.nextWorkflowIdempotencyKey!=="function")return null;let key:unknown;try{key=commands.nextWorkflowIdempotencyKey();}catch{return null;}const parsed=workflowKeySchema.safeParse(key);if(!parsed.success||issued.has(parsed.data))return null;issued.add(parsed.data);return parsed.data;},
  authorityIssue:()=>authority,
  denyAuthority(issue:"authentication"|"denied"){authority=issue;listeners.forEach(listener=>listener());},
  subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
  acceptEvent(orderId:string,eventId:string,key:string){const identity=`${orderId}/${key}`,previous=events.get(eventId);if(previous&&previous!==identity)return false;events.set(eventId,identity);return true;},
  activate(){active=true;},close(){active=false;issued.clear();events.clear();authority=null;listeners.clear();},
 };
}
export type BuyerWorkflowKeys=ReturnType<typeof createBuyerWorkflowKeys>;
