import type { NativePaymentTransactions } from "./native-payment-transactions";
import { z } from "zod";
import type { CheckoutResponse } from "../../../packages/schemas/src/core-api";
import type { OrderWorkflowResponse } from "../../../packages/schemas/src/order-workflow";
import type { ReadScope } from "./read-controller";
import { MarketHttpError } from "./market-transport";
import { checkoutIntentFixturePointer } from "./payment-intent-fixture-read";
import { nativePaymentIntentReadsAvailable, NativePaymentIntentReadError, type NativePaymentIntentReads, type NativePaymentIntent, type NativeOrderCheckoutTarget } from "./native-payment-intent-reads";
export type OrderCheckoutIssue = "scope" | "denied" | "unavailable" | "throttled" | "contract" | "network";
export type NativeOrderCheckoutState = Readonly<{ phase:"idle" } | {phase:"loading";mode:"checkout"|"intent"|"transactions"} | {phase:"checkout";checkout:CheckoutResponse} | {phase:"intent";intent:NativePaymentIntent} | {phase:"transactions";transactions:NativePaymentTransactions} | {phase:"error";mode:"checkout"|"intent"|"transactions";issue:OrderCheckoutIssue}>;
function classify(error:unknown):OrderCheckoutIssue { if(error instanceof NativePaymentIntentReadError)return error.code==="scope"?"scope":"contract";if(error instanceof MarketHttpError)return error.status===401?"scope":error.status===403?"denied":error.status===404?"unavailable":error.status===429?"throttled":"network";return"network"; }
/** Own-order source checkout navigation without changing main workflow/query or mutating its drafts. */
export function createNativeOrderCheckout(scope:ReadScope,port:NativePaymentIntentReads|undefined,currentWorkflow:(orderId:string)=>OrderWorkflowResponse|null) {
  const owner=Object.freeze({...scope}),listeners=new Set<()=>void>();let active=true,sequence=0,state:NativeOrderCheckoutState=Object.freeze({phase:"idle"});
  let frame:{source:OrderWorkflowResponse;signature:string;target:NativeOrderCheckoutTarget;checkout?:CheckoutResponse;intent?:NativePaymentIntent}|undefined;
  const signature=(source:OrderWorkflowResponse)=>JSON.stringify([source.orderId,source.order.id,source.order.checkoutId,source.order.buyerOrganizationId,source.order.orderNumber,source.version,source.order.version]);
  const available=()=>active&&nativePaymentIntentReadsAvailable(port,owner);
  const owned=(source:OrderWorkflowResponse)=>available()&&currentWorkflow(source.orderId)===source&&source.orderId===source.order.id&&source.order.buyerOrganizationId===owner.organizationId&&z.uuid().safeParse(source.order.checkoutId).success;
  const same=()=>!!frame&&owned(frame.source)&&signature(frame.source)===frame.signature;
  const emit=(next:NativeOrderCheckoutState)=>{state=Object.freeze(next);listeners.forEach(fn=>fn());};
  const hide=()=>{sequence++;frame=undefined;emit({phase:"idle"});};
  const readCheckout=async()=>{if(!same()||state.phase==="loading")return false;const selected=frame!,mine=++sequence;selected.intent=undefined;emit({phase:"loading",mode:"checkout"});try{const checkout=await port!.readCheckoutForOrder(owner,selected.target);if(mine!==sequence||frame!==selected||!same())return false;selected.checkout=checkout;emit({phase:"checkout",checkout});return true;}catch(error){if(mine!==sequence||frame!==selected||!same())return false;selected.checkout=undefined;emit({phase:"error",mode:"checkout",issue:classify(error)});return false;}};
  const openIntent=async(checkout:CheckoutResponse)=>{if(!same()||state.phase==="loading"||frame!.checkout!==checkout)return false;const pointer=checkoutIntentFixturePointer(checkout,owner.organizationId);if(pointer.kind!=="available")return false;const selected=frame!,mine=++sequence;emit({phase:"loading",mode:"intent"});try{const intent=await port!.read(owner,Object.freeze({paymentIntentId:pointer.id,checkoutId:checkout.id}));if(mine!==sequence||frame!==selected||!same()||selected.checkout!==checkout)return false;selected.intent=intent;emit({phase:"intent",intent});return true;}catch(error){if(mine!==sequence||frame!==selected||!same())return false;emit({phase:"error",mode:"intent",issue:classify(error)});return false;}};
  const openTransactions=async(intent:NativePaymentIntent)=>{
    if(!same()||state.phase==="loading"||frame!.intent!==intent||!(state.phase==="intent"||state.phase==="transactions"||(state.phase==="error"&&state.mode==="transactions")))return false;
    const selected=frame!,mine=++sequence;emit({phase:"loading",mode:"transactions"});
    try{const transactions=await port!.readTransactions(owner,Object.freeze({paymentIntentId:intent.id,checkoutId:intent.checkoutId}));if(mine!==sequence||frame!==selected||!same()||selected.intent!==intent)return false;selected.intent=transactions.intent;emit({phase:"transactions",transactions});return true;}
    catch(error){if(mine!==sequence||frame!==selected||!same())return false;emit({phase:"error",mode:"transactions",issue:classify(error)});return false;}
  };
  const readIntent=()=>frame?.checkout?openIntent(frame.checkout):Promise.resolve(false);
  return {
    organizationId:owner.organizationId,getSnapshot:()=>state,subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},
    canOpen:owned,
    async open(source:OrderWorkflowResponse){if(!owned(source)||state.phase==="loading")return false;frame={source,signature:signature(source),target:Object.freeze({orderId:source.orderId,checkoutId:source.order.checkoutId})};return readCheckout();},
    readCheckout,openIntent,openTransactions,readIntent,
    retry(){if(state.phase==="transactions"||(state.phase==="error"&&state.mode==="transactions"))return frame?.intent?openTransactions(frame.intent):Promise.resolve(false);if(state.phase==="error"?state.mode==="intent":state.phase==="intent"){return frame?.checkout?openIntent(frame.checkout):Promise.resolve(false);}return readCheckout();},
    hide,activate(){active=true;},close(){active=false;hide();listeners.clear();},
  };
}
export type NativeOrderCheckout = ReturnType<typeof createNativeOrderCheckout>;
