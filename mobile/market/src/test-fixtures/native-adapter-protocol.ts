import { createConversationReadTransport } from "../conversation-read-transport";
import { createConversationCommandTransport } from "../conversation-command-transport";
import { createCartCommandTransport } from "../cart-command-transport";
import { createBuyerWorkflowTransport } from "../buyer-workflow-transport";
import { createBuyerWorkspaceTransport } from "../buyer-workspace-transport";
import { offerConversationScope, offerConversationId as uuid } from "./offer-conversation";
import { buyerId, savedCart } from "./carts";
import { repriceValidation } from "./cart-reprice";

const scope = Object.freeze({ ...offerConversationScope, organizationId: buyerId, environment: "https://market.example.invalid/api" }), id = uuid(78001), item = uuid(78002), key = uuid(78003), line = uuid(78004);
const text = "SYNTHETIC reviewed message", reason = "SYNTHETIC reviewed reason";
type Family = "conversation-read" | "conversation-command" | "cart" | "buyer-workflow" | "buyer-workspace";
type Method = "GET" | "POST" | "PATCH" | "DELETE";
type Kind = "null" | "array" | "object" | "string" | "number" | "boolean";
type Ports = { conversationRead: ReturnType<typeof createConversationReadTransport>; conversationCommand: ReturnType<typeof createConversationCommandTransport>; cart: ReturnType<typeof createCartCommandTransport>; workflow: ReturnType<typeof createBuyerWorkflowTransport>; workspace: ReturnType<typeof createBuyerWorkspaceTransport> };
type Spec = { id: string; family: Family; run: (ports: Ports) => Promise<unknown> };
const base = (action: string) => ({ action, expectedVersion: 5, idempotencyKey: key });
const workflow = [
  { id: "cancel", input: { ...base("CANCEL"), reason, transferNotMade: true } },
  { id: "receive-shipment", input: { ...base("RECEIVE_SHIPMENT"), shipmentId: line, items: [{ shipmentItemId: line, deliveredQuantity: "999999999999.999999" }] } },
  { id: "return-goods", input: { ...base("REQUEST_RETURN"), kind: "GOODS", reason, items: [{ orderItemId: line, quantity: "0.500001", condition: "SYNTHETIC reviewed condition" }] } },
  { id: "return-cancellation", input: { ...base("REQUEST_RETURN"), kind: "CANCELLATION", reason, items: [] } },
  { id: "return-overpayment", input: { ...base("REQUEST_RETURN"), kind: "OVERPAYMENT", reason, items: [] } },
  { id: "send-return", input: { ...base("SEND_RETURN_GOODS"), returnId: line } },
  { id: "receive-refund", input: { ...base("RECEIVE_MANUAL_REFUND"), returnId: line } },
  { id: "reorder", input: base("REORDER") }, { id: "accept-composition", input: base("ACCEPT_COMPOSITION") },
  { id: "open-dispute", input: { ...base("OPEN_PAYMENT_DISPUTE"), claimId: line, reason } },
];
const specs: readonly Spec[] = [
  { id: "conversation-list", family: "conversation-read", run: p => p.conversationRead.list(scope) },
  { id: "conversation-context", family: "conversation-read", run: p => p.conversationRead.lookup(scope, { contextType: "OFFER", contextId: id }) },
  { id: "conversation-detail", family: "conversation-read", run: p => p.conversationRead.get(scope, id, 16) },
  { id: "conversation-start", family: "conversation-command", run: p => p.conversationCommand.start(scope, { contextType: "ORDER", contextId: id, body: text, idempotencyKey: key }) },
  { id: "conversation-send", family: "conversation-command", run: p => p.conversationCommand.send(scope, id, { body: text, idempotencyKey: key }) },
  { id: "conversation-read-marker", family: "conversation-command", run: p => p.conversationCommand.markRead(scope, id, { throughSequence: 0 }) },
  { id: "conversation-resolve", family: "conversation-command", run: p => p.conversationCommand.resolve(scope, id, { expectedVersion: 5 }) },
  { id: "conversation-escalate", family: "conversation-command", run: p => p.conversationCommand.escalate(scope, id, { reason, idempotencyKey: key }) },
  { id: "conversation-support-reply", family: "conversation-command", run: p => p.conversationCommand.supportReply(scope, id, { body: text, idempotencyKey: key, isInternal: false, attachments: [] }) },
  { id: "cart-create", family: "cart", run: p => p.cart.create(scope, buyerId, { currency: "KZT" }) },
  { id: "cart-add", family: "cart", run: p => p.cart.add(scope, id, { offerId: item, quantity: 1.25 }) },
  { id: "cart-update", family: "cart", run: p => p.cart.update(scope, id, item, { expectedVersion: 5, quantity: 1.500001 }) },
  { id: "cart-remove", family: "cart", run: p => p.cart.remove(scope, id, item, { expectedVersion: 5 }) },
  { id: "cart-recover", family: "cart", run: p => p.cart.recover(scope, id, { expectedVersion: 5 }) },
  { id: "cart-validate", family: "cart", run: p => p.cart.validate(scope, id) },
  { id: "cart-reprice", family: "cart", run: p => { const cart = savedCart(); return p.cart.reprice(scope, cart.id, { expectedVersion: cart.version, acceptedItems: [{ cartItemId: cart.items[0]!.id, snapshot: repriceValidation(cart).items[0]!.current! }] }); } },
  { id: "cart-checkout", family: "cart", run: p => p.cart.checkout(scope, id, { expectedVersion: 5, idempotencyKey: key }) },
  ...workflow.map(row => ({ id: `workflow-${row.id}`, family: "buyer-workflow" as const, run: (p: Ports) => p.workflow.execute(scope, id, row.input) })),
  { id: "workspace-saved-lists", family: "buyer-workspace", run: p => p.workspace.savedLists(scope) },
  { id: "workspace-create-list", family: "buyer-workspace", run: p => p.workspace.createSavedList(scope, { name: text, isDefault: true }) },
  { id: "workspace-upsert-item", family: "buyer-workspace", run: p => p.workspace.upsertSavedListItem(scope, id, { offerId: item, quantity: 0.500001, note: text }) },
  { id: "workspace-remove-item", family: "buyer-workspace", run: p => p.workspace.removeSavedListItem(scope, id, item) },
  { id: "workspace-order-comments", family: "buyer-workspace", run: p => p.workspace.orderComments(scope, id) },
  { id: "workspace-create-comment", family: "buyer-workspace", run: p => p.workspace.createOrderComment(scope, id, { body: text, idempotencyKey: key }) },
  { id: "workspace-update-comment", family: "buyer-workspace", run: p => p.workspace.updateOrderComment(scope, item, { body: text, version: 9 }) },
];
export const nativeAdapterProtocolCaseIds = Object.freeze(specs.map(row => row.id));
type RequestShape = Readonly<{ method: Method; pathPattern: string; queryKeys: readonly string[]; bodyType: Kind | "absent"; bodyFields: Readonly<Record<string, Kind>> }>;
export type NativeAdapterProtocolReport = Readonly<{
  formatVersion: 1; scenario: string; family: Family; request: RequestShape; syntheticPortCalls: 1;
  returnedRawIdentity: true; responseContractAccepted: false; businessEligibilityVerified: false;
  nativeBindingPerformed: false; nativeUuidProviderAccessed: false; realNetworkRequests: 0; realServerMutations: 0;
  serverAccepted: false; productionAuthorizationVerified: false;
}>;
function kind(value: unknown): Kind {
  if (value === null) return "null"; if (Array.isArray(value)) return "array";
  const type = typeof value;
  if (type === "object" || type === "string" || type === "number" || type === "boolean") return type;
  throw Error("Unsupported synthetic request field");
}
function fieldTypes(value: unknown) {
  const fields: Record<string, Kind> = {}; let count = 0;
  const visit = (value: unknown, path: string, depth: number) => {
    if (depth > 12 || ++count > 4096) throw Error("Synthetic request shape is too large");
    if (path) fields[path] = kind(value);
    if (Array.isArray(value)) { if (value.length) visit(value[0], path + "[]", depth + 1); }
    else if (value !== null && typeof value === "object") for (const key of Object.keys(value).sort()) {
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) throw Error("Unsupported synthetic request field name");
      visit((value as Record<string, unknown>)[key], path ? path + "." + key : key, depth + 1);
    }
  };
  if (value !== undefined) visit(value, "", 0);
  return Object.freeze(fields);
}

/** Actual raw candidates on a synthetic port; validates request shape, never grants or response/effect. */
export async function syntheticNativeAdapterProtocol(scenario: string): Promise<NativeAdapterProtocolReport> {
  const selected = specs.find(row => row.id === scenario); if (!selected) throw Error("Unknown synthetic adapter scenario");
  const sentinel = Object.freeze({}), requests: RequestShape[] = [];
  const dispatch = async (method: Method, path: string, body?: Readonly<object>) => {
    const parsed = new URL(path, "https://market.example.invalid"), pathPattern = parsed.pathname.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id");
    const serialized: unknown = body === undefined ? undefined : JSON.parse(JSON.stringify(body));
    requests.push(Object.freeze({ method, pathPattern, queryKeys: Object.freeze([...parsed.searchParams.keys()].sort()), bodyType: serialized === undefined ? "absent" : kind(serialized), bodyFields: fieldTypes(serialized) })); return sentinel;
  };
  const read = (path: string) => dispatch("GET", path), post = (path: string, body: Readonly<object>) => dispatch("POST", path, body);
  const ports: Ports = {
    conversationRead: createConversationReadTransport(scope, read, () => true), conversationCommand: createConversationCommandTransport(scope, post, () => true),
    cart: createCartCommandTransport(scope, dispatch, () => true), workflow: createBuyerWorkflowTransport(scope, post, () => true), workspace: createBuyerWorkspaceTransport(scope, read, dispatch, () => true),
  };
  try {
    const result = await selected.run(ports);
    if (result !== sentinel || requests.length !== 1) throw Error("Unexpected synthetic adapter dispatch");
    return Object.freeze({ formatVersion: 1, scenario, family: selected.family, request: requests[0]!, syntheticPortCalls: 1, returnedRawIdentity: true, responseContractAccepted: false, businessEligibilityVerified: false, nativeBindingPerformed: false, nativeUuidProviderAccessed: false, realNetworkRequests: 0, realServerMutations: 0, serverAccepted: false, productionAuthorizationVerified: false });
  } finally { for (const port of Object.values(ports)) port.close(); }
}
