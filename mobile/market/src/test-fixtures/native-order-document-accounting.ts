import type { DocumentArchiveItem } from "../../../../packages/schemas/src/core-api";
import type { OrderWorkflowResponse } from "../../../../packages/schemas/src/order-workflow";
import { orderArchiveDocument,orderArchiveWorkflow,orderArchiveScope } from "./native-order-document-archive";
export const accountingScope=orderArchiveScope,accountingWorkflow=orderArchiveWorkflow;
export function accountingDocument(workflow:OrderWorkflowResponse=accountingWorkflow(),overrides:Partial<DocumentArchiveItem>={}):DocumentArchiveItem{return{...orderArchiveDocument(workflow,0,"SUPPLIER"),category:"PAYMENT",kind:"INVOICE",accountingStatus:"PENDING_REVIEW",...overrides};}
export function accountingAfter(document:DocumentArchiveItem,status:Exclude<DocumentArchiveItem["accountingStatus"],"NOT_APPLICABLE">){return{...document,accountingStatus:status,updatedAt:new Date(Date.parse(document.updatedAt)+1000).toISOString()};}
