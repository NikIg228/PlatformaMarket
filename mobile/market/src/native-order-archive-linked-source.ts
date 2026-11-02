import type { OrderWorkflowResponse } from "../../../packages/schemas/src/order-workflow";
/** Issued local selection only; a copy/URI/DTO is never a server grant or signing token. */
export type OrderArchiveLinkedTarget=Readonly<{orderId:string;documentId:string;documentVersion:number;selection:number}>;
export type OrderArchiveLinkedBinding=Readonly<{workflow:OrderWorkflowResponse;documentId:string;documentVersion:number}>;
export type OrderArchiveLinkedSource=Readonly<{resolve:(target:OrderArchiveLinkedTarget)=>OrderArchiveLinkedBinding|null;verifyBody:(target:OrderArchiveLinkedTarget,body:unknown)=>boolean}>;
