import { discrepancyStatementSchema,type DiscrepancyStatement } from "../../../packages/schemas/src/order-discrepancy";
import { compareReceiptCounts } from "./shipment-receipt-draft";
/** Exact source quantity rules; source assets/receipt/document/permission checks remain on the server. */
export function checkedNativeDiscrepancyStatement(input:unknown,source:readonly Readonly<{shipmentItemId:string;sentQuantity:string}>[],attachments:readonly string[]=[],allowReceiptError=false):DiscrepancyStatement{
 const statement=discrepancyStatementSchema.parse(input),ids=new Set(source.map(line=>line.shipmentItemId));
 if(source.length===0||source.length!==ids.size||statement.lines.length!==source.length||statement.attachmentIds.length!==attachments.length||statement.attachmentIds.some((id,index)=>id!==attachments[index])||statement.kind==="RECEIPT_ERROR"&&!allowReceiptError)throw Error("Invalid statement");
 let shortage=false,damaged=false,excess=false,received=false;
 for(const line of statement.lines){const original=source.find(row=>row.shipmentItemId===line.shipmentItemId);if(!original||compareReceiptCounts(line.damagedQuantity,line.actualQuantity)===1)throw Error("Invalid statement");const comparison=compareReceiptCounts(line.actualQuantity,original.sentQuantity);if(comparison===null)throw Error("Invalid statement");shortage ||= comparison===-1;damaged ||= compareReceiptCounts(line.damagedQuantity,"0")===1;excess ||= comparison===1;received ||= compareReceiptCounts(line.actualQuantity,"0")===1;}
 if(statement.kind==="SHORTAGE"&&!shortage||statement.kind==="DAMAGED"&&!damaged||statement.kind==="EXCESS"&&!excess||statement.kind==="NOT_RECEIVED"&&received||["SHORTAGE","NOT_RECEIVED"].includes(statement.kind)&&!["RESUPPLY","REDUCTION"].includes(statement.requestedResolution))throw Error("Invalid statement");
 statement.lines.forEach(Object.freeze);Object.freeze(statement.lines);Object.freeze(statement.attachmentIds);return Object.freeze(statement);
}
