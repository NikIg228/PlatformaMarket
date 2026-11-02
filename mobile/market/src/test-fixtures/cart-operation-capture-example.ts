import { createScopedCoreReadQueries } from "../scoped-core-read-queries";
import { bindMarketReads } from "../market-transport";
import { cartCommandScope, commandCart } from "./cart-commands";
import { savedPage } from "./carts";
import { cartValidationResult } from "./cart-validation";
import { repriceValidation, repriceResult } from "./cart-reprice";
import { cartCheckoutReceipt } from "./cart-checkout";
import type { CartCheckoutInput, CartRepriceInput } from "../cart-command-fixture";
import { createCartCaptureKernel } from "./cart-operation-capture-kernel";
import type { CartCaptureKind } from "./cart-operation-capture-replay";

type Record = { method: "GET" | "POST"; path: string; httpStatus: number; body: unknown; requestBody?: unknown };
export type CartCaptureExample = {
  formatVersion: 1; kind: CartCaptureKind; scope: typeof cartCommandScope;
  expected: { cartId: string; cartVersion: number };
  query: { kind: "workspace-carts"; input: { limit: number; q: string } };
  parent: Record; validation: Record; operation?: Record;
};
/** Paths and request bodies come from actual source readers/models/adapters; data is explicitly synthetic. */
export async function cartOperationCaptureExample(kind: CartCaptureKind = "validation", variant: "unchanged" | "changed" | "unavailable" | "empty" | "COMPLETED" | "PROCESSING" | "FAILED" = "unchanged"): Promise<CartCaptureExample> {
  const scope = Object.freeze({ ...cartCommandScope, environment: "https://market.example.invalid/api" });
  const cart = commandCart(3); if (variant === "empty") cart.items = [];
  const pageBody = savedPage(cart, []), query = { kind: "workspace-carts" as const, input: { limit: 1, q: "" } };
  let parent: Record | undefined, validation: Record | undefined, operation: Record | undefined;
  const client = bindMarketReads(async path => { parent = { method: "GET", path, httpStatus: 200, body: pageBody }; return pageBody; }, scope.organizationId);
  const queries = createScopedCoreReadQueries(scope, client);
  let kernel: ReturnType<typeof createCartCaptureKernel> | undefined;
  try {
    await queries.load(query); const state = queries.getState();
    if (!("read" in state) || state.read.kind !== "workspace-carts") throw Error("Synthetic cart parent was rejected");
    const page = state.read.value;
    const quote = kind === "reprice" ? repriceValidation(cart) : cartValidationResult(cart, ["changed", "unavailable"].includes(variant) ? variant as "changed" | "unavailable" : "unchanged");
    kernel = createCartCaptureKernel(scope, page, async (method, path, requestBody) => {
      if (method !== "POST") throw Error("Synthetic cart operation must use POST");
      if (!validation) { if (requestBody !== undefined) throw Error("Synthetic validation must be bodyless"); validation = { method, path, httpStatus: 200, body: quote }; return quote; }
      const body = kind === "reprice" ? repriceResult(cart, requestBody as CartRepriceInput) : cartCheckoutReceipt(cart, requestBody as CartCheckoutInput, ["COMPLETED", "PROCESSING", "FAILED"].includes(variant) ? variant as "COMPLETED" | "PROCESSING" | "FAILED" : "COMPLETED");
      operation = { method, path, httpStatus: 200, requestBody, body }; return body;
    }, () => "00000000-0000-4000-8000-000000093001");
    await kernel.validation.validate(page);
    if (!kernel.validation.resultFor(page)) throw Error("Synthetic validation was rejected");
    if (kind === "reprice") { if (!kernel.reprice.prepare(page)) throw Error("Synthetic reprice was unsupported"); await kernel.reprice.confirm(); if (!kernel.reprice.resultCart()) throw Error("Synthetic reprice was rejected"); }
    if (kind === "checkout") { if (!kernel.checkout.prepare(page)) throw Error("Synthetic checkout was unsupported"); await kernel.checkout.confirm(cart.id); if (!kernel.checkout.receiptFor(cart.id)) throw Error("Synthetic checkout was rejected"); }
    if (!parent || !validation || kind !== "validation" && !operation || kernel.reloads()) throw Error("Synthetic cart capture was incomplete");
    return { formatVersion: 1, kind, scope, expected: { cartId: cart.id, cartVersion: cart.version }, query, parent, validation, ...(operation ? { operation } : {}) };
  } finally { kernel?.close(); queries.reset(scope, client); }
}
