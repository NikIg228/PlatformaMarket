import { z } from "zod";
import { supplierOrderResponseSchema } from "../../../packages/schemas/src/core-api";
import { orderWorkflowResponseSchema, type OrderWorkflowResponse } from "../../../packages/schemas/src/order-workflow";
import type { WorkspaceCartPage } from "../../../packages/schemas/src/workspace-reads";
import type { ReadScope } from "./read-controller";
const binding=orderWorkflowResponseSchema.pick({orderId:true,version:true,status:true,paymentStatus:true}).strip().extend({order:supplierOrderResponseSchema.pick({id:true,buyerOrganizationId:true,version:true,status:true,paymentStatus:true}).strip()});
const itemBinding=z.array(z.object({id:z.uuid(),supplierOrderId:z.uuid(),offerId:z.uuid()}));
const sourceFields=z.object({cartItemId:z.uuid().nullable(),giftForItemId:z.uuid().nullable(),acceptedQuantity:z.string().regex(/^-?\d{1,12}(?:\.\d{1,6})?$/)});
export type ReorderSourceLine=Readonly<{id:string;offerId:string;cartItemId:string|null;giftForItemId:string|null;acceptedQuantity:string;unitPriceMinor:string;totalPriceMinor:string;currency:string;name:string|null;selection:"accepted"|"no-history-reference"|"gift"|"not-positive"}>;
export type ReorderOrderSource=Readonly<{orderId:string;version:number;status:string;paymentStatus:string;orderNumber:string;currency:string;lines:readonly ReorderSourceLine[];selected:number;signature:string}>;
/** Source projection only. Historical line existence/stock/prices are decided by existing server paths. */
export function ownedReorderWorkflow(scope:ReadScope,workflow:OrderWorkflowResponse,orderId:string){const parsed=binding.safeParse(workflow);if(!parsed.success)return false;const w=parsed.data;return w.orderId===orderId&&w.order.id===orderId&&w.order.buyerOrganizationId===scope.organizationId&&w.version>0&&w.version===w.order.version&&w.status===w.order.status&&w.paymentStatus===w.order.paymentStatus;}
export function reorderOrderSource(scope:ReadScope,workflow:OrderWorkflowResponse):ReorderOrderSource|null{
 if(!ownedReorderWorkflow(scope,workflow,workflow.orderId)||!["DELIVERED","CANCELLED"].includes(workflow.status))return null;
 const bindings=itemBinding.safeParse(workflow.order.items);if(!bindings.success||bindings.data.some(item=>item.supplierOrderId!==workflow.orderId)||new Set(bindings.data.map(item=>item.id)).size!==bindings.data.length)return null;
 const lines:ReorderSourceLine[]=[];
 for(const item of workflow.order.items){const source=sourceFields.safeParse(item);if(!source.success)return null;const v=source.data,positive=!v.acceptedQuantity.startsWith("-")&&/[1-9]/.test(v.acceptedQuantity),selection=v.cartItemId===null?"no-history-reference":v.giftForItemId!==null?"gift":!positive?"not-positive":"accepted",name=item.offer?.productVariant.product.canonicalName??null;
  lines.push(Object.freeze({id:item.id,offerId:item.offerId,...v,unitPriceMinor:item.unitPriceMinor,totalPriceMinor:item.totalPriceMinor,currency:item.currency,name,selection}));
 }
 const selected=lines.filter(line=>line.selection==="accepted").length;if(!selected)return null;
 const value={orderId:workflow.orderId,version:workflow.version,status:workflow.status,paymentStatus:workflow.paymentStatus,orderNumber:workflow.order.orderNumber,currency:workflow.order.currency,lines:Object.freeze(lines),selected};return Object.freeze({...value,signature:JSON.stringify(value)});
}
export type ReorderWorkspaceSource=Readonly<{currentId:string|null;currentVersion:number|null;signature:string;knownCartIds:readonly string[]}>;
export function ownedReorderWorkspace(scope:ReadScope,page:WorkspaceCartPage){const carts=[...(page.current?[page.current]:[]),...page.items];return carts.every(cart=>cart.buyerOrganizationId===scope.organizationId)&&page.items.every(cart=>new Set(cart.items.map(item=>item.id)).size===cart.items.length&&cart.items.every(item=>item.cartId===cart.id))&&(!page.current||new Set(page.current.items.map(item=>item.id)).size===page.current.items.length&&page.current.items.every(item=>item.cartId===page.current!.id))&&new Set(page.items.map(cart=>cart.id)).size===page.items.length;}
export function reorderWorkspaceSource(scope:ReadScope,page:WorkspaceCartPage):ReorderWorkspaceSource|null{
 if(!ownedReorderWorkspace(scope,page))return null;const cart=page.current;if(cart&&(cart.status!=="ACTIVE"||!Number.isInteger(cart.version)||cart.version<=0||cart.checkout!==null||cart.items.length>0))return null;
 const value={currentId:cart?.id??null,currentVersion:cart?.version??null,knownCartIds:Object.freeze([...new Set([...(cart?[cart.id]:[]),...page.items.map(row=>row.id)])])};return Object.freeze({...value,signature:JSON.stringify({knownCartIds:value.knownCartIds,currentId:value.currentId,currentVersion:value.currentVersion,currency:cart?.currency??null,status:cart?.status??null,checkout:cart?.checkout??null,items:cart?.items.length??null})});
}
