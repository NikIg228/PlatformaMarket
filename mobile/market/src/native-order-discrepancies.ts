import { captureDiscrepancyDocumentSources,type DiscrepancyDocumentSources } from "./native-order-discrepancy-document-sources";
import type { OrderWorkflowResponse } from "../../../packages/schemas/src/order-workflow";
import type { ReadScope } from "./read-controller";
import type { NativeOrderDiscrepancyReads } from "./native-order-discrepancy-reads";
import { captureDiscrepancyParent,decodeOrderDiscrepancies,discrepancyWorkflowSignature,OrderDiscrepancyReadError,type DiscrepancyParent,type NativeOrderDiscrepancySnapshot,type NativeDiscrepancyClaim,type NativeDiscrepancyShipment } from "./order-discrepancy-read";
import { MarketHttpError } from "./market-transport";
export type DiscrepancyReadIssue="scope"|"changed"|"contract"|"denied"|"unavailable"|"throttled"|"network";
export type NativeDiscrepancySelection=Readonly<{kind:"claim";row:NativeDiscrepancyClaim}|{kind:"shipment";row:NativeDiscrepancyShipment}>;
export type NativeOrderDiscrepancyState=Readonly<{phase:"idle"|"loading"}|{phase:"ready";value:NativeOrderDiscrepancySnapshot;selected?:NativeDiscrepancySelection}|{phase:"error";issue:DiscrepancyReadIssue}>;
const classify=(error:unknown):DiscrepancyReadIssue=>error instanceof OrderDiscrepancyReadError?error.code==="input"?"contract":error.code:error instanceof MarketHttpError?error.status===401?"scope":error.status===403?"denied":error.status===404?"unavailable":error.status===429?"throttled":"network":"network";
export function createNativeOrderDiscrepancies(scope:ReadScope,port:NativeOrderDiscrepancyReads|undefined,currentWorkflow:(id:string)=>OrderWorkflowResponse|null){
 const owner=Object.freeze({...scope}),listeners=new Set<()=>void>();let active=true,sequence=0,state:NativeOrderDiscrepancyState=Object.freeze({phase:"idle"}),frame:{source:OrderWorkflowResponse;parent:DiscrepancyParent;documents?:DiscrepancyDocumentSources}|undefined;
 const available=()=>{try{return active&&port?.available(owner)===true;}catch{return false;}};
 const canOpen=(source:OrderWorkflowResponse)=>available()&&currentWorkflow(source.orderId)===source&&source.orderId===source.order.id&&source.order.version===source.version&&source.order.buyerOrganizationId===owner.organizationId&&Array.isArray(source.order.shipments);
 const same=()=>!!frame&&canOpen(frame.source)&&discrepancyWorkflowSignature(frame.source)===frame.parent.signature;
 const emit=(next:NativeOrderDiscrepancyState)=>{state=Object.freeze(next);listeners.forEach(fn=>fn());};
 const hide=()=>{sequence++;frame=undefined;emit({phase:"idle"});};
 const accepts=(selected:NonNullable<typeof frame>,mine:number)=>{if(mine!==sequence||frame!==selected)return false;if(same())return true;if(available()&&currentWorkflow(selected.parent.orderId)===selected.source)emit({phase:"error",issue:"changed"});else hide();return false;};
 const read=async()=>{if(!same()||state.phase==="loading")return false;const selected=frame!,mine=++sequence;emit({phase:"loading"});try{const raw=await port!.read(owner,selected.parent.orderId);if(!accepts(selected,mine))return false;const value=decodeOrderDiscrepancies(raw,selected.parent);selected.documents=captureDiscrepancyDocumentSources(raw,value);emit({phase:"ready",value});return true;}catch(error){if(!accepts(selected,mine))return false;emit({phase:"error",issue:classify(error)});return false;}};
 return {getSnapshot:()=>state,subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},canOpen,isCurrentSnapshot(source:OrderWorkflowResponse,value:NativeOrderDiscrepancySnapshot){return frame?.source===source&&same()&&state.phase==="ready"&&state.value===value;},
  async open(source:OrderWorkflowResponse){if(!canOpen(source)||state.phase==="loading")return false;try{frame={source,parent:captureDiscrepancyParent(source,owner)};}catch{frame=undefined;emit({phase:"error",issue:"contract"});return false;}return read();},read,
  documentSourceFor(source:OrderWorkflowResponse,ship:NativeDiscrepancyShipment,doc:NativeDiscrepancyShipment["documents"][number]){if(frame?.source!==source||!same()||state.phase!=="ready"||!state.value.shipments.includes(ship)||!ship.documents.includes(doc))return undefined;return frame.documents?.get(doc);},
  selectClaim(row:NativeDiscrepancyClaim){if(!same()||state.phase!=="ready"||!state.value.claims.includes(row))return false;emit({...state,selected:Object.freeze({kind:"claim",row})});return true;},
  selectShipment(row:NativeDiscrepancyShipment){if(!same()||state.phase!=="ready"||!state.value.shipments.includes(row))return false;emit({...state,selected:Object.freeze({kind:"shipment",row})});return true;},
  backToList(){if(!same()||state.phase!=="ready")return false;emit({phase:"ready",value:state.value});return true;},
  hide,activate(){active=true;},dispose(){active=false;hide();listeners.clear();},
 };
}
export type NativeOrderDiscrepancies=ReturnType<typeof createNativeOrderDiscrepancies>;
