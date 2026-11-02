import { z } from "zod";
import { orderDiscrepancyCommandSchema } from "../../../packages/schemas/src/order-discrepancy";
import { createMarketOperationScope } from "./market-operation-scope";
import { createNativeUuidSource,type NativeUuidProvider } from "./native-uuid-source";
import type { ReadScope } from "./read-controller";
const sourceCreate=orderDiscrepancyCommandSchema.options[0];
export const nativeDiscrepancyCreateSchema=sourceCreate.extend({statement:sourceCreate.shape.statement.safeExtend({attachmentIds:z.tuple([])})}).strict().refine(value=>value.sourceDocumentId===null?value.sourceDocumentVersion===null&&value.sourceDocumentChecksum===null:value.sourceDocumentVersion!==null).refine(value=>value.statement.kind!=="RECEIPT_ERROR"||value.sourceReceiptEventId!==null);
export const nativeDiscrepancyDraftActionSchema=z.discriminatedUnion("action",[orderDiscrepancyCommandSchema.options[1],orderDiscrepancyCommandSchema.options[2],orderDiscrepancyCommandSchema.options[4]]);
export type NativeDiscrepancyDraftActionInput=Readonly<z.output<typeof nativeDiscrepancyDraftActionSchema>>;
export type NativeDiscrepancyCreateInput=Readonly<z.output<typeof nativeDiscrepancyCreateSchema>>;
export type NativeDiscrepancyCreatePort=Readonly<{available:(scope:ReadScope)=>boolean;canIssueKey:(scope:ReadScope)=>boolean;nextKey:(scope:ReadScope)=>string;create:(scope:ReadScope,orderId:string,input:NativeDiscrepancyCreateInput)=>Promise<unknown>;executeDraft?:(scope:ReadScope,orderId:string,input:NativeDiscrepancyDraftActionInput)=>Promise<unknown>}>;
export type NativeDiscrepancyCreateClient={nativeDiscrepancyCreate?:NativeDiscrepancyCreatePort};
export class NativeDiscrepancyCreateError extends Error {constructor(readonly code:"scope"|"input"|"key"){super("Discrepancy request is unavailable");this.name="NativeDiscrepancyCreateError";}}
/** Existing buyer routes only. Capability is never a permission grant. */
export function bindNativeDiscrepancyCreate(scope:ReadScope,post:(path:string,body:Readonly<object>)=>Promise<unknown>,provider:NativeUuidProvider|undefined,isCurrent:()=>boolean){
 const lifetime=createMarketOperationScope(scope,isCurrent,()=>new NativeDiscrepancyCreateError("scope")),keys=createNativeUuidSource(scope,provider,isCurrent),issued=new Set<string>(),pinned=new Map<string,Readonly<{orderId:string;bytes:string;body:NativeDiscrepancyCreateInput|NativeDiscrepancyDraftActionInput}>>();
 const send=async(candidate:ReadScope,orderId:string,input:NativeDiscrepancyCreateInput|NativeDiscrepancyDraftActionInput,kind:"create"|"draft")=>{
  lifetime.assert(candidate);let body:typeof input;try{z.uuid().parse(orderId);const parsed=kind==="create"?nativeDiscrepancyCreateSchema.parse(input):nativeDiscrepancyDraftActionSchema.parse(input);if(parsed.idempotencyKey!==input.idempotencyKey||"statement"in parsed&&(!("statement"in input)||parsed.statement.reason!==input.statement.reason)||"reason"in parsed&&(!("reason"in input)||parsed.reason!==input.reason))throw Error();if("statement"in parsed){parsed.statement.lines.forEach(Object.freeze);Object.freeze(parsed.statement.lines);Object.freeze(parsed.statement.attachmentIds);Object.freeze(parsed.statement);}body=Object.freeze(parsed);}catch{throw new NativeDiscrepancyCreateError("input");}
  lifetime.assert(candidate);if(!issued.has(body.idempotencyKey))throw new NativeDiscrepancyCreateError("key");const bytes=JSON.stringify(body),previous=pinned.get(body.idempotencyKey);if(previous&&(previous.orderId!==orderId||previous.bytes!==bytes))throw new NativeDiscrepancyCreateError("input");const attempt=previous??Object.freeze({orderId,bytes,body});if(!previous)pinned.set(body.idempotencyKey,attempt);
  try{const result=await post(`/supplier-orders/${encodeURIComponent(orderId)}/discrepancies`,attempt.body);lifetime.assert(candidate);return result;}catch(error){lifetime.assert(candidate);throw error;}
 };
 const port:NativeDiscrepancyCreatePort=Object.freeze({available(candidate){try{lifetime.assert(candidate);return true;}catch{return false;}},canIssueKey:keys.canIssue,nextKey(candidate){lifetime.assert(candidate);const key=keys.next(candidate);lifetime.assert(candidate);issued.add(key);return key;},create:(candidate,orderId,input)=>send(candidate,orderId,input,"create"),executeDraft:(candidate,orderId,input)=>send(candidate,orderId,input,"draft")});
 return Object.freeze({port,close(){lifetime.close();keys.close();issued.clear();pinned.clear();}});
}
