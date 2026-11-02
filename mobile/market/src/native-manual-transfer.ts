import { z } from "zod";
import { orderWorkflowCommandSchema, type OrderWorkflowCommand } from "../../../packages/schemas/src/order-workflow";
import { documentArchiveQuerySchema } from "../../../packages/schemas/src/core-api";
import { createMarketOperationScope } from "./market-operation-scope";
import { createNativeUuidSource, type NativeUuidProvider } from "./native-uuid-source";
import type { ReadScope } from "./read-controller";
export type ManualTransferInput = Readonly<Extract<OrderWorkflowCommand, { action: "REPORT_TRANSFER" }>>;
export type NativeManualTransferPort = Readonly<{
  available: (scope: ReadScope) => boolean;
  canIssueKey: (scope: ReadScope) => boolean;
  nextKey: (scope: ReadScope) => string;
  invoice: (scope: ReadScope, documentId: string) => Promise<unknown>;
  proofs: (scope: ReadScope, orderId: string, cursor?: string) => Promise<unknown>;
  submit: (scope: ReadScope, orderId: string, input: ManualTransferInput) => Promise<unknown>;
}>;
export type NativeManualTransferClient = { nativeManualTransfer?: NativeManualTransferPort };
export class NativeManualTransferError extends Error { constructor(readonly code: "scope" | "input" | "key") { super("Manual transfer declaration is unavailable"); this.name = "NativeManualTransferError"; } }
const branch = orderWorkflowCommandSchema.options.find(option => option.shape.action.value === "REPORT_TRANSFER");
if (!branch) throw Error("Existing REPORT_TRANSFER source branch missing");
const reportSchema = branch.strict();
/** Source declaration and metadata routes only. Request/key capability does not grant permissions or attest received funds/files. */
export function createNativeManualTransferPort(scope: ReadScope, read: (path: string) => Promise<unknown>, postOnce: (path: string, body: Readonly<object>) => Promise<unknown>, provider: NativeUuidProvider | undefined, isCurrent: () => boolean) {
  const lifetime = createMarketOperationScope(scope, isCurrent, () => new NativeManualTransferError("scope")), keys = createNativeUuidSource(scope, provider, isCurrent), issued = new Set<string>();
  const pinned = new Map<string, Readonly<{ orderId: string; bytes: string; input: ManualTransferInput }>>();
  const id = (value: unknown) => { const parsed = z.uuid().safeParse(value); if (!parsed.success) throw new NativeManualTransferError("input"); return parsed.data; };
  const get = async (candidate: ReadScope, path: string) => { lifetime.assert(candidate); try { const result = await read(path); lifetime.assert(candidate); return result; } catch (error) { lifetime.assert(candidate); throw error; } };
  const port: NativeManualTransferPort = Object.freeze({
    available(candidate) { try { lifetime.assert(candidate); return true; } catch { return false; } },
    canIssueKey: keys.canIssue,
    nextKey(candidate) { lifetime.assert(candidate); const key = keys.next(candidate); lifetime.assert(candidate); issued.add(key); return key; },
    async invoice(candidate, documentId) { lifetime.assert(candidate); return get(candidate, `/documents/archive/${encodeURIComponent(id(documentId))}`); },
    async proofs(candidate, orderId, cursor) {
      lifetime.assert(candidate); const input = documentArchiveQuerySchema.parse({ kind: "PAYMENT_PROOF", supplierOrderId: id(orderId), limit: 25, ...(cursor === undefined ? {} : { cursor: id(cursor) }) });
      const query = new URLSearchParams({ kind: "PAYMENT_PROOF", supplierOrderId: input.supplierOrderId!, limit: String(input.limit), ...(input.cursor ? { cursor: input.cursor } : {}) }); return get(candidate, `/documents/archive?${query}`);
    },
    async submit(candidate, orderId, input) {
      lifetime.assert(candidate); let target: string, body: ManualTransferInput;
      try { target = id(orderId); const parsed = reportSchema.parse(input); if (parsed.action !== "REPORT_TRANSFER" || parsed.comment !== input.comment || parsed.idempotencyKey !== input.idempotencyKey) throw Error("input"); body = Object.freeze(parsed); } catch { throw new NativeManualTransferError("input"); }
      lifetime.assert(candidate); if (!issued.has(body.idempotencyKey)) throw new NativeManualTransferError("key");
      const bytes = JSON.stringify(body), prior = pinned.get(body.idempotencyKey); if (prior && (prior.orderId !== target || prior.bytes !== bytes)) throw new NativeManualTransferError("input"); const attempt = prior ?? Object.freeze({ orderId: target, bytes, input: body }); if (!prior) pinned.set(body.idempotencyKey, attempt);
      try { const result = await postOnce(`/supplier-orders/${encodeURIComponent(target)}/workflow`, attempt.input); lifetime.assert(candidate); return result; } catch (error) { lifetime.assert(candidate); throw error; }
    },
  });
  return Object.freeze({ port, close() { lifetime.close(); keys.close(); issued.clear(); pinned.clear(); } });
}
