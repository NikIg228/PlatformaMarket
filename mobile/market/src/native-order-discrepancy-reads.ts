import { z } from "zod";
import type { ReadScope } from "./read-controller";
import { createMarketOperationScope } from "./market-operation-scope";
import { OrderDiscrepancyReadError } from "./order-discrepancy-read";
export type NativeOrderDiscrepancyReads = Readonly<{available:(scope:ReadScope)=>boolean;read:(scope:ReadScope,orderId:string)=>Promise<unknown>}>;
export type NativeOrderDiscrepancyClient = {nativeOrderDiscrepancyReads?:NativeOrderDiscrepancyReads};
export function bindNativeOrderDiscrepancyReads(scope:ReadScope,read:(path:string)=>Promise<unknown>,isCurrent:()=>boolean):Readonly<Required<NativeOrderDiscrepancyClient>>{
 const lifetime=createMarketOperationScope(scope,isCurrent,()=>new OrderDiscrepancyReadError("scope"));
 return Object.freeze({nativeOrderDiscrepancyReads:Object.freeze({available(candidate:ReadScope){try{lifetime.assert(candidate);return true;}catch{return false;}},async read(candidate:ReadScope,orderId:string){lifetime.assert(candidate);const id=z.uuid().safeParse(orderId);if(!id.success)throw new OrderDiscrepancyReadError("input");try{const raw=await read(`/supplier-orders/${encodeURIComponent(id.data)}/discrepancies`);lifetime.assert(candidate);return raw;}catch(error){lifetime.assert(candidate);throw error;}}})});
}
