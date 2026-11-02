import { savedListHeaderFixtureSchema } from "../saved-lists-fixture-read";
import type { SavedListCreateFixture, SavedListCreateInput } from "../saved-list-create-command";
import { savedListWriteScope, savedListWriteId, savedListWriteAuthorization, savedListWritePage } from "./saved-list-item-command";
export { savedListWriteScope as savedListCreateScope, savedListWriteId as savedListCreateId, savedListWritePage as savedListCreatePage } from "./saved-list-item-command";
export function savedListCreateAuthorization():SavedListCreateFixture["authorization"]{return savedListWriteAuthorization();}
export function savedListCreateResult(input:Readonly<SavedListCreateInput>,id=savedListWriteId(15001)){return savedListHeaderFixtureSchema.parse({id,organizationId:savedListWriteScope.organizationId,createdById:savedListWriteScope.userId,name:input.name,isDefault:input.isDefault,createdAt:"2026-10-30T07:08:09.000Z",updatedAt:"2026-10-30T07:08:09.000Z"});}
export function createdSavedListPage(input:Readonly<SavedListCreateInput>,page=savedListWritePage(),id=savedListWriteId(15001)){return [...page.map(list=>input.isDefault?{...list,isDefault:false}:list),{...savedListCreateResult(input,id),items:[]}];}
