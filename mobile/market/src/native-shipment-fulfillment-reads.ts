import { z } from "zod";
import { shipmentResponseSchema,fulfillmentStepResponseSchema as stepSchema } from "../../../packages/schemas/src/core-api";
import { orderWorkflowResponseSchema,type OrderWorkflowResponse } from "../../../packages/schemas/src/order-workflow";
import type { ShipmentResponse } from "../../../packages/schemas/src/core-api";
import type { ReadScope } from "./read-controller";
export class ShipmentFulfillmentReadError extends Error {constructor(readonly code:"scope"|"contract"){super("Shipment metadata is unavailable");this.name="ShipmentFulfillmentReadError";}}
const stepIdentity=stepSchema.pick({id:true,shipmentId:true,sequence:true}).strip();
const shipmentIdentity=shipmentResponseSchema.pick({id:true,supplierOrderId:true,version:true,status:true}).strip();
const root=orderWorkflowResponseSchema.pick({orderId:true,version:true}).strip().extend({order:orderWorkflowResponseSchema.shape.order.pick({id:true,buyerOrganizationId:true,version:true}).strip()});
const publicStep=stepSchema.pick({id:true,shipmentId:true,type:true,status:true,sequence:true,scheduledAt:true,startedAt:true,completedAt:true}).strip();
const types=["PICKUP","DELIVERY","INSTALLATION","TRAINING","SERVICE"] as const,statuses=["PENDING","SCHEDULED","IN_PROGRESS","COMPLETED","FAILED","CANCELLED"] as const;
export type NativeFulfillmentStep=Readonly<Omit<z.output<typeof publicStep>,"type"|"status">&{type:typeof types[number]|"UNKNOWN";status:typeof statuses[number]|"UNKNOWN";notes:string|null;notesIssue?:"unavailable"}>;
export type NativeShipmentFailure=Readonly<{kind:"not-current-failure"}|{kind:"known";reason:string|null}|{kind:"unavailable"}>;
export type NativeShipmentFulfillmentSnapshot=Readonly<{orderId:string;orderVersion:number;orderNumber:string;shipmentId:string;shipmentVersion:number;shipmentNumber:string;shipmentStatus:ShipmentResponse["status"];steps:readonly NativeFulfillmentStep[];failure:NativeShipmentFailure}>;
/** Only existing own workflow/shipment metadata. POD, provider IDs, raw metadata and file bodies are excluded. */
export function decodeShipmentFulfillment(workflow:OrderWorkflowResponse,shipment:ShipmentResponse,scope:ReadScope):NativeShipmentFulfillmentSnapshot{
 try{const own=root.parse(workflow);if(own.orderId!==own.order.id||own.version!==own.order.version||own.order.buyerOrganizationId!==scope.organizationId)throw new ShipmentFulfillmentReadError("scope");const originals=workflow.order.shipments;if(!Array.isArray(originals)||!originals.includes(shipment))throw new ShipmentFulfillmentReadError("scope");const ships=originals.map(row=>shipmentIdentity.parse(row)),shipIds=new Set<string>(),stepIds=new Set<string>();
  for(const ship of ships){if(shipIds.has(ship.id)||ship.supplierOrderId!==own.orderId)throw Error();shipIds.add(ship.id);}
  const rawSteps=originals.map(ship=>z.array(z.unknown()).parse(ship.fulfillmentSteps)),stepGroups=rawSteps.map(rows=>rows.map(row=>stepIdentity.parse(row)));
  stepGroups.forEach((rows,index)=>{const sequence=new Set<number>();for(const step of rows){if(stepIds.has(step.id)||step.shipmentId!==ships[index]!.id||sequence.has(step.sequence))throw Error();stepIds.add(step.id);sequence.add(step.sequence);}});
  const selected=ships[originals.indexOf(shipment)]!;
  const steps=rawSteps[originals.indexOf(shipment)]!.map(raw=>{const value=publicStep.parse(raw);let notes:string|null=null,notesIssue:"unavailable"|undefined;try{notes=z.object({notes:stepSchema.shape.notes.unwrap().max(1000).nullable()}).parse(raw).notes;}catch{notesIssue="unavailable";}return Object.freeze({...value,type:types.includes(value.type as typeof types[number])?value.type as typeof types[number]:"UNKNOWN",status:statuses.includes(value.status as typeof statuses[number])?value.status as typeof statuses[number]:"UNKNOWN",notes,...(notesIssue?{notesIssue}:{})});}).sort((a,b)=>a.sequence-b.sequence);
  let failure:NativeShipmentFailure=Object.freeze({kind:"not-current-failure"});if(selected.status==="FAILED")try{failure=Object.freeze({kind:"known",reason:z.object({failureReason:z.string().max(1000).nullable()}).parse(shipment).failureReason});}catch{failure=Object.freeze({kind:"unavailable"});}
  return Object.freeze({orderId:own.orderId,orderVersion:own.version,orderNumber:orderWorkflowResponseSchema.shape.order.shape.orderNumber.parse(workflow.order.orderNumber),shipmentId:selected.id,shipmentVersion:selected.version,shipmentNumber:shipmentResponseSchema.shape.shipmentNumber.parse(shipment.shipmentNumber),shipmentStatus:selected.status,steps:Object.freeze(steps),failure});
 }catch(error){if(error instanceof ShipmentFulfillmentReadError)throw error;throw new ShipmentFulfillmentReadError("contract");}
}
export type NativeShipmentFulfillmentState=Readonly<{phase:"idle"}|{phase:"ready";value:NativeShipmentFulfillmentSnapshot}|{phase:"error"}|{phase:"changed"}>;
const changed:NativeShipmentFulfillmentState=Object.freeze({phase:"changed"});
export function createNativeShipmentFulfillmentReads(scope:ReadScope,current:(id:string)=>OrderWorkflowResponse|null){
 const owner=Object.freeze({...scope}),listeners=new Set<()=>void>();let active=true,state:NativeShipmentFulfillmentState=Object.freeze({phase:"idle"}),frame:{source:OrderWorkflowResponse;shipment:ShipmentResponse;signature?:string}|undefined;
 const canOpen=(workflow:OrderWorkflowResponse,shipment:ShipmentResponse)=>{try{return active&&workflow.order.buyerOrganizationId===owner.organizationId&&current(workflow.orderId)===workflow&&workflow.orderId===workflow.order.id&&workflow.version===workflow.order.version&&shipment.supplierOrderId===workflow.orderId&&Array.isArray(workflow.order.shipments)&&workflow.order.shipments.includes(shipment);}catch{return false;}};
 const emit=(next:NativeShipmentFulfillmentState)=>{state=Object.freeze(next);listeners.forEach(fn=>fn());},hide=()=>{frame=undefined;emit({phase:"idle"});};
 return{getSnapshot:()=>state,subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},canOpen,
  open(workflow:OrderWorkflowResponse,shipment:ShipmentResponse){if(!canOpen(workflow,shipment))return false;frame={source:workflow,shipment};try{const value=decodeShipmentFulfillment(workflow,shipment,owner);frame.signature=JSON.stringify(value);emit({phase:"ready",value});}catch{emit({phase:"error"});}return true;},
  viewFor(workflow:OrderWorkflowResponse,shipment:ShipmentResponse){if(frame?.source!==workflow||frame.shipment!==shipment)return undefined;if(!canOpen(workflow,shipment))return changed;if(state.phase!=="ready")return state;try{return JSON.stringify(decodeShipmentFulfillment(workflow,shipment,owner))===frame.signature?state:changed;}catch{return changed;}},
  hide,hideFor(workflow:OrderWorkflowResponse,shipment:ShipmentResponse){if(frame?.source!==workflow||frame.shipment!==shipment)return false;hide();return true;},activate(){active=true;},dispose(){active=false;hide();listeners.clear();},
 };
}
export type NativeShipmentFulfillmentReads=ReturnType<typeof createNativeShipmentFulfillmentReads>;
