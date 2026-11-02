import { discrepancyWorkflow,discrepancyBody,discrepancyScope as scope } from "./native-order-discrepancy";
import { receiptId as id } from "./receipt-draft";
export function nativeDiscrepancyLines(count=21,draft=false){
 const workflow=discrepancyWorkflow(),body=discrepancyBody(),ship=workflow.order.shipments![0]!,orderItem=workflow.order.items[0]!,item=ship.items[0]!,sourceLine=body.shipments[0]!.lines[0]!;
 workflow.order.items=Array.from({length:count},(_,index)=>({...orderItem,id:id(274000+index)}));
 ship.items=Array.from({length:count},(_,index)=>({...item,id:id(275000+index),supplierOrderItemId:workflow.order.items[index]!.id}));
 workflow.order.subtotalAmountMinor=(BigInt(workflow.order.subtotalAmountMinor)*BigInt(count)).toString();
 const date="2026-10-30T12:00:01.000Z";workflow.order.updatedAt=ship.updatedAt=date;
 workflow.events=[{id:id(276000),action:"RECEIVE_SHIPMENT",actorId:scope.userId,organizationId:scope.organizationId,createdAt:date,details:{action:"RECEIVE_SHIPMENT",shipmentId:ship.id,items:ship.items.map(line=>({shipmentItemId:line.id,deliveredQuantity:line.deliveredQuantity}))}}];
 body.shipments[0]!.lines=ship.items.map((line,index)=>({...sourceLine,shipmentItemId:line.id,orderItemId:line.supplierOrderItemId,name:`SYNTHETIC discrepancy row ${index+1}`,sentQuantity:line.quantity,recordedReceivedQuantity:line.deliveredQuantity}));
 if(draft){const claim=body.discrepancies[0]!,created="2026-10-30T12:00:02.000Z";claim.status="DRAFT";claim.version=1;claim.createdAt=claim.updatedAt=created;claim.events=claim.events.slice(0,1).map(event=>({...event,createdAt:created}));claim.source.lines=body.shipments[0]!.lines.map(line=>({...line}));claim.statement.lines=ship.items.map(line=>({shipmentItemId:line.id,actualQuantity:line.deliveredQuantity,damagedQuantity:"0"}));}else body.discrepancies=[];
 return{workflow,body,ship};
}
