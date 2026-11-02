import { z } from "zod";
import { errorResponseSchema, orderDocumentResponseSchema, supplierOrderResponseSchema } from "../../../packages/schemas/src/core-api";
import { orderWorkflowResponseSchema } from "../../../packages/schemas/src/order-workflow";
import { updateOrderCommentSchema } from "../../../packages/schemas/src/trust-commerce";
import type { ReadScope } from "../../../contracts/mobile-read/read-adapter";

// Private fixture projection of actual OrderPrivateComment GET/Prisma fields.
// Not a new backend DTO, accepted CURRENT schema, or authorization grant.
const uuid = supplierOrderResponseSchema.shape.id;
const workflowIdentity = orderWorkflowResponseSchema.pick({ orderId: true, version: true }).strip().extend({ order: supplierOrderResponseSchema.pick({ id: true, buyerOrganizationId: true, supplierOrganizationId: true, version: true }).strip() });
const identity = z.object({ id: uuid, supplierOrderId: uuid, authorOrganizationId: uuid, visibility: z.literal("PARTIES_AND_OPERATOR"), version: updateOrderCommentSchema.shape.version });
const identities = z.array(identity);
const content = z.object({ id: uuid, version: updateOrderCommentSchema.shape.version, body: z.string(), createdAt: orderDocumentResponseSchema.shape.createdAt, editedAt: orderDocumentResponseSchema.shape.createdAt.nullable() });
type Context = Readonly<{ orderId: string; orderVersion: number; orderNumber: string; buyerOrganizationId: string; supplierOrganizationId: string }>;
export type OrderCommentSelection = Readonly<{ orderId: string; orderVersion: number; selection: number }>;
export type OrderComment = z.output<typeof content> & { party: "buyer" | "supplier" | "other" };
export type OrderCommentsWindow = { context: Context; comments: OrderComment[] };
/** Private provenance for a current own-author row; consumers still need an explicit mutation grant. */
export type EditableOrderCommentSource=Readonly<{scope:ReadScope;orderId:string;id:string;version:number;body:string;createdAt:string;editedAt:string|null}>;
export function orderCommentContext(body: unknown, organizationId: string): Context | null {
  const ids = workflowIdentity.safeParse(body);
  if (!ids.success || ids.data.orderId !== ids.data.order.id || ids.data.version !== ids.data.order.version || ids.data.order.buyerOrganizationId !== organizationId) return null;
  if (typeof body !== "object" || body === null || !("order" in body)) return null;
  const label = supplierOrderResponseSchema.pick({ orderNumber: true }).strip().safeParse(body.order); if (!label.success) return null;
  return Object.freeze({ orderId: ids.data.orderId, orderVersion: ids.data.version, orderNumber: label.data.orderNumber, buyerOrganizationId: ids.data.order.buyerOrganizationId, supplierOrganizationId: ids.data.order.supplierOrganizationId });
}
export function decodeOrderCommentsFixture(body: unknown, context: Context, minimumVersions?: ReadonlyMap<string, number>): OrderComment[] | null {
  const bound = identities.safeParse(body);
  if (!bound.success || new Set(bound.data.map(item => item.id)).size !== bound.data.length || bound.data.some(item => item.supplierOrderId !== context.orderId || item.version < (minimumVersions?.get(item.id) ?? item.version))) return null;
  const parsed = z.array(content).safeParse(body); if (!parsed.success) return null;
  if (parsed.data.some((item, index) => item.id !== bound.data[index]!.id || item.version !== bound.data[index]!.version)) return null;
  return parsed.data.map((item, index) => ({ ...item, party: bound.data[index]!.authorOrganizationId === context.buyerOrganizationId ? "buyer" : bound.data[index]!.authorOrganizationId === context.supplierOrganizationId ? "supplier" : "other" }));
}
export type OrderCommentsFixtureClient = { orderCommentsFixture?: (scope: ReadScope, orderId: string) => Promise<unknown> };
type Failure = "contract-error" | "authentication-required" | "denied" | "unavailable" | "retry-limited" | "error";
export type OrderCommentsFixtureState = { phase: "idle" } | { phase: "loading"; target: { kind: "order-comments" } } | { phase: "ready" | "empty"; read: { kind: "order-comments"; value: OrderCommentsWindow } } | { phase: Failure };
function failure(error: unknown): Failure {
  if (typeof error !== "object" || error === null || !("status" in error) || !("payload" in error)) return "error";
  const status = error.status, parsed = errorResponseSchema.safeParse(error.payload);
  if (typeof status !== "number" || !Number.isInteger(status) || status < 300 || status > 599 || !parsed.success || parsed.data.statusCode !== status) return "contract-error";
  return status === 401 ? "authentication-required" : status === 403 ? "denied" : status === 404 ? "unavailable" : status === 429 ? "retry-limited" : "error";
}
export function createOrderCommentsFixtureRead(scope: ReadScope, port?: OrderCommentsFixtureClient["orderCommentsFixture"], captureEditableAuthors:()=>boolean=()=>false) {
  let editableSources = new WeakMap<OrderComment,EditableOrderCommentSource>();
  const owner = Object.freeze({ ...scope }); let issued = new WeakMap<OrderCommentSelection, Context>(), sequence = 0, state: OrderCommentsFixtureState = { phase: "idle" }, last: OrderCommentSelection | null = null, pending: object | null = null, accepted: { orderId: string; versions: ReadonlyMap<string, number> } | null = null;
  const load = async (target: OrderCommentSelection): Promise<"applied" | "discarded"> => {
    const request = {}; pending = request; editableSources = new WeakMap();
    const context = typeof target === "object" && target !== null ? issued.get(target) : undefined;
    if (!context) { pending = null; last = null; accepted = null; state = { phase: "contract-error" }; return "applied"; }
    last = target; const minimum = accepted?.orderId === context.orderId ? accepted.versions : undefined; if (!minimum) accepted = null;
    state = { phase: "loading", target: { kind: "order-comments" } }; let next: OrderCommentsFixtureState;
    try {
      if (!port) next = { phase: "unavailable" };
      else {
        const body = await port(owner, context.orderId); if (pending !== request) return "discarded";
        const comments = decodeOrderCommentsFixture(body, context, minimum);
        if (!comments) { accepted = null; next = { phase: "contract-error" }; }
        else {
          let capture=false;try{capture=captureEditableAuthors();}catch{capture=false;}
          if(capture&&Array.isArray(body))for(let index=0;index<comments.length;index++){
            const row=comments[index]!;if(row.party!=="buyer")continue;
            // No author ID, key or extra metadata is read in the default readonly path.
            // Bind public identity/order/org before inspecting the optional actor proof.
            try{
              const root=identity.safeParse(body[index]);
              if(!root.success||root.data.id!==row.id||root.data.version!==row.version||root.data.supplierOrderId!==context.orderId||root.data.authorOrganizationId!==owner.organizationId)continue;
              const actor=z.object({authorUserId:uuid}).safeParse(body[index]);
              if(!actor.success||actor.data.authorUserId!==owner.userId)continue;
              editableSources.set(row,Object.freeze({scope:owner,orderId:context.orderId,id:row.id,version:row.version,body:row.body,createdAt:row.createdAt,editedAt:row.editedAt}));
            }catch{/* Unavailable actor proof keeps the existing public row readonly. */}
          }
          accepted = { orderId: context.orderId, versions: new Map(comments.map(item => [item.id, item.version])) }; next = { phase: comments.length ? "ready" : "empty", read: { kind: "order-comments", value: { context, comments } } }; }
      }
    } catch (error) { if (pending !== request) return "discarded"; accepted = null; next = { phase: failure(error) }; }
    if (pending !== request) return "discarded"; pending = null; state = next; return "applied";
  };
  return { editableSource(window:OrderCommentsWindow,row:OrderComment){
    if(!("read"in state)||state.read.kind!=="order-comments"||state.read.value!==window||window.context.buyerOrganizationId!==owner.organizationId||!window.comments.includes(row))return null;
    const source=editableSources.get(row);return source&&source.orderId===window.context.orderId&&source.id===row.id&&source.version===row.version&&source.body===row.body&&source.createdAt===row.createdAt&&source.editedAt===row.editedAt?source:null;
  }, select(workflow: unknown) { const context = orderCommentContext(workflow, owner.organizationId); if (!context) return null; const target = Object.freeze({ orderId: context.orderId, orderVersion: context.orderVersion, selection: ++sequence }); issued.set(target, context); return target; }, load, getState: () => state, refresh: () => last ? load(last) : Promise.resolve("no-query" as const), reset() { editableSources = new WeakMap(); pending = null; last = null; accepted = null; issued = new WeakMap(); state = { phase: "idle" }; } };
}
