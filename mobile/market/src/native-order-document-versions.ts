import type { z } from "zod";
import { documentArchiveItemSchema,documentArchiveVersionSchema } from "../../../packages/schemas/src/core-api";
import type { OrderArchiveDocument } from "./native-order-document-archive";
export const orderDocumentVersionsPageSize=20;
export type OrderDocumentVersion=Readonly<{id:string;version:number;status:OrderArchiveDocument["status"]|null;documentDate:string;createdAt:string}>;
const source=documentArchiveItemSchema.pick({id:true,version:true,status:true,documentNumber:true,documentDate:true,createdAt:true,updatedAt:true}).strip();
const headers=documentArchiveVersionSchema.pick({id:true,version:true}).strip().array();
export function canBindOrderDocumentVersions(parent:OrderArchiveDocument){return parent.dates.documentDate.kind==="value"&&parent.dates.createdAt.kind==="value"&&parent.dates.updatedAt.kind==="value";}
/** A fresh child read remains attached to the original public document snapshot. */
export function bindOrderDocumentMetadataParent(body:unknown,parent:OrderArchiveDocument):Readonly<{ok:true;source:z.output<typeof source>}|{ok:false;issue:"contract"|"changed"}>{try{
 const p=source.safeParse(body);if(!p.success||!canBindOrderDocumentVersions(parent))return{ok:false,issue:"contract"};
 if(p.data.id!==parent.id||p.data.version!==parent.version||p.data.status!==parent.status||p.data.documentNumber!==parent.documentNumber||parent.dates.documentDate.kind!=="value"||p.data.documentDate!==parent.dates.documentDate.value||parent.dates.createdAt.kind!=="value"||p.data.createdAt!==parent.dates.createdAt.value||parent.dates.updatedAt.kind!=="value"||p.data.updatedAt!==parent.dates.updatedAt.value)return{ok:false,issue:"changed"};
 return{ok:true,source:p.data};
}catch{return{ok:false,issue:"contract"};}}
/** Actual GET must also bind private owner + own-order headers in the model. */
export function decodeOrderDocumentVersions(body:unknown,parent:OrderArchiveDocument):Readonly<{ok:true;rows:readonly OrderDocumentVersion[]}|{ok:false;issue:"contract"|"changed"}>{try{
 const bound=bindOrderDocumentMetadataParent(body,parent);if(!bound.ok)return bound;const p=bound.source;
 const raw=(body as Record<string,unknown>).versions,h=headers.safeParse(raw);if(!h.success||new Set(h.data.map(row=>row.id)).size!==h.data.length)return{ok:false,issue:"contract"};
 if(h.data.some(row=>row.id===parent.id&&row.version!==parent.version))return{ok:false,issue:"changed"};
 const parsed=documentArchiveVersionSchema.array().safeParse(raw);if(!parsed.success)return{ok:false,issue:"contract"};
 const current=parsed.data.find(row=>row.id===parent.id);if(current&&(current.status!==parent.status||current.documentDate!==p.documentDate||current.createdAt!==p.createdAt))return{ok:false,issue:"changed"};
 return{ok:true,rows:Object.freeze(parsed.data.map(row=>{const status=documentArchiveItemSchema.shape.status.safeParse(row.status);return Object.freeze({id:row.id,version:row.version,status:status.success?status.data:null,documentDate:row.documentDate,createdAt:row.createdAt});}))};
}catch{return{ok:false,issue:"contract"};}}

const selectedVersionFields=documentArchiveItemSchema.pick({documentNumber:true,documentDate:true,createdAt:true}).strip();
/** Version GET headers bind ID/version/status/private owner/order first. Source history supplies no kind/format constraint. */
export function bindOrderDocumentVersionSelection(body:unknown,parent:OrderArchiveDocument,row:OrderDocumentVersion):"contract"|"changed"|null{try{const p=selectedVersionFields.safeParse(body);if(!p.success)return"contract";return p.data.documentNumber!==parent.documentNumber||p.data.documentDate!==row.documentDate||p.data.createdAt!==row.createdAt?"changed":null;}catch{return"contract";}}
