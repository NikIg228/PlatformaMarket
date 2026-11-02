import { discrepancyWorkflow,discrepancyBody,discrepancyScope as scope } from "./native-order-discrepancy";
import { receiptId as id } from "./receipt-draft";
export function nativeDiscrepancyReceipts(count=1){
 const workflow=discrepancyWorkflow(),body=discrepancyBody(),ship=workflow.order.shipments![0]!,line=ship.items[0]!;
 const quantity=(n:number)=>`${Math.floor(n/100)}.${String(n%100).padStart(2,"0")}`;
 workflow.version=workflow.order.version=2+count;ship.version=1+count;line.deliveredQuantity=quantity(count);
 workflow.events=Array.from({length:count},(_,index)=>({id:id(273000+index),action:"RECEIVE_SHIPMENT",actorId:index%2===0?id(273500):scope.userId,organizationId:scope.organizationId,createdAt:new Date(Date.UTC(2026,9,30,12,0,index+1)).toISOString(),details:{action:"RECEIVE_SHIPMENT",shipmentId:ship.id,items:[{shipmentItemId:line.id,deliveredQuantity:quantity(index+1)}]}}));
 const last=workflow.events.at(-1)?.createdAt;if(last){workflow.order.updatedAt=last;ship.updatedAt=last;}
 body.orderVersion=workflow.version;body.shipments[0]!.version=ship.version;body.shipments[0]!.lines[0]!.recordedReceivedQuantity=line.deliveredQuantity;body.discrepancies=[];
 return{workflow,body,ship,line};
}
