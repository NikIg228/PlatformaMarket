import { orderWorkflowResultSchema } from "../../../../packages/schemas/src/order-workflow";
import type { WorkspaceCartPage } from "../../../../packages/schemas/src/workspace-reads";
import type { BuyerWorkflowCommandFixture, ReorderOrderInput } from "../order-workflow-command-fixture";
import { cancellationCommandScope, cancellationCommandWorkflow } from "./order-cancellation-command";
import { cancellationId } from "./cancellation-draft";
import { commandCart } from "./cart-commands";
export const reorderScope=cancellationCommandScope,reorderId=cancellationId;
export function reorderAuthorization():BuyerWorkflowCommandFixture["authorization"]{return {provenance:"synthetic-source-contract",scope:{...reorderScope},side:"BUYER",operator:false,permissions:["order.create"]};}
export function reorderWorkflow(status:"DELIVERED"|"CANCELLED"="DELIVERED"){const value=cancellationCommandWorkflow();value.status=value.order.status=status;value.paymentStatus=value.order.paymentStatus=status==="DELIVERED"?"PAID":"UNPAID";for(const item of value.order.items){item.cartItemId=reorderId(17001);item.giftForItemId=null;item.acceptedQuantity="1.250000";}return value;}
export function reorderWorkspace(emptyCart=false):WorkspaceCartPage{if(!emptyCart)return {current:null,items:[],nextCursor:null};const cart=commandCart(7);cart.buyerOrganizationId=reorderScope.organizationId;cart.items=[];cart.checkout=null;return {current:cart,items:[cart],nextCursor:null};}
export function reorderResult(orderId:string,input:Readonly<ReorderOrderInput>,status="DELIVERED",paymentStatus="PAID",cartId=reorderId(17002),eventId=reorderId(17003)){return orderWorkflowResultSchema.parse({orderId,version:input.expectedVersion+1,status,paymentStatus,cartId,eventId});}
