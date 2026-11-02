import { z } from "zod";
import { orderDiscrepanciesResponseSchema as source } from "../../../packages/schemas/src/order-discrepancy";
import type { NativeDiscrepancyShipment,NativeOrderDiscrepancySnapshot } from "./order-discrepancy-read";
export type DiscrepancyDocumentSource=Readonly<{id:string;version:number;checksum:string|null}>;
export type DiscrepancyDocumentSources=WeakMap<NativeDiscrepancyShipment["documents"][number],DiscrepancyDocumentSource>;
const ids=z.object({shipments:z.array(z.object({id:z.uuid(),version:z.number().int().positive(),documents:z.array(z.object({id:z.uuid(),version:z.number().int().positive()}))}))});
const metadata=source.shape.shipments.element.shape.documents.element.pick({id:true,version:true,checksum:true}).strip();
/** Called only after the public decoder has bound root/order/shipment/line/document identities.
 * Private request fingerprints never enter read snapshots or represent original file integrity. */
export function captureDiscrepancyDocumentSources(raw:unknown,snapshot:NativeOrderDiscrepancySnapshot):DiscrepancyDocumentSources{
 const result:DiscrepancyDocumentSources=new WeakMap();
 try{const root=source.pick({orderId:true,orderVersion:true,party:true}).strip().parse(raw);if(root.orderId!==snapshot.orderId||root.orderVersion!==snapshot.orderVersion||root.party!=="BUYER")return result;const rows=ids.parse(raw).shipments;
  if(rows.length!==snapshot.shipments.length||new Set(rows.map(row=>row.id)).size!==rows.length)return result;
  for(const ship of rows){const own=snapshot.shipments.find(row=>row.id===ship.id);if(!own||own.version!==ship.version||own.documents.length!==ship.documents.length||new Set(ship.documents.map(doc=>doc.id)).size!==ship.documents.length||ship.documents.some(doc=>!own.documents.some(row=>row.id===doc.id&&row.version===doc.version)))return result;}
  const documentIds=rows.flatMap(ship=>ship.documents.map(doc=>doc.id));if(new Set(documentIds).size!==documentIds.length)return result;
  const rawShips=(raw as {shipments:unknown[]}).shipments;
  rows.forEach((ship,index)=>{const own=snapshot.shipments.find(row=>row.id===ship.id)!;const documents=(rawShips[index] as {documents:unknown[]}).documents;ship.documents.forEach((doc,docIndex)=>{try{const value=metadata.parse(documents[docIndex]);if(value.id!==doc.id||value.version!==doc.version)return;const row=own.documents.find(candidate=>candidate.id===doc.id)!;result.set(row,Object.freeze(value));}catch{/* Keep document title/version readable; the optional request link is unavailable. */}});});
 }catch{/* A missing optional request fingerprint never hides otherwise valid read metadata. */}
 return result;
}
