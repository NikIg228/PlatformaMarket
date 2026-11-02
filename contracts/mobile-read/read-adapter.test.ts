import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  catalogSearchResponseSchema,
  offerComparisonResponseSchema,
  supplierOrderResponseSchema,
} from "../../packages/schemas/src/core-api";
import {
  createMobileReadSlot,
  selectComparedOffer,
  type ReadData,
  type ReadScope,
} from "./read-adapter";

const corpus = JSON.parse(readFileSync(new URL("fixtures.json", import.meta.url), "utf8")) as {
  cases: Array<{ id: string; payload: unknown }>;
};
const { scenarios } = JSON.parse(readFileSync(new URL("scenarios.json", import.meta.url), "utf8")) as {
  scenarios: Array<{ id: string; fixture: string; requestScope: ReadScope; activeScope: ReadScope; expectedConsumer: string }>;
};
function fixture(id: string): unknown {
  const entry = corpus.cases.find((entry) => entry.id === id);
  if (!entry) throw new Error(`Missing synthetic fixture: ${id}`);
  return structuredClone(entry.payload);
}
const scope: ReadScope = {
  product: "market", environment: "synthetic-offline",
  userId: "00000000-0000-4000-8000-000000000020",
  organizationId: "00000000-0000-4000-8000-000000000004", generation: 1,
};
const order = supplierOrderResponseSchema.parse(fixture("order-current"));
const comparison = offerComparisonResponseSchema.parse(fixture("comparison-exact-offer"));
const orderTarget = { kind: "order", orderId: order.id } as const;
const comparisonTarget = { kind: "comparison", productId: comparison.product.id, variantId: comparison.selectedVariantId } as const;
type Slot = ReturnType<typeof createMobileReadSlot>;
type ReadValues = { [K in ReadData["kind"]]: Extract<ReadData, { kind: K }>["value"] };
function read<K extends keyof ReadValues>(slot: Slot, kind: K): ReadValues[K] {
  const state = slot.getState();
  if (!("read" in state) || state.read.kind !== kind) throw new Error(`Expected ${kind} data, got ${state.phase}`);
  return state.read.value as ReadValues[K];
}
const complete = (slot: Slot, body: unknown, status = 200) => slot.complete(slot.begin(orderTarget), { status, body });

describe("runtime-neutral mobile read consumer", () => {
  it("consumes catalog → exact variant/offer → existing order without modifying wire values", () => {
    const slot = createMobileReadSlot(scope);
    slot.complete(slot.begin({ kind: "catalog" }), { status: 200, body: fixture("catalog-null-price") });
    const catalog = read(slot, "catalog");
    expect(catalog.items[0]!.offers[0]!.priceMinor).toBeNull();
    slot.complete(slot.begin(comparisonTarget), { status: 200, body: fixture("comparison-exact-offer") });
    const compared = read(slot, "comparison");
    const offer = selectComparedOffer(compared, compared.selectedVariantId!, compared.offers[0]!.offerId);
    expect(offer?.price.amountMinor).toBe("9007199254740993");
    complete(slot, fixture("order-current"));
    const accepted = read(slot, "order");
    expect(accepted.items[0]!.offerId).toBe(offer?.offerId);
    expect(accepted.items[0]!.productVariantId).toBe(offer?.variantId);
    expect(accepted.subtotalAmountMinor).toBe("9007199254740993");
    expect(accepted.items[0]!.quantity).toBe("1.000001");
    expect(accepted.items[0]!.acceptedQuantity).toBeNull();
    expect(Object.hasOwn(accepted, "documents")).toBe(false);
    expect(Object.hasOwn(accepted, "shipments")).toBe(false);
  });

  it.each(scenarios.filter((scenario) => scenario.expectedConsumer === "discard-response"))("discards $id, including late errors", (scenario) => {
    const slot = createMobileReadSlot(scenario.requestScope);
    const old = slot.begin(orderTarget);
    slot.reset(scenario.activeScope);
    const current = slot.begin({ kind: "catalog" });
    expect(slot.complete(old, { status: 403, body: fixture("error-denied") })).toBe("discarded");
    expect(slot.complete(old, { status: 200, body: fixture(scenario.fixture) })).toBe("discarded");
    expect(slot.fail(old)).toBe("discarded");
    expect(slot.getState()).toEqual({ phase: "loading", target: { kind: "catalog" } });
    slot.complete(current, { status: 200, body: fixture("catalog-empty") });
    expect(slot.getState().phase).toBe("empty");
  });

  it("rejects an older search in the same scope and consumes each ticket once", () => {
    const slot = createMobileReadSlot(scope);
    const old = slot.begin({ kind: "catalog" });
    const current = slot.begin({ kind: "catalog" });
    expect(slot.complete(old, { status: 200, body: fixture("catalog-null-price") })).toBe("discarded");
    expect(slot.complete(current, { status: 200, body: fixture("catalog-empty") })).toBe("applied");
    expect(slot.complete(current, { status: 200, body: fixture("catalog-null-price") })).toBe("discarded");
    expect(slot.getState().phase).toBe("empty");
  });

  it("does not accept matching-value forged tickets or tickets from another slot", () => {
    const slot = createMobileReadSlot(scope);
    const ticket = slot.begin(orderTarget);
    const other = createMobileReadSlot(scope).begin(orderTarget);
    expect(slot.complete({ ...ticket }, { status: 200, body: order })).toBe("discarded");
    expect(slot.complete(other, { status: 200, body: order })).toBe("discarded");
    expect(slot.complete(ticket, { status: 200, body: order })).toBe("applied");
  });

  it("clears data on loading/reset and snapshots mutable caller context", () => {
    const mutable = { ...scope };
    const target = { ...orderTarget };
    const slot = createMobileReadSlot(mutable);
    const ticket = slot.begin(target);
    mutable.organizationId = "changed-after-begin";
    target.orderId = "changed-after-begin";
    slot.complete(ticket, { status: 200, body: order });
    expect(slot.getState().phase).toBe("ready");
    const pending = slot.begin(orderTarget);
    expect("read" in slot.getState()).toBe(false);
    slot.reset(scope);
    expect(slot.getState()).toEqual({ phase: "idle" });
    expect(slot.complete(pending, { status: 200, body: order })).toBe("discarded");
  });

  it("keeps a newer accepted same-order read when a current refresh is older", () => {
    const slot = createMobileReadSlot(scope);
    complete(slot, { ...order, version: 8 });
    complete(slot, order);
    expect(read(slot, "order").version).toBe(8);
    complete(slot, { ...order, version: 9 });
    expect(read(slot, "order").version).toBe(9);
  });

  it("does not compare versions across entities, projections or scope resets", () => {
    const slot = createMobileReadSlot(scope);
    const otherId = "00000000-0000-4000-8000-000000000023";
    slot.complete(slot.begin({ kind: "order", orderId: otherId }), { status: 200, body: { ...order, id: otherId, version: 80 } });
    complete(slot, order);
    expect(read(slot, "order").version).toBe(7);
    slot.complete(slot.begin({ kind: "workflow", orderId: order.id }), { status: 200, body: fixture("order-workflow-minimal") });
    expect(read(slot, "workflow").version).toBe(7);
    slot.reset({ ...scope, generation: 2 });
    complete(slot, { ...order, version: 1 });
    expect(read(slot, "order").version).toBe(1);
  });

  it("preserves omitted optional workflow projections and explicit nulls", () => {
    const slot = createMobileReadSlot(scope);
    slot.complete(slot.begin({ kind: "workflow", orderId: order.id }), { status: 200, body: fixture("order-workflow-minimal") });
    const workflow = read(slot, "workflow");
    expect(workflow.invoiceDocumentId).toBeNull();
    for (const key of ["paymentSummary", "reservationState", "returns", "reductions"]) expect(Object.hasOwn(workflow, key)).toBe(false);
  });

  it("preserves explicit zero without converting a null price into zero", () => {
    const slot = createMobileReadSlot(scope);
    const catalog = catalogSearchResponseSchema.parse(fixture("catalog-null-price"));
    catalog.items[0]!.offers[0]!.priceMinor = "0";
    slot.complete(slot.begin({ kind: "catalog" }), { status: 200, body: catalog });
    expect(read(slot, "catalog").items[0]!.offers[0]!.priceMinor).toBe("0");
    expect(read(slot, "catalog").items[0]!.offers[0]!.normalizedPriceMinor).toBeNull();
  });

  it("preserves unknown detail status as unsupported but rejects a closed workspace enum", () => {
    const slot = createMobileReadSlot(scope);
    complete(slot, fixture("order-detail-future-status"));
    expect(slot.getState().phase).toBe("unsupported");
    expect(read(slot, "order").status).toBe(supplierOrderResponseSchema.parse(fixture("order-detail-future-status")).status);
    slot.complete(slot.begin({ kind: "workspace-orders" }), { status: 200, body: fixture("workspace-unknown-enum") });
    expect(slot.getState()).toEqual({ phase: "contract-error" });
  });

  it.each([
    ["error-denied", 403, "denied"], ["error-not-found", 404, "unavailable"],
    ["error-throttled", 429, "retry-limited"], ["error-opaque-message", 409, "error"],
  ] as const)("handles %s without exposing previous data or parsing prose", (id, status, phase) => {
    const slot = createMobileReadSlot(scope);
    complete(slot, order);
    complete(slot, fixture(id), status);
    expect(slot.getState().phase).toBe(phase);
    expect("read" in slot.getState()).toBe(false);
    expect("message" in slot.getState()).toBe(false);
    expect("details" in slot.getState()).toBe(false);
    complete(slot, { ...order, version: 1 });
    expect(read(slot, "order").version).toBe(1);
  });

  it("uses HTTP status even when code/prose suggest a different business decision", () => {
    const slot = createMobileReadSlot(scope);
    const error = fixture("error-denied") as Record<string, unknown>;
    complete(slot, { ...error, statusCode: 401, code: "FORBIDDEN", message: "Retry in 5 seconds", requestId: "synthetic-request" }, 401);
    expect(slot.getState()).toEqual({ phase: "authentication-required", requestId: "synthetic-request" });
    complete(slot, { ...error, statusCode: 500, code: "FORBIDDEN", message: "permission denied" }, 500);
    expect(slot.getState()).toEqual({ phase: "error" });
  });

  it.each([
    [403, "error-missing-code"], [500, "error-denied"], [200, "error-denied"], [204, "catalog-empty"],
  ])("rejects incompatible response %s / %s", (status, id) => {
    const slot = createMobileReadSlot(scope);
    complete(slot, fixture(id as string), status as number);
    expect(slot.getState()).toEqual({ phase: "contract-error" });
  });

  it("fails transport without preserving old data and allows explicit recovery", () => {
    const slot = createMobileReadSlot(scope);
    complete(slot, order);
    const ticket = slot.begin(orderTarget);
    expect(slot.fail(ticket)).toBe("applied");
    expect(slot.getState()).toEqual({ phase: "error" });
    expect(slot.fail(ticket)).toBe("discarded");
    complete(slot, order);
    expect(slot.getState().phase).toBe("ready");
  });

  it("rejects a different order, unrelated organization, or mismatched nested workflow identity", () => {
    const slot = createMobileReadSlot(scope);
    complete(slot, { ...order, id: "00000000-0000-4000-8000-000000000023" });
    expect(slot.getState()).toEqual({ phase: "contract-error" });
    const unrelated = createMobileReadSlot({ ...scope, organizationId: "00000000-0000-4000-8000-000000000024" });
    complete(unrelated, order);
    expect(unrelated.getState()).toEqual({ phase: "contract-error" });
    const workflow = fixture("order-workflow-minimal") as Record<string, unknown>;
    slot.complete(slot.begin({ kind: "workflow", orderId: order.id }), {
      status: 200, body: { ...workflow, order: { ...order, id: "00000000-0000-4000-8000-000000000023" } },
    });
    expect(slot.getState()).toEqual({ phase: "contract-error" });
  });

  it("binds the exact product/variant and never chooses the first unrelated offer", () => {
    const slot = createMobileReadSlot(scope);
    slot.complete(slot.begin({ ...comparisonTarget, productId: order.id }), { status: 200, body: comparison });
    expect(slot.getState()).toEqual({ phase: "contract-error" });
    slot.complete(slot.begin({ ...comparisonTarget, variantId: order.id }), { status: 200, body: comparison });
    expect(slot.getState()).toEqual({ phase: "contract-error" });
    expect(selectComparedOffer(comparison, order.id, comparison.offers[0]!.offerId)).toBeNull();
    expect(selectComparedOffer(comparison, comparison.selectedVariantId!, order.id)).toBeNull();
    expect(selectComparedOffer({ ...comparison, offers: [{ ...comparison.offers[0]!, variantId: order.id }] }, comparison.selectedVariantId!, comparison.offers[0]!.offerId)).toBeNull();
  });

  it("keeps empty comparison and workspace reads distinct from errors", () => {
    const slot = createMobileReadSlot(scope);
    slot.complete(slot.begin({ ...comparisonTarget, variantId: null }), { status: 200, body: fixture("comparison-no-offer") });
    expect(slot.getState().phase).toBe("empty");
    slot.complete(slot.begin({ kind: "workspace-orders" }), { status: 200, body: fixture("workspace-null-action") });
    expect(read(slot, "workspace-orders").items[0]!.nextAction).toBeNull();
    slot.complete(slot.begin({ kind: "workspace-orders" }), { status: 200, body: { items: [], nextCursor: null } });
    expect(slot.getState().phase).toBe("empty");
  });
});
