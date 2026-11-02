import type { FetchTransport } from "../market-transport";
import { createSyntheticBuyerJourney } from "./buyer-journey";
import { supportId } from "./support";
import { listDraftPayload } from "./list-draft";
import { cartCommandError } from "./cart-commands";
export type NativeJourneyTrace=Readonly<{path:string;method:string;authorization:"absent"|"current"|"stale";organizationHeader:string|null;developerIdentity:boolean;csrfMatches:boolean;credentials:RequestCredentials|undefined;cache:RequestCache|undefined;redirect:RequestRedirect|undefined;bodyKeys:readonly string[];sessionIdMatches:boolean}>;
const response=(payload:unknown,status=200)=>({status,ok:status>=200&&status<300,text:async()=>JSON.stringify(payload)});
/** In-memory HTTP adapter only. Never delegates to global/expo fetch and never records credential values. */
export function createSyntheticBuyerHttp(source=createSyntheticBuyerJourney()){
 const api="https://market.example.invalid/api",scope=source.scope,sessionId=supportId(26000),csrf="SYNTHETIC-private-csrf-only";
 const trace:NativeJourneyTrace[]=[],failures=new Map<string,{status:number;remaining:number}>();let epoch=1,active=true,clock=Date.now();
 const access=()=>`SYNTHETIC-private-access-${epoch}`,workspace=()=>({organizationId:scope.organizationId,organizationDisplayName:"SYNTHETIC native buyer organization",capabilities:["BUYER"]});
 const current=()=>({user:{id:scope.userId,email:"synthetic@example.invalid",displayName:"SYNTHETIC native buyer"},accessToken:access(),accessTokenExpiresIn:300,sessionId,activeOrganizationId:scope.organizationId,organizationIds:[scope.organizationId],csrfToken:csrf,refreshTokenExpiresAt:"2099-01-01T00:00:00.000Z",workspaces:[workspace()]});
 const fetcher:FetchTransport=async(url,init)=>{
  if(!url.startsWith(`${api}/`))throw new Error("SYNTHETIC adapter accepts only its fixed invalid origin");
  const target=new URL(url),path=target.pathname.slice(new URL(api).pathname.length),fullPath=`${path}${target.search}`,headers=init.headers as Record<string,string>,method=init.method??"GET";
  let body:Record<string,unknown>={};if(typeof init.body==="string")body=JSON.parse(init.body) as Record<string,unknown>;
  const authorization=!headers.authorization?"absent":headers.authorization===`Bearer ${access()}`?"current":"stale";
  trace.push(Object.freeze({path:fullPath,method,authorization,organizationHeader:headers["x-organization-id"]??null,developerIdentity:!!headers["x-user-id"],csrfMatches:headers["x-csrf-token"]===csrf,credentials:init.credentials,cache:init.cache,redirect:init.redirect,bodyKeys:Object.freeze(Object.keys(body).sort()),sessionIdMatches:body.sessionId===sessionId||body.expectedSessionId===sessionId}));
  if(path==="/auth/current"&&method==="GET")return response(active?current():null);
  if(path==="/auth/workspace-context"&&method==="GET"){if(!active||authorization!=="current")return response(cartCommandError(401).payload,401);if(headers["x-organization-id"]!==scope.organizationId)return response(cartCommandError(403).payload,403);return response(workspace());}
  if(path==="/auth/refresh"&&method==="POST"){
   if(!active||body.expectedSessionId!==sessionId||body.workspace!=="BUYER"||headers["x-csrf-token"]!==csrf||init.credentials!=="include")return response(cartCommandError(401).payload,401);
   epoch++;const {user:_user,workspaces:_workspaces,...value}=current();return response(value,201);
  }
  if(path==="/auth/session-logout"&&method==="POST"){
   if(!active||body.sessionId!==sessionId||body.accessToken!==access())return response(cartCommandError(401).payload,401);active=false;return response({sessionId,status:"REVOKED",loginStatus:"REVOKED"},201);
  }
  if(method!=="GET")return response(cartCommandError(405).payload,405);
  if(!active||authorization!=="current")return response(cartCommandError(401).payload,401);
  const failed=failures.get(path);if(failed&&failed.remaining>0){failed.remaining--;return response(cartCommandError(failed.status).payload,failed.status);}
  try{
   if(path==="/marketplace/search")return response(listDraftPayload("catalog-empty"));
   if(path==="/workspaces/buyer/carts")return response(await source.client.workspaceCarts!({}));
   if(path==="/workspaces/buyer/orders")return response(await source.client.workspaceOrders!("buyer",{}));
   if(path==="/support/tickets")return response(await source.client.supportTickets!());
   const checkout=/^\/checkouts\/([^/]+)$/.exec(path);if(checkout)return response(await source.client.getCheckout!(decodeURIComponent(checkout[1]!)));
   const cart=/^\/workspaces\/buyer\/carts\/([^/]+)$/.exec(path);if(cart)return response(await source.client.workspaceCart!(decodeURIComponent(cart[1]!)));
   const order=/^\/supplier-orders\/([^/]+)\/workflow$/.exec(path);if(order)return response(await source.client.getOrderWorkflow(decodeURIComponent(order[1]!)));
   const ticket=/^\/support\/tickets\/([^/]+)$/.exec(path);if(ticket)return response(await source.client.supportTicket!(decodeURIComponent(ticket[1]!),target.searchParams.get("beforeMessageId")??undefined));
   return response(cartCommandError(404).payload,404);
  }catch(error){if(typeof error==="object"&&error!==null&&"status"in error&&"payload"in error&&typeof error.status==="number")return response(error.payload,error.status);throw error;}
 };
 return {api,fetcher,source,trace,now:()=>clock,advance:(milliseconds:number)=>{clock+=milliseconds;},failNext(path:string,status:number,count=1){failures.set(path,{status,remaining:count});}};
}
