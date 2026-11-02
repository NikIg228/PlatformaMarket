import { z } from "zod";
import { orderWorkflowCommandSchema, type OrderWorkflowCommand } from "../../../packages/schemas/src/order-workflow";
import { returnKindSchema, returnLineSchema } from "../../../packages/schemas/src/order-returns";
import { createMarketOperationScope } from "./market-operation-scope";
import type { ReadScope } from "./read-controller";
const actions = ["CANCEL", "RECEIVE_SHIPMENT", "REQUEST_RETURN", "SEND_RETURN_GOODS", "RECEIVE_MANUAL_REFUND", "REORDER", "ACCEPT_COMPOSITION", "OPEN_PAYMENT_DISPUTE", "DECIDE_PAYMENT_REDUCTION", "PROPOSE_PAYMENT_REDUCTION"] as const;
const common = orderWorkflowCommandSchema.options[0].shape;
const header = z.object({ action: z.enum(actions), expectedVersion: common.expectedVersion, idempotencyKey: common.idempotencyKey }).strip();
const branches = new Map<string, z.ZodType<OrderWorkflowCommand>>();
for (const branch of orderWorkflowCommandSchema.options) if (actions.some(action => action === branch.shape.action.value)) branches.set(branch.shape.action.value, branch.strict());
const rawReason = z.object({ reason: z.string() }).strip();
const rawReturn = z.object({ kind: returnKindSchema, items: z.array(z.unknown()).max(500) }).strip();
const rawReturnLine = z.object({ orderItemId: returnLineSchema.shape.orderItemId, quantity: returnLineSchema.shape.quantity, condition: z.string() }).strict();
export class BuyerWorkflowTransportError extends Error {
  constructor(readonly code: "scope" | "input") { super(code === "scope" ? "Buyer workflow context is unavailable" : "Invalid reviewed buyer workflow command"); this.name = "BuyerWorkflowTransportError"; }
}
function decode<T>(schema: z.ZodType<T>, input: unknown): T {
  try { const parsed = schema.safeParse(input); if (parsed.success) return parsed.data; } catch { /* Do not expose private caller data in parse failures. */ }
  throw new BuyerWorkflowTransportError("input");
}
function freeze<T>(value: T): Readonly<T> { if (value !== null && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; }

/** Selected source wire only; business eligibility and grants remain in protected models/server. */
export function createBuyerWorkflowTransport(scope: ReadScope, postOnce: (path: string, body: Readonly<object>) => Promise<unknown>, isCurrent: () => boolean) {
  if (typeof postOnce !== "function") throw new BuyerWorkflowTransportError("scope");
  const lifetime = createMarketOperationScope(scope, isCurrent, () => new BuyerWorkflowTransportError("scope"));
  return Object.freeze({
    execute(candidate: ReadScope, orderId: unknown, input: unknown) {
      lifetime.assert(candidate); const target = decode(z.uuid(), orderId), selected = decode(header, input), branch = branches.get(selected.action);
      if (!branch) throw new BuyerWorkflowTransportError("input");
      const reason = ["CANCEL", "REQUEST_RETURN", "OPEN_PAYMENT_DISPUTE", "PROPOSE_PAYMENT_REDUCTION"].includes(selected.action) ? decode(rawReason, input).reason : null;
      let lines: z.output<typeof rawReturnLine>[] | null = null;
      if (selected.action === "REQUEST_RETURN") {
        const value = decode(rawReturn, input);
        if (value.kind === "GOODS" ? value.items.length === 0 : value.items.length !== 0) throw new BuyerWorkflowTransportError("input");
        lines = decode(rawReturnLine.array().max(500), value.items);
      }
      const body = decode(branch, input);
      if (reason !== null && (!("reason" in body) || body.reason !== reason)) throw new BuyerWorkflowTransportError("input");
      if (body.action === "REQUEST_RETURN" && lines?.some((line, index) => line.condition !== body.items[index]?.condition)) throw new BuyerWorkflowTransportError("input");
      const snapshot = freeze(body);
      return (async () => {
        lifetime.assert(candidate);
        try { const result = await postOnce(`/supplier-orders/${encodeURIComponent(target)}/workflow`, snapshot); lifetime.assert(candidate); return result; }
        catch (error) { lifetime.assert(candidate); throw error; }
      })();
    },
    close: lifetime.close,
  });
}
export type BuyerWorkflowTransport = ReturnType<typeof createBuyerWorkflowTransport>;
