import { z } from "zod";
import { returnLineSchema } from "../../../packages/schemas/src/order-returns";
import { orderWorkflowCommandSchema } from "../../../packages/schemas/src/order-workflow";
import { createBuyerWorkflowTransport } from "./buyer-workflow-transport";
import { createMarketOperationScope } from "./market-operation-scope";
import { createNativeUuidSource, type NativeUuidProvider } from "./native-uuid-source";
import type { BuyerWorkflowCommandFixture, NativeBuyerWorkflowInput } from "./order-workflow-command-fixture";
import type { ReadScope } from "./read-controller";
export type NativeBuyerWorkflowCommands = Readonly<Omit<BuyerWorkflowCommandFixture, "authorization" | "executeOrderWorkflow"> & {
  executeOrderWorkflow: (scope: ReadScope, orderId: string, input: Readonly<NativeBuyerWorkflowInput>) => Promise<unknown>;
  available: (scope: ReadScope) => boolean;
  canIssueKey: (scope: ReadScope) => boolean;
}>;
export type NativeBuyerWorkflowClient = { nativeBuyerWorkflowCommands?: NativeBuyerWorkflowCommands };
export class NativeBuyerWorkflowError extends Error {
  constructor(readonly code: "scope" | "input" | "key") { super("Order workflow request is unavailable"); this.name = "NativeBuyerWorkflowError"; }
}
const selected = ["CANCEL", "RECEIVE_SHIPMENT", "REQUEST_RETURN", "SEND_RETURN_GOODS", "RECEIVE_MANUAL_REFUND", "REORDER", "ACCEPT_COMPOSITION", "OPEN_PAYMENT_DISPUTE", "DECIDE_PAYMENT_REDUCTION", "PROPOSE_PAYMENT_REDUCTION"] as const;
const branches = new Map<string, z.ZodType<NativeBuyerWorkflowInput>>();
for (const branch of orderWorkflowCommandSchema.options) if (selected.some(action => action === branch.shape.action.value)) branches.set(branch.shape.action.value, branch.strict() as z.ZodType<NativeBuyerWorkflowInput>);
function freeze<T>(value: T): Readonly<T> { if (value !== null && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; }
/** Existing selected BUYER request routes; source eligibility, server permissions and financial facts remain authoritative. */
export function createNativeBuyerWorkflowCommands(scope: ReadScope, postOnce: (path: string, body: Readonly<object>) => Promise<unknown>, provider: NativeUuidProvider | undefined, isCurrent: () => boolean) {
  const lifetime = createMarketOperationScope(scope, isCurrent, () => new NativeBuyerWorkflowError("scope")), keys = createNativeUuidSource(scope, provider, isCurrent), issued = new Set<string>(), transport = createBuyerWorkflowTransport(scope, postOnce, isCurrent);
  const pinned = new Map<string, Readonly<{ orderId: string; bytes: string; input: Readonly<NativeBuyerWorkflowInput> }>>();
  const port: NativeBuyerWorkflowCommands = Object.freeze({
    available(candidate) { try { lifetime.assert(candidate); return true; } catch { return false; } },
    canIssueKey: keys.canIssue,
    nextWorkflowIdempotencyKey() { lifetime.assert(lifetime.owner); const key = keys.next(lifetime.owner); lifetime.assert(lifetime.owner); issued.add(key); return key; },
    async executeOrderWorkflow(candidate, orderId, input) {
      lifetime.assert(candidate); let id: string, body: Readonly<NativeBuyerWorkflowInput>;
      try {
        id = z.uuid().parse(orderId); const branch = branches.get(input.action); if (!branch) throw Error("input"); const parsed = branch.parse(input);
        if (parsed.idempotencyKey !== input.idempotencyKey || "reason" in parsed && (!("reason" in input) || parsed.reason !== input.reason)) throw Error("input");
        if (parsed.action === "REQUEST_RETURN") {
          if (input.action !== "REQUEST_RETURN" || !Array.isArray(input.items) || parsed.items.some((line, index) => line.condition !== input.items[index]?.condition)) throw Error("input");
          returnLineSchema.strict().array().max(500).parse(input.items);
          if (parsed.kind === "GOODS" ? parsed.items.length === 0 : parsed.items.length !== 0) throw Error("input");
        }
        body = freeze(parsed);
      } catch { throw new NativeBuyerWorkflowError("input"); }
      lifetime.assert(candidate); if (!issued.has(body.idempotencyKey)) throw new NativeBuyerWorkflowError("key"); const bytes = JSON.stringify(body), prior = pinned.get(body.idempotencyKey);
      if (prior && (prior.orderId !== id || prior.bytes !== bytes)) throw new NativeBuyerWorkflowError("input"); const attempt = prior ?? Object.freeze({ orderId: id, bytes, input: body }); if (!prior) pinned.set(body.idempotencyKey, attempt);
      try { const result = await transport.execute(candidate, id, attempt.input); lifetime.assert(candidate); return result; } catch (error) { lifetime.assert(candidate); throw error; }
    },
  });
  return Object.freeze({ port, close() { lifetime.close(); keys.close(); transport.close(); issued.clear(); pinned.clear(); } });
}
export function nativeBuyerWorkflowAvailable(port: NativeBuyerWorkflowCommands, scope: ReadScope): boolean {
  try { return port.available(scope) === true && port.canIssueKey(scope) === true; } catch { return false; }
}
