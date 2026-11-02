import { checkoutCartSchema, updateOrderCommentSchema } from "../../../../packages/schemas/src/index";
import { orderWorkflowCommandSchema, orderWorkflowResponseSchema, type OrderWorkflowResponse, type OrderWorkflowResult } from "../../../../packages/schemas/src/order-workflow";
import { workspaceOrderPageSchema } from "../../../../packages/schemas/src/workspace-reads";
import type { CartResponse, CheckoutResponse } from "../../../../packages/schemas/src/core-api";
import type { SupportTicketDetail } from "../../../../packages/schemas/src/support-workflow";
import type { MobileReadClient, ReadScope } from "../read-controller";
import type { CreateOrderCommentInput } from "../order-comment-create-command";
import { orderCommentRowFixtureSchema } from "../order-comment-row-fixture";
import { cartCommandScope, cartCommandAuthorization, cartCommandError, commandCart } from "./cart-commands";
import { cartCheckoutReceipt } from "./cart-checkout";
import { cartValidationResult } from "./cart-validation";
import { savedPage } from "./carts";
import { compositionWorkflow, compositionAuthorization } from "./order-composition-command";
import { commentCreateAuthorization, commentCreateResult } from "./order-comment-create-command";
import { disputeWorkflow } from "./payment-dispute-command";
import { supportDetail, supportId } from "./support";
import { syntheticSupportAuthorization, postedSupportMessage } from "./support-commands";
import { listDraftPayload } from "./list-draft";

export const buyerJourneyScope=cartCommandScope;
type Step="checkout"|"workflow"|"comment-create"|"comment-edit"|"support-reply";
export type JourneyCall=Readonly<{step:string;target:string;input?:unknown;scope?:ReadScope}>;
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
const date="2026-10-30T13:14:15.000Z";

/** Scripted DTO/identity fixture, not a supplier, inventory, payment or eligibility simulator. */
export function createSyntheticBuyerJourney(){
 const scope=Object.freeze({...buyerJourneyScope}),original=commandCart(3),calls:JourneyCall[]=[],loss=new Set<Step>();
 let cart:CartResponse|null=original,workflow:OrderWorkflowResponse|null=null,ticket:SupportTicketDetail|null=null,counter=25000;
 let comments:ReturnType<typeof orderCommentRowFixtureSchema.parse>[]=[];
 const checkouts=new Map<string,{actor:string;cartId:string;input:string;receipt:CheckoutResponse}>();
 const events=new Map<string,{actor:string;orderId:string;input:string;result:OrderWorkflowResult}>();
 const replies=new Map<string,ReturnType<typeof postedSupportMessage>>();
 const uuid=()=>supportId(counter++),log=(step:string,target:string,input?:unknown,owner?:ReadScope)=>calls.push(Object.freeze({step,target,input,scope:owner}));
 const own=(owner:ReadScope)=>{if(owner.product!==scope.product||owner.environment!==scope.environment||owner.organizationId!==scope.organizationId||owner.userId!==scope.userId||owner.generation!==scope.generation)throw cartCommandError(403);};
 const deliver=<T>(step:Step,value:T):T=>{if(loss.delete(step))throw new Error(`SYNTHETIC committed ${step} response lost`);return clone(value);};
 const requireOrder=(id:string)=>{if(!workflow||workflow.orderId!==id)throw cartCommandError(404);return workflow;};
 const checkoutRead=async(id:string)=>{log("checkout-read",id);const found=[...checkouts.values()].find(row=>row.receipt.id===id);if(!found)throw cartCommandError(404);return clone(found.receipt);};
 const client:MobileReadClient={
  searchCatalog:async()=>listDraftPayload("catalog-empty"),compareOffers:async()=>listDraftPayload("comparison-exact-offer"),
  workspaceCarts:async()=>{log("workspace-carts","current");return clone(savedPage(cart,[]));},
  workspaceCart:async(id)=>{log("cart-read",id);if(id!==original.id)throw cartCommandError(404);const stored=[...checkouts.values()].find(row=>row.cartId===id)?.receipt;return clone(stored?{...stored.cart,checkout:{id:stored.id,status:stored.status}}:original);},
  getCheckout:checkoutRead,
  workspaceOrders:async()=>{log("workspace-orders","current");const order=workflow?.order;return workspaceOrderPageSchema.parse({items:order?[{...order,supplier:order.supplier??{id:order.supplierOrganizationId,displayName:"SYNTHETIC supplied journey supplier"},buyer:order.buyer??{id:order.buyerOrganizationId,displayName:"SYNTHETIC supplied journey buyer"},itemCount:order.items.length}]:[],nextCursor:null});},
  getOrderWorkflow:async(id)=>{log("workflow-read",id);return clone(requireOrder(id));},
  orderCommentsFixture:async(owner,id)=>{own(owner);requireOrder(id);log("comments-read",id,undefined,owner);return clone(comments);},
  supportTickets:async()=>ticket?[clone(ticket)]:[],
  supportTicket:async(id,before)=>{log("support-read",id,before);if(!ticket||ticket.id!==id)throw cartCommandError(404);return clone(ticket);},
  cartCommandFixture:{authorization:cartCommandAuthorization(),nextCheckoutIdempotencyKey:()=>{const key=`SYNTHETIC-journey-checkout-${counter++}`;log("checkout-key",key);return key;},
   validateCart:async(owner,id)=>{own(owner);log("validate",id,undefined,owner);if(!cart||cart.id!==id)throw cartCommandError(409);return cartValidationResult(cart);},
   checkoutCart:async(owner,id,wire)=>{own(owner);log("checkout",id,wire,owner);const input=checkoutCartSchema.parse(wire),previous=checkouts.get(input.idempotencyKey);
    if(previous){if(previous.actor!==owner.userId||previous.cartId!==id||previous.input!==JSON.stringify(input))throw cartCommandError(409);return deliver("checkout",previous.receipt);}
    if(!cart||cart.id!==id||cart.version!==input.expectedVersion)throw cartCommandError(409);
    const receipt=cartCheckoutReceipt(cart,input),order=receipt.supplierOrders[0]!;
    // This only binds supplied checkout DTOs. Later supplier snapshots are explicitly provided below.
    const base=compositionWorkflow();base.order=clone(order);base.orderId=order.id;base.version=order.version;base.status=order.status;base.paymentStatus=order.paymentStatus;base.claims=[];base.returns=[];base.events=[];
    workflow=orderWorkflowResponseSchema.parse(base);checkouts.set(input.idempotencyKey,{actor:owner.userId,cartId:id,input:JSON.stringify(input),receipt});cart=null;
    return deliver("checkout",receipt);
   }},
  buyerWorkflowCommandFixture:{authorization:{...compositionAuthorization(),scope},nextWorkflowIdempotencyKey:()=>{const key=uuid();log("workflow-key",key);return key;},
   executeOrderWorkflow:async(owner,id,wire)=>{own(owner);log("workflow",id,wire,owner);const input=orderWorkflowCommandSchema.parse(wire),old=events.get(input.idempotencyKey);
    if(old){if(old.actor!==owner.userId||old.orderId!==id||old.input!==JSON.stringify(input))throw cartCommandError(409);return deliver("workflow",old.result);}
    const current=requireOrder(id);if(current.version!==input.expectedVersion)throw cartCommandError(409);
    if(input.action==="ACCEPT_COMPOSITION"){if(current.status!=="PARTIALLY_CONFIRMED"||current.paymentStatus!=="UNPAID")throw cartCommandError(409);current.status=current.order.status="CONFIRMED";}
    else if(input.action==="OPEN_PAYMENT_DISPUTE"){const claim=current.claims.find(row=>row.id===input.claimId);if(!claim||claim.status==="CONFIRMED")throw cartCommandError(409);claim.status="DISPUTED";}
    else throw cartCommandError(400); // This journey supplies only these two workflow branches.
    current.version=current.order.version=current.version+1;const result={orderId:id,version:current.version,status:current.status,paymentStatus:current.paymentStatus,eventId:uuid()};
    const {expectedVersion:_version,idempotencyKey:_key,...details}=input;current.events.push({id:result.eventId,action:input.action,actorId:owner.userId,organizationId:owner.organizationId,createdAt:date,details});
    events.set(input.idempotencyKey,{actor:owner.userId,orderId:id,input:JSON.stringify(input),result});return deliver("workflow",result);
   }},
  orderCommentCreateCommandFixture:{authorization:{...commentCreateAuthorization(),scope},nextOrderCommentIdempotencyKey:()=>{const key=`SYNTHETIC-journey-comment-${counter++}`;log("comment-key",key);return key;},
   createOrderComment:async(owner,id,input:Readonly<CreateOrderCommentInput>)=>{own(owner);requireOrder(id);log("comment-create",id,input,owner);let row=comments.find(row=>row.idempotencyKey===input.idempotencyKey);
    if(row){if(row.supplierOrderId!==id||row.authorOrganizationId!==owner.organizationId||row.authorUserId!==owner.userId)throw cartCommandError(409);}
    else{row={...commentCreateResult(id,input,uuid()),authorOrganizationId:owner.organizationId,authorUserId:owner.userId};comments=[...comments,row];}
    return deliver("comment-create",row);
   }},
  orderCommentEditCommandFixture:{authorization:{...commentCreateAuthorization(),scope},updateOrderComment:async(owner,id,wire)=>{own(owner);log("comment-edit",id,wire,owner);const input=updateOrderCommentSchema.parse(wire),row=comments.find(row=>row.id===id&&row.authorUserId===owner.userId&&row.authorOrganizationId===owner.organizationId);if(!row)throw cartCommandError(404);if(row.version!==input.version)throw cartCommandError(409);const value={...row,body:input.body,version:row.version+1,editedAt:date,updatedAt:date};comments=comments.map(row=>row.id===id?value:row);return deliver("comment-edit",value);}},
  supportCommandFixture:{authorization:{...syntheticSupportAuthorization(),scope},nextIdempotencyKey:()=>{const key=uuid();log("support-key",key);return key;},addSupportMessage:async(owner,id,input)=>{own(owner);log("support-reply",id,input,owner);if(!ticket||ticket.id!==id)throw cartCommandError(404);const previous=replies.get(input.idempotencyKey);if(previous)return deliver("support-reply",previous);const message={...postedSupportMessage(id,input),id:uuid(),authorId:owner.userId};replies.set(input.idempotencyKey,message);ticket={...ticket,version:ticket.version+1,messages:[...ticket.messages,message]};return deliver("support-reply",message);}},
 };
 return {
  scope,client,original,calls,
  loseNext(step:Step){loss.add(step);},
  checkout:()=>clone([...checkouts.values()][0]?.receipt??null),workflow:()=>clone(workflow),comments:()=>clone(comments),ticket:()=>clone(ticket),
  provideComposition(){const current=requireOrder(workflow?.orderId??"");current.version=current.order.version=current.version+1;current.status=current.order.status="PARTIALLY_CONFIRMED";current.paymentStatus=current.order.paymentStatus="UNPAID";current.reservationState={status:"ACTIVE",expiresAt:null};for(const row of current.order.items){if(row.offer){row.offer.id=row.offerId;row.offer.productVariant.id=row.productVariantId;}}},
  provideTransferSupport(){const current=requireOrder(workflow?.orderId??""),claim=disputeWorkflow().claims[0]!;claim.id=uuid();claim.currency=current.order.currency;claim.supportTicketId=uuid();current.claims=[claim];current.version=current.order.version=current.version+1;ticket=supportDetail({id:claim.supportTicketId,organizationId:scope.organizationId,requesterId:scope.userId,number:"SYNTHETIC-JOURNEY-SUPPORT",hasOlder:false,links:[{id:uuid(),ticketId:claim.supportTicketId,entityType:"SupplierOrder",entityId:current.orderId,label:current.order.orderNumber,createdAt:date}]});},
  provideDelivered(){const current=requireOrder(workflow?.orderId??"");current.version=current.order.version=current.version+1;current.status=current.order.status="DELIVERED";current.paymentStatus=current.order.paymentStatus="PAID";for(const row of current.order.items){row.cartItemId=original.items[0]!.id;row.giftForItemId=null;row.acceptedQuantity="1.000000";}},
 };
}
