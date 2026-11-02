import { z } from "zod";
import { createOfferConversationRead, type OfferConversationWindow } from "../offer-conversation-read";
import { createOrderConversationRead, type OrderConversationWindow } from "../order-conversation-read";
import { createOfferConversationSupportLinks } from "../offer-conversation-support-link";
import { createOfferConversationSupportRead } from "../offer-conversation-support-read";
import { createConversationSupportLinks } from "../conversation-support-link";
import { createConversationSupportRead } from "../conversation-support-read";
import { createMobileReadQueries, type MobileReadClient } from "../../../../contracts/mobile-read/read-queries";

const envelope = z.object({
  formatVersion: z.literal(1),
  scope: z.object({ product: z.literal("market"), environment: z.string().min(1), userId: z.uuid(), organizationId: z.uuid(), generation: z.number().int().positive() }).strip(),
  expected: z.object({ contextType: z.enum(["ORDER", "OFFER"]), id: z.uuid(), contextId: z.uuid(), productId: z.uuid().nullable(), buyerOrganizationId: z.uuid(), supplierOrganizationId: z.uuid(), version: z.number().int().positive(), latestSequence: z.number().int().nonnegative() }).strip(),
  olderPageCount: z.number().int().min(0).max(8).default(0),
  includeSupport: z.boolean().default(false),
}).strip();
const detailRequest = z.object({ conversationId: z.uuid(), beforeSequence: z.number().int().positive().optional() }).strict();
const supportRequest = z.object({ ticketId: z.uuid(), beforeMessageId: z.uuid().optional() }).strict();
const workflowRequest = z.object({ orderId: z.uuid() }).strict();
type Stage = "envelope" | "parent" | "detail" | "older-detail" | "support" | "complete";
type PageProof = Readonly<{ messages: number; version: number; latestSequence: number; hasOlder: boolean }>;
export type ConversationCaptureReport = Readonly<{
  status: "INPUT_INVALID" | "CONSUMER_REJECTED" | "CONSISTENT_READ";
  stage: Stage;
  phase?: string;
  pages: readonly PageProof[];
  supportMessages?: number;
  serverAccepted: false;
  productionAuthorizationVerified: false;
  networkRequests: 0;
  mutations: 0;
}>;

/** Saved-response consistency only. Captured actor labels are never authentication or native grants. */
export async function replayConversationCapture(input: unknown): Promise<ConversationCaptureReport> {
  const pages: PageProof[] = [];
  let stage: Stage = "envelope", recordIssue = false;
  const report = (status: ConversationCaptureReport["status"], phase?: string, supportMessages?: number): ConversationCaptureReport => Object.freeze({
    status, stage, ...(phase === undefined ? {} : { phase }), pages: Object.freeze([...pages]),
    ...(supportMessages === undefined ? {} : { supportMessages }), serverAccepted: false, productionAuthorizationVerified: false, networkRequests: 0, mutations: 0,
  });
  const invalidRecord = (): never => { recordIssue = true; throw Error("Invalid captured GET record"); };
  const reply = <T>(record: unknown, schema: z.ZodType<T>, matches: (request: T) => boolean, pathFor: (request: T) => string): unknown => {
    try {
      const meta = z.object({ method: z.literal("GET"), path: z.string().max(500), request: schema, httpStatus: z.number().int().min(100).max(599) }).strip().safeParse(record);
      if (!meta.success || !matches(meta.data.request) || meta.data.path !== pathFor(meta.data.request) || !Object.prototype.hasOwnProperty.call(record, "body")) return invalidRecord();
      const raw = record as { body: unknown };
      if (meta.data.httpStatus !== 200) throw { status: meta.data.httpStatus, payload: raw.body };
      return raw.body;
    } catch (error) {
      if (typeof error === "object" && error !== null && "status" in error && "payload" in error) throw error;
      return invalidRecord();
    }
  };
  let offer: ReturnType<typeof createOfferConversationRead> | null = null;
  let order: ReturnType<typeof createOrderConversationRead> | null = null;
  let closeSupport: (() => void) | null = null;
  try {
    // Parse only scope and request bounds before touching any captured response slot.
    const header = envelope.safeParse(input);
    if (!header.success) return report("INPUT_INVALID");
    const { scope, expected, olderPageCount, includeSupport } = header.data;
    if (expected.buyerOrganizationId !== scope.organizationId || expected.supplierOrganizationId === scope.organizationId || expected.contextType === "ORDER" && expected.productId !== null) return report("INPUT_INVALID");
    const raw = input as { summary?: unknown; orderWorkflow?: unknown; detail?: unknown; olderDetails?: unknown[]; supportDetail?: unknown };
    const authorization = { provenance: "synthetic-source-contract" as const, scope, side: "BUYER" as const, operator: false as const, permissions: ["support.ticket.view"] };
    let detailIndex = 0;
    const get = async (_scope: typeof scope, id: string, beforeSequence?: number) => {
      const record = detailIndex++ === 0 ? raw.detail : raw.olderDetails?.[detailIndex - 2];
      return reply(record, detailRequest, request => request.conversationId === id && request.beforeSequence === beforeSequence, request => `/conversations/${encodeURIComponent(request.conversationId)}`);
    };
    const uncaptured = async (): Promise<never> => invalidRecord();
    const core: MobileReadClient = { searchCatalog: uncaptured, compareOffers: uncaptured, workspaceOrders: uncaptured, getOrderWorkflow: uncaptured,
      supportTicket: async (ticketId, beforeMessageId) => reply(raw.supportDetail, supportRequest, request => request.ticketId === ticketId && request.beforeMessageId === beforeMessageId, request => `/support/tickets/${encodeURIComponent(request.ticketId)}`) };
    stage = "parent";
    let currentOffer: OfferConversationWindow | null = null;
    let currentOrder: OrderConversationWindow | null = null;
    if (expected.contextType === "OFFER") {
      offer = createOfferConversationRead(scope, { authorization, lookup: uncaptured, get });
      const target = offer.selectSummary(raw.summary, expected);
      if (!target) return report("CONSUMER_REJECTED", "parent-binding");
      stage = "detail";
      await offer.load(target);
    } else {
      order = createOrderConversationRead(scope, { orderConversationLookupFixture: uncaptured, orderConversationDetailFixture: get });
      let parent: unknown;
      try { parent = reply(raw.orderWorkflow, workflowRequest, request => request.orderId === expected.contextId, request => `/supplier-orders/${request.orderId}/workflow`); }
      catch (capturedError) {
        if (recordIssue) return report("INPUT_INVALID", "get-record");
        const errors = createMobileReadQueries(scope, { ...core, getOrderWorkflow: async () => { throw capturedError; } });
        try { await errors.load({ kind: "workflow", orderId: expected.contextId }); return report("CONSUMER_REJECTED", errors.getState().phase); }
        finally { errors.reset(scope, core); }
      }
      const target = order.selectKnown(parent, expected);
      if (!target) return report("CONSUMER_REJECTED", "parent-binding");
      stage = "detail";
      await order.load(target);
    }
    for (let page = 0; page <= olderPageCount; page++) {
      if (offer) {
        const state = offer.getState();
        if (!("read" in state) || !state.read.value.conversation) return report(recordIssue ? "INPUT_INVALID" : "CONSUMER_REJECTED", state.phase);
        currentOffer = state.read.value;
        pages.push(Object.freeze({ messages: currentOffer.messages.length, version: currentOffer.conversation!.version, latestSequence: currentOffer.conversation!.latestSequence, hasOlder: currentOffer.hasOlder }));
        if (page < olderPageCount) { stage = "older-detail"; const target = offer.older(currentOffer); if (!target) return report("INPUT_INVALID", "uncaptured-cursor"); await offer.load(target); }
      } else if (order) {
        const state = order.getState();
        if (!("read" in state) || !state.read.value.conversation) return report(recordIssue ? "INPUT_INVALID" : "CONSUMER_REJECTED", state.phase);
        currentOrder = state.read.value;
        pages.push(Object.freeze({ messages: currentOrder.messages.length, version: currentOrder.conversation!.version, latestSequence: currentOrder.conversation!.latestSequence, hasOlder: currentOrder.hasOlder }));
        if (page < olderPageCount) { stage = "older-detail"; const target = order.older(currentOrder); if (!target) return report("INPUT_INVALID", "uncaptured-cursor"); await order.load(target); }
      }
    }
    let supportMessages: number | undefined;
    if (includeSupport) {
      stage = "support";
      if (offer && currentOffer) {
        const links = createOfferConversationSupportLinks(scope, () => currentOffer), reader = createOfferConversationSupportRead(scope, core, links);
        closeSupport = () => { reader.close(); links.close(); };
        const target = links.select(currentOffer), origin = target ? links.take(target) : null;
        if (!origin) return report("CONSUMER_REJECTED", "support-pointer-missing");
        await reader.load({ kind: "offer-conversation-support-ticket", origin });
        const state = reader.getState();
        if (!("read" in state) || state.read.kind !== "support-ticket") return report(recordIssue ? "INPUT_INVALID" : "CONSUMER_REJECTED", state.phase);
        supportMessages = state.read.value.messages.length;
      } else if (order && currentOrder) {
        const links = createConversationSupportLinks(scope, () => currentOrder), reader = createConversationSupportRead(scope, core, links);
        closeSupport = () => { reader.close(); links.close(); };
        const target = links.select(currentOrder), origin = target ? links.take(target) : null;
        if (!origin) return report("CONSUMER_REJECTED", "support-pointer-missing");
        await reader.load({ kind: "conversation-support-ticket", origin });
        const state = reader.getState();
        if (!("read" in state) || state.read.kind !== "support-ticket") return report(recordIssue ? "INPUT_INVALID" : "CONSUMER_REJECTED", state.phase);
        supportMessages = state.read.value.messages.length;
      }
    }
    stage = "complete";
    return report("CONSISTENT_READ", undefined, supportMessages);
  } catch {
    return report("INPUT_INVALID", recordIssue ? "get-record" : "capture-shape");
  } finally {
    closeSupport?.(); offer?.close(); order?.reset();
  }
}
