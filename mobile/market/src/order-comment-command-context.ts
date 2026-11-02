import { z } from "zod";
import { createOrderCommentSchema } from "../../../packages/schemas/src/trust-commerce";
import type { OrderCommentsWindow } from "./order-comments-fixture-read";
import type { ReadScope } from "./read-controller";
export type OrderCommentCommandAuthorization=Readonly<{provenance:"synthetic-source-contract";scope:ReadScope;side:"BUYER";operator:false;permissions:readonly string[]}>;
const same=(a:ReadScope,b:ReadScope)=>a.product==="market"&&a.product===b.product&&a.environment===b.environment&&a.organizationId===b.organizationId&&a.userId===b.userId&&a.generation===b.generation;
export function authorizedOrderCommentMutation(scope:ReadScope,auth?:OrderCommentCommandAuthorization){return !!auth&&auth.provenance==="synthetic-source-contract"&&auth.side==="BUYER"&&auth.operator===false&&!!auth.scope&&same(scope,auth.scope)&&Array.isArray(auth.permissions)&&auth.permissions.includes("trust.comment.manage")&&auth.permissions.includes("trust.comment.view");}
const contextBinding=z.object({orderId:z.uuid(),orderVersion:z.number().int().positive(),buyerOrganizationId:z.uuid(),supplierOrganizationId:z.uuid()});
export function ownedOrderCommentsWindow(owner:ReadScope,window:OrderCommentsWindow,current:OrderCommentsWindow|null){if(window!==current)return false;const parsed=contextBinding.safeParse(window.context);return parsed.success&&parsed.data.buyerOrganizationId===owner.organizationId;}
/** Scope-owned denial/key identities only. Comment metadata cannot add or restore grants. */
export function createOrderCommentCommandContext(scope:ReadScope){const owner=Object.freeze({...scope}),listeners=new Set<()=>void>(),issued=new Set<string>(),rows=new Map<string,string>(),keys=new Map<string,string>(),versions=new Map<string,number>(),deniedOrders=new Set<string>();let active=true,authority:"authentication"|"denied"|null=null;return {
 matches:(other:ReadScope)=>same(owner,other),isActive:()=>active,authorityIssue:()=>authority,
 isOrderDenied:(orderId:string)=>deniedOrders.has(orderId),
 denyOrder(orderId:string){deniedOrders.add(orderId);listeners.forEach(listener=>listener());},
 minimumVersion:(rowId:string)=>versions.get(rowId)??0,
 recordVersion(rowId:string,version:number){if(active&&Number.isInteger(version)&&version>0)versions.set(rowId,Math.max(versions.get(rowId)??0,version));},
 deny(issue:"authentication"|"denied"){authority=issue;listeners.forEach(listener=>listener());},
 issue(provider:()=>unknown){if(!active||authority)return null;let key:unknown;try{key=provider();}catch{return null;}const parsed=createOrderCommentSchema.shape.idempotencyKey.safeParse(key);if(!parsed.success||issued.has(parsed.data))return null;issued.add(parsed.data);return parsed.data;},
 acceptResult(rowId:string,key:string){const oldKey=rows.get(rowId),oldRow=keys.get(key);if(oldKey&&oldKey!==key||oldRow&&oldRow!==rowId)return false;rows.set(rowId,key);keys.set(key,rowId);return true;},
 subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},activate(){active=true;},close(){active=false;authority=null;issued.clear();rows.clear();keys.clear();versions.clear();deniedOrders.clear();listeners.clear();},
 };}
export type OrderCommentCommandContext=ReturnType<typeof createOrderCommentCommandContext>;
