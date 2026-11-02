import { decodeDiscrepancyResponseEvents,type DiscrepancyResponseEvent,type DiscrepancyCounterProposal } from "./native-discrepancy-response-events";
import { z } from "zod";
import { shipmentResponseSchema } from "../../../packages/schemas/src/core-api";
import { orderDiscrepanciesResponseSchema as response, orderDiscrepancyViewSchema as claimSchema, discrepancyStatementSchema as statementSchema } from "../../../packages/schemas/src/order-discrepancy";
import type { OrderWorkflowResponse } from "../../../packages/schemas/src/order-workflow";
import type { ReadScope } from "./read-controller";
import { compareReceiptCounts } from "./shipment-receipt-draft";

export class OrderDiscrepancyReadError extends Error {
  constructor(readonly code: "scope" | "input" | "changed" | "contract") { super("Order discrepancy read is unavailable"); this.name = "OrderDiscrepancyReadError"; }
}
export function discrepancyWorkflowSignature(workflow: OrderWorkflowResponse): string {
  return JSON.stringify([workflow.orderId,workflow.version,workflow.order.id,workflow.order.version,workflow.order.buyerOrganizationId,workflow.order.supplierOrganizationId,workflow.order.orderNumber,workflow.order.updatedAt,workflow.order.items.map(row=>row.id),workflow.order.shipments?.map(row=>[row.id,row.supplierOrderId,row.version,row.shipmentNumber,row.status,row.resupplySourceShipmentId,row.resupplyDiscrepancyId,row.items.map(line=>[line.id,line.shipmentId,line.supplierOrderItemId,line.quantity,line.deliveredQuantity])])]);
}
type ParentLine = Readonly<{id:string;orderItemId:string;quantity:string;deliveredQuantity:string}>;
type ParentShipment = Readonly<{id:string;version:number;number:string;status:string;sourceId:string|null;discrepancyId:string|null;lines:readonly ParentLine[]}>;
export type DiscrepancyParent = Readonly<{orderId:string;version:number;number:string;buyerOrganizationId:string;supplierOrganizationId:string;signature:string;shipments:readonly ParentShipment[]}>;
export function captureDiscrepancyParent(workflow:OrderWorkflowResponse,scope:ReadScope):DiscrepancyParent {
  try {
    if(workflow.orderId!==workflow.order.id||workflow.version!==workflow.order.version||workflow.order.buyerOrganizationId!==scope.organizationId||!z.uuid().safeParse(workflow.orderId).success||!Array.isArray(workflow.order.shipments))throw Error();
    const orderIds=new Set(workflow.order.items.map(row=>row.id)),shipIds=new Set<string>(),lineIds=new Set<string>();
    if(orderIds.size!==workflow.order.items.length)throw Error();
    const shipments=workflow.order.shipments.map(ship=>{
      if(shipIds.has(ship.id)||ship.supplierOrderId!==workflow.orderId||!z.uuid().safeParse(ship.id).success)throw Error();shipIds.add(ship.id);
      const lines=ship.items.map(line=>{if(lineIds.has(line.id)||line.shipmentId!==ship.id||!orderIds.has(line.supplierOrderItemId))throw Error();lineIds.add(line.id);return Object.freeze({id:line.id,orderItemId:line.supplierOrderItemId,quantity:line.quantity,deliveredQuantity:line.deliveredQuantity});});
      return Object.freeze({id:ship.id,version:ship.version,number:ship.shipmentNumber,status:ship.status,sourceId:ship.resupplySourceShipmentId??null,discrepancyId:ship.resupplyDiscrepancyId??null,lines:Object.freeze(lines)});
    });
    return Object.freeze({orderId:workflow.orderId,version:workflow.version,number:workflow.order.orderNumber,buyerOrganizationId:scope.organizationId,supplierOrganizationId:workflow.order.supplierOrganizationId,signature:discrepancyWorkflowSignature(workflow),shipments:Object.freeze(shipments)});
  }catch{throw new OrderDiscrepancyReadError("contract");}
}
const sourceLine=response.shape.shipments.element.shape.lines.element;
const lineIds=sourceLine.pick({shipmentItemId:true,orderItemId:true}).strip();
const lineDisplay=sourceLine.pick({shipmentItemId:true,orderItemId:true,name:true,uom:true,sentQuantity:true,recordedReceivedQuantity:true}).strip();
const documentDisplay=response.shape.shipments.element.shape.documents.element.pick({id:true,version:true,title:true}).strip();
const shipmentIdentity=response.shape.shipments.element.pick({id:true,version:true}).strip().extend({lines:z.array(lineIds),documents:z.array(z.object({id:z.uuid()}))});
const shipmentDisplay=response.shape.shipments.element.pick({id:true,version:true,number:true}).strip().extend({lines:z.array(lineDisplay),documents:z.array(documentDisplay)});
const statementIdentity=z.object({kind:statementSchema.shape.kind,lines:z.array(z.object({shipmentItemId:z.uuid()})),attachmentIds:statementSchema.shape.attachmentIds});
const eventIdentity=claimSchema.shape.events.element.pick({id:true,version:true}).strip();
const claimIdentity=claimSchema.pick({id:true,shipmentId:true,version:true,status:true,resolution:true}).strip().extend({statement:statementIdentity,source:z.object({orderVersion:claimSchema.shape.source.shape.orderVersion,shipmentVersion:claimSchema.shape.source.shape.shipmentVersion,lines:z.array(lineIds)}),attachments:z.array(claimSchema.shape.attachments.element.pick({id:true}).strip()),events:z.array(eventIdentity),resupply:z.object({lines:z.array(lineIds),shipment:z.object({id:z.uuid()}).nullable()}).nullable()});
const statementDisplay=z.object({kind:statementSchema.shape.kind,reason:statementSchema.shape.reason,requestedResolution:statementSchema.shape.requestedResolution,lines:statementSchema.shape.lines,attachmentIds:statementSchema.shape.attachmentIds});
const eventDisplay=claimSchema.shape.events.element.pick({id:true,version:true,action:true}).strip().extend({createdAt:z.iso.datetime()});
const attachmentDisplay=claimSchema.shape.attachments.element;
const resupplySchema=claimSchema.shape.resupply.unwrap();
const replacementDisplay=resupplySchema.shape.shipment.unwrap().strip().extend({status:shipmentResponseSchema.shape.status,dispatchedAt:z.iso.datetime().nullable(),deliveredAt:z.iso.datetime().nullable()});
const resupplyDisplay=resupplySchema.pick({documentStatus:true,warehouseName:true,recipientName:true,method:true,lines:true}).strip().extend({shipment:replacementDisplay.nullable()});
const claimDisplay=claimSchema.pick({id:true,shipmentId:true,version:true,status:true,resolution:true}).strip().extend({statement:statementDisplay,source:z.object({orderVersion:claimSchema.shape.source.shape.orderVersion,shipmentVersion:claimSchema.shape.source.shape.shipmentVersion,lines:z.array(lineDisplay)}),attachments:z.array(attachmentDisplay),events:z.array(eventDisplay),resupply:resupplyDisplay.nullable(),createdAt:z.iso.datetime(),updatedAt:z.iso.datetime()});
export type NativeDiscrepancyShipment = z.output<typeof shipmentDisplay>;
export type NativeDiscrepancyClaim = Omit<z.output<typeof claimDisplay>,"events"> & Readonly<{events:readonly DiscrepancyResponseEvent[];counterProposal:DiscrepancyCounterProposal|null;resupplyIssue?:"unverified"}>;
export type NativeOrderDiscrepancySnapshot = Readonly<{orderId:string;orderVersion:number;shipments:readonly NativeDiscrepancyShipment[];claims:readonly NativeDiscrepancyClaim[]}>;
function unique<T>(rows:readonly T[],key:(row:T)=>string):boolean{return new Set(rows.map(key)).size===rows.length;}
function freeze<T>(value:T):T{if(value&&typeof value==="object"){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
/** Closed read projection. Native availability never turns source canWrite/canDispatch into a permission. */
export function decodeOrderDiscrepancies(raw:unknown,parent:DiscrepancyParent):NativeOrderDiscrepancySnapshot {
  try {
    const root=response.pick({orderId:true,orderVersion:true,party:true}).strip().parse(raw);
    if(root.orderId!==parent.orderId||root.party!=="BUYER")throw Error();
    if(root.orderVersion!==parent.version)throw new OrderDiscrepancyReadError("changed");
    const collections=z.object({shipments:z.array(z.unknown()),discrepancies:z.array(z.unknown())}).parse(raw);
    const ships=collections.shipments.map(row=>shipmentIdentity.parse(row)),claims=collections.discrepancies.map(row=>claimIdentity.parse(row)),parents=new Map(parent.shipments.map(row=>[row.id,row]));
    if(!unique(ships,row=>row.id)||!unique(claims,row=>row.id))throw Error();
    const shipMap=new Map(ships.map(row=>[row.id,row])),allLineIds=new Set<string>(),allEvents=new Set<string>(),unverifiedResupply=new Set<string>();
    for(const ship of ships){const original=parents.get(ship.id);if(!original)throw Error();if(ship.version!==original.version)throw new OrderDiscrepancyReadError("changed");if(!unique(ship.documents,row=>row.id))throw Error();const originalLines=new Map(original.lines.map(row=>[row.id,row]));for(const line of ship.lines){if(allLineIds.has(line.shipmentItemId)||originalLines.get(line.shipmentItemId)?.orderItemId!==line.orderItemId)throw Error();allLineIds.add(line.shipmentItemId);}}
    for(const claim of claims){
      const ship=shipMap.get(claim.shipmentId);if(!ship||claim.source.orderVersion>root.orderVersion||claim.source.shipmentVersion>ship.version)throw Error();
      const availableLines=new Map(ship.lines.map(row=>[row.shipmentItemId,row.orderItemId])),sourceIds=new Set(claim.source.lines.map(row=>row.shipmentItemId)),declaredIds=new Set(claim.statement.attachmentIds);
      if(!unique(claim.source.lines,row=>row.shipmentItemId)||!unique(claim.statement.lines,row=>row.shipmentItemId)||claim.statement.lines.length!==claim.source.lines.length||declaredIds.size!==claim.statement.attachmentIds.length||!unique(claim.attachments,row=>row.id))throw Error();
      if(claim.source.lines.some(row=>availableLines.get(row.shipmentItemId)!==row.orderItemId)||claim.statement.lines.some(row=>!sourceIds.has(row.shipmentItemId))||claim.attachments.some(row=>!declaredIds.has(row.id)))throw Error();
      if(claim.resupply){
        const invalidContext=claim.status!=="AGREED"||claim.resolution!=="RESUPPLY"||claim.statement.kind!=="SHORTAGE"||!unique(claim.resupply.lines,row=>row.shipmentItemId)||claim.resupply.lines.some(row=>!sourceIds.has(row.shipmentItemId)||availableLines.get(row.shipmentItemId)!==row.orderItemId);
        if(invalidContext)unverifiedResupply.add(claim.id);
        if(claim.resupply.shipment){const replacement=parents.get(claim.resupply.shipment.id);if(!replacement||!shipMap.has(replacement.id)||replacement.sourceId!==claim.shipmentId||replacement.discrepancyId!==claim.id)unverifiedResupply.add(claim.id);}
      }
      for(const event of claim.events){if(allEvents.has(event.id)||event.version>claim.version)throw Error();allEvents.add(event.id);}
    }
    // Only after every identity/association is bound may names, reasons and quantities enter native state.
    const shipments=collections.shipments.map(row=>shipmentDisplay.parse(row));
    for(const ship of shipments){const original=parents.get(ship.id)!;for(const line of ship.lines){const before=original.lines.find(row=>row.id===line.shipmentItemId)!;if(compareReceiptCounts(line.sentQuantity,before.quantity)!==0||compareReceiptCounts(line.recordedReceivedQuantity,before.deliveredQuantity)!==0)throw new OrderDiscrepancyReadError("changed");}if(!unique(ship.documents,row=>row.id))throw Error();}
    const projections=collections.discrepancies.map((row,index)=>{
      if(!unverifiedResupply.has(claims[index]!.id))return claimDisplay.parse(row);
      // Do not even inspect display fields from an unbound replacement relation.
      const source=row as Record<string,unknown>,withoutReplacement=Object.fromEntries(Object.keys(claimDisplay.shape).map(key=>[key,key==="resupply"?null:source[key]]));
      return {...claimDisplay.parse(withoutReplacement),resupplyIssue:"unverified" as const};
    });
    const displayedClaims:NativeDiscrepancyClaim[]=projections.map((claim,index)=>{const history=decodeDiscrepancyResponseEvents((collections.discrepancies[index] as {events:unknown}).events,{version:claim.version,status:claim.status,resolution:claim.resolution,buyerOrganizationId:parent.buyerOrganizationId,supplierOrganizationId:parent.supplierOrganizationId,events:claim.events});return {...claim,events:history.events,counterProposal:history.counterProposal};});
    for(const claim of displayedClaims){
      if(claim.attachments.some(row=>!Number.isSafeInteger(row.sizeBytes)))throw Error();
      if(claim.resupply){
        if(claim.status!=="AGREED"||claim.resolution!=="RESUPPLY"||claim.statement.kind!=="SHORTAGE")throw Error();
        const ids=new Map(claim.source.lines.map(row=>[row.shipmentItemId,row.orderItemId]));
        if(!unique(claim.resupply.lines,row=>row.shipmentItemId)||claim.resupply.lines.some(row=>ids.get(row.shipmentItemId)!==row.orderItemId))throw Error();
        if(claim.resupply.shipment){const replacement=parents.get(claim.resupply.shipment.id),present=shipMap.get(claim.resupply.shipment.id);if(!replacement||!present||replacement.sourceId!==claim.shipmentId||replacement.discrepancyId!==claim.id||replacement.number!==claim.resupply.shipment.number||replacement.status!==claim.resupply.shipment.status)throw Error();}
      }
    }
    return freeze({orderId:root.orderId,orderVersion:root.orderVersion,shipments,claims:displayedClaims});
  }catch(error){if(error instanceof OrderDiscrepancyReadError)throw error;throw new OrderDiscrepancyReadError("contract");}
}
