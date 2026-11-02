import { errorResponseSchema, type CartResponse, type CartValidationResponse, type CheckoutResponse } from "../../../../packages/schemas/src/core-api";
import type { WorkspaceCartPage } from "../../../../packages/schemas/src/workspace-reads";
import { cartOperationCaptureExample, type CartCaptureExample } from "./cart-operation-capture-example";
import type { CartCaptureKind, CartCaptureReport } from "./cart-operation-capture-replay";
import { cartCommandError } from "./cart-commands";
import { cartValidationResult } from "./cart-validation";

export type CartOperationCorpusCase = Readonly<{
  id: string; input: CartCaptureExample;
  expected: Readonly<Partial<CartCaptureReport> & Pick<CartCaptureReport, "status">>;
}>;
const statuses = [400, 401, 403, 404, 409, 429, 500] as const;
async function capture(kind: CartCaptureKind, variant?: Parameters<typeof cartOperationCaptureExample>[1]): Promise<CartCaptureExample> {
  // Mutable copies of explicitly synthetic JSON only, never a caller's capture.
  return JSON.parse(JSON.stringify(await cartOperationCaptureExample(kind, variant)));
}
function http(record: CartCaptureExample["parent"], status: number, code?: string) {
  record.httpStatus = status;
  record.body = errorResponseSchema.parse({ ...cartCommandError(status, code).payload, path: record.path });
}
const parentCart = (input: CartCaptureExample) => (input.parent.body as WorkspaceCartPage).current!;

/** Generated source compatibility/refusal examples. No real response, permission, effect or native binding. */
export async function cartOperationCorpus(): Promise<readonly CartOperationCorpusCase[]> {
  const rows: CartOperationCorpusCase[] = [];
  const add = (id: string, input: CartCaptureExample, expected: CartOperationCorpusCase["expected"]) => rows.push(Object.freeze({ id, input, expected: Object.freeze(expected) }));
  for (const variant of ["unchanged", "changed", "unavailable", "empty"] as const) add(`validation-${variant}`, await capture("validation", variant), { status: "CONSISTENT_RESPONSE", validationPhase: "ready", commandCalls: 0, keyRequests: 0 });
  add("reprice-compatible", await capture("reprice"), { status: "CONSISTENT_RESPONSE", operationPhase: "result", commandCalls: 1, keyRequests: 0 });
  for (const status of ["COMPLETED", "PROCESSING", "FAILED"] as const) add(`checkout-receipt-${status.toLowerCase()}`, await capture("checkout", status), { status: "CONSISTENT_RESPONSE", operationPhase: "receipt", savedReceiptStatus: status, commandCalls: 1, keyRequests: 1 });
  const parentPhases = { 401: "authentication-required", 403: "denied", 404: "unavailable", 429: "retry-limited", 500: "error" } as const;
  for (const status of [401, 403, 404, 429, 500] as const) {
    const input = await capture("checkout"); http(input.parent, status);
    add(`parent-http-${status}`, input, { status: "CONSUMER_REJECTED", parentPhase: parentPhases[status], validationPhase: "not-run", validationCalls: 0, commandCalls: 0, keyRequests: 0 });
  }
  const quoteIssues = { 400: "validation", 401: "authentication", 403: "denied", 404: "not-found", 409: "conflict", 429: "read-error", 500: "read-error" } as const;
  for (const status of statuses) {
    const input = await capture("checkout"); http(input.validation, status);
    add(`validation-http-${status}`, input, { status: "CONSUMER_REJECTED", validationPhase: "error", validationIssue: quoteIssues[status], commandCalls: 0, keyRequests: 0 });
  }
  const commandIssues = { 400: "validation", 401: "authentication", 403: "denied", 404: "not-found", 409: "version" } as const;
  for (const kind of ["reprice", "checkout"] as const) {
    for (const status of statuses) {
      const input = await capture(kind); http(input.operation!, status);
      const known = status !== 429 && status !== 500;
      add(`${kind}-http-${status}`, input, { status: "CONSUMER_REJECTED", operationPhase: known ? "rejected" : "unknown", ...(known ? { operationIssue: commandIssues[status] } : {}), commandCalls: 1, keyRequests: kind === "checkout" ? 1 : 0 });
    }
    const ambiguous = await capture(kind); http(ambiguous.operation!, 409, "SYNTHETIC_UNRECOGNIZED_CONFLICT");
    add(`${kind}-ambiguous-http-409`, ambiguous, { status: "CONSUMER_REJECTED", operationPhase: kind === "checkout" ? "unknown" : "rejected", operationIssue: kind === "checkout" ? "ambiguous-conflict" : "conflict", commandCalls: 1 });
    const mismatch = await capture(kind); (mismatch.operation!.requestBody as { expectedVersion: number }).expectedVersion++;
    add(`${kind}-request-version-mismatch`, mismatch, { status: "INPUT_INVALID", commandCalls: 0 });
  }
  const noncanonicalKey = await capture("checkout"), request = noncanonicalKey.operation!.requestBody as { idempotencyKey: string }; request.idempotencyKey = ` ${request.idempotencyKey} `;
  add("checkout-request-key-noncanonical", noncanonicalKey, { status: "INPUT_INVALID", commandCalls: 0, keyRequests: 1 });
  const wrongKey = await capture("checkout"); (wrongKey.operation!.body as CheckoutResponse).idempotencyKey = "SYNTHETIC nonmatching saved receipt key";
  add("checkout-receipt-key-mismatch", wrongKey, { status: "CONSUMER_REJECTED", operationPhase: "unknown", operationIssue: "invalid-result", commandCalls: 1, keyRequests: 1 });
  const unchanged = await capture("reprice"); unchanged.validation.body = cartValidationResult(parentCart(unchanged));
  add("reprice-unchanged-context", unchanged, { status: "UNSUPPORTED_CONTEXT", commandCalls: 0, keyRequests: 0 });
  for (const variant of ["changed", "unavailable", "empty"] as const) {
    const input = await capture("checkout"), cart = parentCart(input); if (variant === "empty") cart.items = [];
    input.validation.body = cartValidationResult(cart, variant === "empty" ? "unchanged" : variant);
    add(`checkout-${variant}-context`, input, { status: "UNSUPPORTED_CONTEXT", validationPhase: "ready", commandCalls: 0, keyRequests: 0 });
  }
  const foreignParent = await capture("checkout"); foreignParent.expected.cartId = "00000000-0000-4000-8000-000000099901";
  add("parent-selected-id-mismatch", foreignParent, { status: "CONSUMER_REJECTED", parentPhase: "contract-error", validationCalls: 0, commandCalls: 0, keyRequests: 0 });
  const quoteVersion = await capture("checkout"); (quoteVersion.validation.body as CartValidationResponse).cartVersion++;
  add("validation-parent-version-mismatch", quoteVersion, { status: "CONSUMER_REJECTED", validationIssue: "invalid-result", commandCalls: 0, keyRequests: 0 });
  const quoteLine = await capture("checkout"); (quoteLine.validation.body as CartValidationResponse).items[0]!.cartItemId = "00000000-0000-4000-8000-000000099902";
  add("validation-line-id-mismatch", quoteLine, { status: "CONSUMER_REJECTED", validationIssue: "invalid-result", commandCalls: 0, keyRequests: 0 });
  const oldReprice = await capture("reprice"); (oldReprice.operation!.body as CartResponse).version = oldReprice.expected.cartVersion;
  add("reprice-result-version-not-advanced", oldReprice, { status: "CONSUMER_REJECTED", operationPhase: "unknown", operationIssue: "invalid-result", commandCalls: 1 });
  const foreignReceipt = await capture("checkout"); (foreignReceipt.operation!.body as CheckoutResponse).buyerOrganizationId = "00000000-0000-4000-8000-000000099903";
  add("checkout-receipt-owner-mismatch", foreignReceipt, { status: "CONSUMER_REJECTED", operationPhase: "unknown", operationIssue: "invalid-result", commandCalls: 1 });
  return Object.freeze(rows);
}
