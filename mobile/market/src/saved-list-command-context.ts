import type { FixtureSavedList } from "./saved-lists-fixture-read";
import type { ReadScope } from "./read-controller";
export type SavedListMutationAuthorization=Readonly<{provenance:"synthetic-source-contract";scope:ReadScope;side:"BUYER";operator:false;permissions:readonly string[]}>;
const same=(a:ReadScope,b:ReadScope)=>a.product==="market"&&a.product===b.product&&a.environment===b.environment&&a.organizationId===b.organizationId&&a.userId===b.userId&&a.generation===b.generation;
export function authorizedSavedListMutation(scope:ReadScope,auth?:SavedListMutationAuthorization){return !!auth&&auth.provenance==="synthetic-source-contract"&&auth.side==="BUYER"&&auth.operator===false&&!!auth.scope&&same(scope,auth.scope)&&Array.isArray(auth.permissions)&&auth.permissions.includes("order.create")&&auth.permissions.includes("catalog.product.view");}
/** Shares only a scoped denial. Metadata reads do not add or restore grants. */
export function createSavedListCommandContext(scope:ReadScope){const owner=Object.freeze({...scope}),listeners=new Set<()=>void>();let active=true,issue:"authentication"|"denied"|null=null;return {matches:(other:ReadScope)=>same(owner,other),isActive:()=>active,authorityIssue:()=>issue,deny(value:"authentication"|"denied"){issue=value;listeners.forEach(listener=>listener());},subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},activate(){active=true;},close(){active=false;issue=null;listeners.clear();}};}
export type SavedListCommandContext=ReturnType<typeof createSavedListCommandContext>;

export function ownedSavedListsPage(owner:ReadScope,page:readonly FixtureSavedList[],current:readonly FixtureSavedList[]|null){
 if(page!==current||page.some(list=>list.organizationId!==owner.organizationId)||new Set(page.map(list=>list.id)).size!==page.length)return false;
 const ids=new Set<string>();for(const list of page){const offers=new Set<string>();for(const row of list.items){if(row.listId!==list.id||ids.has(row.id)||offers.has(row.offerId))return false;ids.add(row.id);offers.add(row.offerId);}}return true;
}
