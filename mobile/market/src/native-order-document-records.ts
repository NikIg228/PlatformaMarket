import { documentArchiveSignatureSchema } from "../../../packages/schemas/src/core-api";
import { decodeArchiveParticipantMetadata,type ArchiveParticipantMetadata } from "./archive-participant-metadata";
import { decodeArchiveSignatureMetadata,type ArchiveSignatureMetadata } from "./archive-signature-metadata";
import { bindOrderDocumentMetadataParent } from "./native-order-document-versions";
import type { OrderArchiveDocument } from "./native-order-document-archive";
export type OrderDocumentRecordsKind="participants"|"signatures";
export type OrderDocumentParticipant=Readonly<{party:"SELF"|"COUNTERPARTY"|"OTHER";role:ArchiveParticipantMetadata["role"];displayName:string}>;
export type OrderDocumentSignature=Readonly<Pick<ArchiveSignatureMetadata,"id"|"method"|"status"|"signedAt">>;
export type OrderDocumentRecords=Readonly<{kind:"participants";rows:readonly OrderDocumentParticipant[]}|{kind:"signatures";rows:readonly OrderDocumentSignature[]}>;
export const orderDocumentRecordsPageSize=20;
/** Explicit child projection after current own-order/private-owner binding by caller. No side grant follows from a role. */
export function decodeOrderDocumentRecords(body:unknown,parent:OrderArchiveDocument,buyerId:string,supplierId:string,kind:OrderDocumentRecordsKind):Readonly<{ok:true;value:OrderDocumentRecords}|{ok:false;issue:"contract"|"changed"}>{try{
 const bound=bindOrderDocumentMetadataParent(body,parent);if(!bound.ok)return bound;
 if(kind==="participants"){const rows=decodeArchiveParticipantMetadata(body);return rows?{ok:true,value:Object.freeze({kind,rows:Object.freeze(rows.map(row=>Object.freeze({party:row.organizationId===buyerId?"SELF" as const:row.organizationId===supplierId?"COUNTERPARTY" as const:"OTHER" as const,role:row.role,displayName:row.displayName})))})}:{ok:false,issue:"contract"};}
 if(kind==="signatures"){const raw=(body as Record<string,unknown>).signatures,ids=documentArchiveSignatureSchema.pick({id:true}).strip().array().safeParse(raw);if(!ids.success||new Set(ids.data.map(row=>row.id)).size!==ids.data.length)return{ok:false,issue:"contract"};const rows=decodeArchiveSignatureMetadata({signatures:raw});return rows?{ok:true,value:Object.freeze({kind,rows:Object.freeze(rows.map(row=>Object.freeze({id:row.id,method:row.method,status:row.status,signedAt:row.signedAt})))})}:{ok:false,issue:"contract"};}
 return{ok:false,issue:"contract"};
}catch{return{ok:false,issue:"contract"};}}
