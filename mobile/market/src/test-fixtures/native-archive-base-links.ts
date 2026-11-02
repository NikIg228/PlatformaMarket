import { sourceDocument,baseDocument,sourceDocumentId,baseDocumentId } from "./archive-links";
import { archivePage,archiveSummary } from "./document-archive";
import { api,org,server,response } from "./market-session";
import { listDraftPayload } from "./list-draft";
export { sourceDocumentId,baseDocumentId };
function owned(value:ReturnType<typeof sourceDocument>){return {...value,ownerOrganizationId:org,participants:value.participants.map(row=>({...row,organizationId:org,organization:{...row.organization,id:org}})),supplierOrder:value.supplierOrder?{...value.supplierOrder,buyerOrganizationId:org}:null};}
export const nativeSourceDocument=()=>owned(sourceDocument());
export const nativeBaseDocument=()=>owned(baseDocument());
export function nativeArchiveBaseBackend(override?:Parameters<typeof server>[0]){return server((path,init)=>override?.(path,init)??(path.startsWith("/marketplace/search")?response(listDraftPayload("catalog-empty")):path.startsWith("/documents/archive?")?response(archivePage([nativeSourceDocument()])):path==="/documents/archive/summary"?response(archiveSummary()):path===`/documents/archive/${sourceDocumentId}`?response(nativeSourceDocument()):path===`/documents/archive/${baseDocumentId}`?response(nativeBaseDocument()):undefined));}
