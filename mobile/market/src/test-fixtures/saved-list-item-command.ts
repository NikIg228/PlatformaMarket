import { decodeSavedListsFixture, savedListItemFixtureSchema } from "../saved-lists-fixture-read";
import type { SavedListItemCommandFixture, SavedListItemInput } from "../saved-list-item-command";
import { savedListFixture, savedListId } from "./saved-lists";
import { listDraftComparison, listDraftScope } from "./list-draft";
export { listDraftScope as savedListWriteScope } from "./list-draft";
export { savedListId as savedListWriteId } from "./saved-lists";
export function savedListWriteAuthorization():SavedListItemCommandFixture["authorization"] {return {provenance:"synthetic-source-contract",scope:{...listDraftScope},side:"BUYER",operator:false,permissions:["order.create","catalog.product.view"]};}
export function savedListWritePage(empty=false){const raw=savedListFixture({createdById:savedListId(29)});raw.items=empty?[]:[{...raw.items[0]!,offerId:listDraftComparison().offers[0]!.offerId,quantity:"2.000000",note:"SYNTHETIC previous colleague note"}];return decodeSavedListsFixture([raw],listDraftScope)!;}
export function savedListWriteResult(listId:string,input:Readonly<SavedListItemInput>,itemId=savedListId(802)){return savedListItemFixtureSchema.parse({id:itemId,listId,offerId:input.offerId,quantity:String(input.quantity),note:input.note,createdAt:"2026-10-30T06:07:08.000Z",updatedAt:"2026-10-30T06:07:08.000Z"});}
