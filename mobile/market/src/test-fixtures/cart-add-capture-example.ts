import type { CartAddInput } from "../cart-command-fixture";
import { createScopedCoreReadQueries } from "../scoped-core-read-queries";
import { bindMarketReads } from "../market-transport";
import { savedPage } from "./carts";
import { addCartItemResult, addCommandCart, cartAddComparison, cartCommandScope } from "./cart-commands";
import { createCartAddCaptureKernel } from "./cart-add-capture-kernel";

type CaptureRecord = { method: "GET" | "POST"; path: string; httpStatus: number; body: unknown; requestBody?: unknown };
export type CartAddCaptureExample = {
  formatVersion: 1; kind: "cart-add"; scope: typeof cartCommandScope;
  expected: { cartId: string; cartVersion: number; offerId: string };
  comparisonQuery: { kind: "comparison"; input: { productId: string; variantId: string; quantity: string } };
  cartQuery: { kind: "workspace-carts"; input: { limit: number; q: string } };
  comparison: CaptureRecord; parent: CaptureRecord; operation: CaptureRecord;
};
/** Synthetic data; both GET paths and the POST input come from existing source factories. */
export async function cartAddCaptureExample(withOffer = true): Promise<CartAddCaptureExample> {
  const scope = Object.freeze({ ...cartCommandScope, environment: "https://market.example.invalid/api" }), comparisonBody = cartAddComparison(), pageBody = savedPage(addCommandCart(3, "2", withOffer), []);
  const comparisonQuery = { kind: "comparison" as const, input: { productId: comparisonBody.product.id, variantId: comparisonBody.selectedVariantId!, quantity: "1.000000" } }, cartQuery = { kind: "workspace-carts" as const, input: { limit: 1, q: "" } };
  let comparison: CaptureRecord | undefined, parent: CaptureRecord | undefined, operation: CaptureRecord | undefined, kernel: ReturnType<typeof createCartAddCaptureKernel> | undefined;
  const client = bindMarketReads(async path => {
    if (!comparison) { comparison = { method: "GET", path, httpStatus: 200, body: comparisonBody }; return comparisonBody; }
    parent = { method: "GET", path, httpStatus: 200, body: pageBody }; return pageBody;
  }, scope.organizationId), comparisons = createScopedCoreReadQueries(scope, client), carts = createScopedCoreReadQueries(scope, client);
  try {
    await comparisons.load(comparisonQuery); await carts.load(cartQuery);
    const compared = comparisons.getState(), current = carts.getState();
    if (!("read" in compared) || compared.read.kind !== "comparison" || !("read" in current) || current.read.kind !== "workspace-carts" || !current.read.value.current) throw Error("Synthetic add parents rejected");
    const value = compared.read.value, page = current.read.value, cart = page.current!, offerId = value.offers[0]!.offerId;
    kernel = createCartAddCaptureKernel(scope, value, page, async (method, path, requestBody) => {
      if (method !== "POST") throw Error("Unexpected synthetic add method");
      const body = addCartItemResult(cart, requestBody as CartAddInput); operation = { method, path, httpStatus: 200, requestBody, body }; return body;
    });
    const target = kernel.list.begin(value, offerId); if (!target) throw Error("Synthetic add target unavailable");
    kernel.list.setText(target, "quantityText", "3.5"); if (kernel.model.select(target, value) !== "selected") throw Error("Synthetic add selection rejected");
    await kernel.model.submit(page);
    if (!comparison || !parent || !operation || !kernel.model.resultCartId() || kernel.reloads()) throw Error("Synthetic add response rejected or incomplete");
    return { formatVersion: 1, kind: "cart-add", scope, expected: { cartId: cart.id, cartVersion: cart.version, offerId }, comparisonQuery, cartQuery, comparison, parent, operation };
  } finally { kernel?.close(); comparisons.reset(scope, client); carts.reset(scope, client); }
}
