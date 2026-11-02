import { documentArchiveQuerySchema,type DocumentArchiveQuery } from "../../../packages/schemas/src/core-api";
import { parseArchiveFilterDraft,type ArchiveFilterFields } from "./archive-filter-draft";
import type { OrderArchiveDocument } from "./native-order-document-archive";
export const orderArchiveWireFilterKeys=["q","view","category","kind","status","accountingStatus","dateFrom","dateTo"] as const;
export const orderArchiveParticipantChoices=["BUYER","SUPPLIER"] as const;
export type OrderArchiveParticipant=typeof orderArchiveParticipantChoices[number];
export const orderArchiveFilterKeys=[...orderArchiveWireFilterKeys,"participant"] as const;
export type OrderArchiveFilters=Readonly<Pick<DocumentArchiveQuery,typeof orderArchiveWireFilterKeys[number]> & {participant?:OrderArchiveParticipant}>;
export type OrderArchiveFilterDraft=Readonly<ArchiveFilterFields & {qText?:string;participant?:OrderArchiveParticipant}>;
export type OrderArchiveFilterState=Readonly<{draft:OrderArchiveFilterDraft;applied:OrderArchiveFilters;valid:boolean;dirty:boolean;token:object}>;
const draftKeys=["qText","view","category","kind","status","accountingStatus","dateFromText","dateToText","participant"] as const;
export const emptyOrderArchiveFilters:OrderArchiveFilters=Object.freeze({});
/** Participant is a local side choice. UUID/query scope and pagination remain uneditable. */
export function parseOrderArchiveFilters(input:unknown):OrderArchiveFilters|null{try{
 if(typeof input!=="object"||input===null||Array.isArray(input)||Object.keys(input).some(key=>!orderArchiveFilterKeys.some(allowed=>allowed===key)))return null;
 const raw=input as Record<string,unknown>,participant=raw.participant;
 if(participant!==undefined&&!orderArchiveParticipantChoices.includes(participant as OrderArchiveParticipant))return null;
 const wire=Object.fromEntries(orderArchiveWireFilterKeys.flatMap(key=>raw[key]===undefined?[]:[[key,raw[key]]])),p=documentArchiveQuerySchema.safeParse(wire);if(!p.success)return null;
 return Object.freeze({...Object.fromEntries(orderArchiveWireFilterKeys.flatMap(key=>p.data[key]===undefined||key==="q"&&p.data.q===""?[]:[[key,p.data[key]]])),...(participant===undefined?{}:{participant:participant as OrderArchiveParticipant})});
}catch{return null;}}
export function captureOrderArchiveFilterDraft(input:unknown):OrderArchiveFilterDraft|null{try{
 if(typeof input!=="object"||input===null||Array.isArray(input)||Object.keys(input).some(key=>!draftKeys.some(allowed=>allowed===key)))return null;
 const body=input as Record<string,unknown>;
 if(draftKeys.some(key=>body[key]!==undefined&&typeof body[key]!=="string"))return null;
 return Object.freeze(Object.fromEntries(draftKeys.flatMap(key=>body[key]===undefined?[]:[[key,body[key]]]))) as OrderArchiveFilterDraft;
}catch{return null;}}
export function parseOrderArchiveFilterDraft(draft:OrderArchiveFilterDraft):OrderArchiveFilters|null{try{
 const captured=captureOrderArchiveFilterDraft(draft);if(!captured)return null;
 const choices=parseArchiveFilterDraft(captured);if(!choices)return null;
 const {limit:_limit,...filters}=choices;
 return parseOrderArchiveFilters({...filters,...(captured.qText===undefined?{}:{q:captured.qText}),...(captured.participant===undefined?{}:{participant:captured.participant})});
}catch{return null;}}
export function sameOrderArchiveFilters(a:OrderArchiveFilters,b:OrderArchiveFilters){return orderArchiveFilterKeys.every(key=>a[key]===b[key]);}
export function orderArchiveFilterState(draft:OrderArchiveFilterDraft={},applied:OrderArchiveFilters=emptyOrderArchiveFilters,token:object=Object.freeze({})):OrderArchiveFilterState{const next=parseOrderArchiveFilterDraft(draft);return Object.freeze({draft,applied,valid:next!==null,dirty:next===null||!sameOrderArchiveFilters(next,applied),token});}
export type OrderArchiveFilterIssues=Readonly<{qText:boolean;dateFromText:boolean;dateToText:boolean;range:boolean}>;
/** Field feedback uses the same source schema and UTC parser as apply; never rewrites input. */
export function orderArchiveFilterIssues(draft:OrderArchiveFilterDraft):OrderArchiveFilterIssues{
 const qText=!documentArchiveQuerySchema.safeParse(draft.qText===undefined?{}:{q:draft.qText}).success;
 const dateFromText=parseArchiveFilterDraft({dateFromText:draft.dateFromText})===null,dateToText=parseArchiveFilterDraft({dateToText:draft.dateToText})===null;
 const range=!dateFromText&&!dateToText&&parseArchiveFilterDraft({dateFromText:draft.dateFromText,dateToText:draft.dateToText})===null;
 return Object.freeze({qText,dateFromText,dateToText,range});
}
/** q also searches counterparties. Participant membership is checked separately after all own-order headers. */
export function orderArchiveHeadersMatchFilters(row:Pick<OrderArchiveDocument,"category"|"kind"|"status"|"accountingStatus">,query:OrderArchiveFilters){
 if((query.category!==undefined&&row.category!==query.category)||(query.kind!==undefined&&row.kind!==query.kind)||(query.status!==undefined&&row.status!==query.status)||(query.accountingStatus!==undefined&&row.accountingStatus!==query.accountingStatus))return false;
 if(query.view===undefined)return true;
 if(query.view==="AWAITING_SIGNATURE")return ["AWAITING_SIGNATURE","PARTIALLY_SIGNED"].includes(row.status);
 if(query.view==="ARCHIVED")return row.status==="ARCHIVED";
 return ["FAILED","REJECTED","EXPIRED"].includes(row.status)||["PENDING_REVIEW","DISPUTED"].includes(row.accountingStatus);
}
