import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { orderWorkflowResponseSchema } from "../../packages/schemas/src/order-workflow";
import { offerComparisonResponseSchema } from "../../packages/schemas/src/core-api";
import { createMobileReadQueries, type MobileReadClient } from "./read-queries";
import type { ReadScope } from "./read-adapter";

const corpus = JSON.parse(readFileSync(new URL("fixtures.json", import.meta.url), "utf8")) as {
  cases: Array<{ id: string; payload: unknown }>;
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
const workflow = orderWorkflowResponseSchema.parse(fixture("order-workflow-minimal"));
const comparison = offerComparisonResponseSchema.parse(fixture("comparison-exact-offer"));
const workflowQuery = { kind: "workflow", orderId: workflow.orderId } as const;
const catalogQuery = { kind: "catalog", input: { q: "SYNTHETIC" } } as const;
function fakeClient() {
  return {
    searchCatalog: vi.fn<MobileReadClient["searchCatalog"]>().mockResolvedValue(fixture("catalog-null-price")),
    compareOffers: vi.fn<MobileReadClient["compareOffers"]>().mockResolvedValue(fixture("comparison-exact-offer")),
    workspaceOrders: vi.fn<MobileReadClient["workspaceOrders"]>().mockResolvedValue(fixture("workspace-orders-page")),
    getOrderWorkflow: vi.fn<MobileReadClient["getOrderWorkflow"]>().mockResolvedValue(fixture("order-workflow-minimal")),
  };
}
function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<unknown>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("existing read methods → mobile consumer → explicit recovery", () => {
  it("performs the synthetic catalog/variant/offer/workflow path using only existing methods", async () => {
    const client = fakeClient();
    const reads = createMobileReadQueries(scope, client);
    expect(reads.getState()).toEqual({ phase: "idle" });
    const pending = reads.load(catalogQuery);
    expect(reads.getState()).toEqual({ phase: "loading", target: { kind: "catalog" } });
    expect(await pending).toBe("applied");
    expect(client.searchCatalog).toHaveBeenCalledExactlyOnceWith({ q: "SYNTHETIC", buyerOrganizationId: scope.organizationId });
    const quantity = "1.000001";
    await reads.load({ kind: "comparison", input: { productId: comparison.product.id, variantId: comparison.selectedVariantId!, quantity } });
    expect(client.compareOffers).toHaveBeenCalledExactlyOnceWith({ productId: comparison.product.id, variantId: comparison.selectedVariantId, quantity, buyerOrganizationId: scope.organizationId });
    expect(reads.getState().phase).toBe("ready");
    await reads.load(workflowQuery);
    expect(client.getOrderWorkflow).toHaveBeenCalledExactlyOnceWith(workflow.orderId);
    const state = reads.getState();
    if (!("read" in state) || state.read.kind !== "workflow") throw new Error("Expected workflow read");
    expect(state.read.value.order.items[0]!.offerId).toBe(comparison.offers[0]!.offerId);
    expect(state.read.value.order.subtotalAmountMinor).toBe("9007199254740993");
    expect(Object.hasOwn(state.read.value, "paymentSummary")).toBe(false);
    expect(client.workspaceOrders).not.toHaveBeenCalled();
  });

  it("overrides caller-supplied catalog/compare organization with the active context", async () => {
    const client = fakeClient();
    const reads = createMobileReadQueries(scope, client);
    const catalogInput = { q: "SYNTHETIC", buyerOrganizationId: "caller-selected-organization", inStock: "true" as const, minSalePriceMinor: "9007199254740993" };
    await reads.load({ kind: "catalog", input: catalogInput });
    expect(client.searchCatalog.mock.calls[0]![0]).toEqual({ ...catalogInput, buyerOrganizationId: scope.organizationId });
    const compareInput = { productId: comparison.product.id, buyerOrganizationId: "caller-selected-organization" };
    await reads.load({ kind: "comparison", input: compareInput });
    expect(client.compareOffers.mock.calls[0]![0]).toEqual({ productId: comparison.product.id, buyerOrganizationId: scope.organizationId });
  });

  it("passes opaque cursor/filters through the real workspace query schema without tenant fields", async () => {
    const client = fakeClient();
    const reads = createMobileReadQueries(scope, client);
    const input = { q: "A & B", cursor: "opaque+/=", status: "PAID" as const, limit: 25, buyerOrganizationId: "foreign", organizationId: "foreign", actorId: "foreign" };
    await reads.load({ kind: "workspace-orders", input });
    expect(client.workspaceOrders).toHaveBeenCalledExactlyOnceWith("buyer", { q: "A & B", cursor: "opaque+/=", status: "PAID", limit: 25 });
    expect(reads.getState().phase).toBe("ready");
    await reads.load({ kind: "workspace-orders", input: { limit: 101 } });
    expect(client.workspaceOrders).toHaveBeenCalledTimes(1);
    expect(reads.getState()).toEqual({ phase: "error" });
  });

  it.each([
    ["error-denied", 403, "denied"], ["error-not-found", 404, "unavailable"],
    ["error-throttled", 429, "retry-limited"], ["error-opaque-message", 409, "error"],
  ] as const)("keeps %s recoverable only by an explicit new read", async (id, status, phase) => {
    const client = fakeClient();
    client.getOrderWorkflow.mockRejectedValueOnce({ status, payload: fixture(id) });
    const reads = createMobileReadQueries(scope, client);
    await reads.load(workflowQuery);
    expect(reads.getState().phase).toBe(phase);
    expect("read" in reads.getState()).toBe(false);
    await Promise.resolve();
    expect(client.getOrderWorkflow).toHaveBeenCalledTimes(1);
    expect(await reads.refresh()).toBe("applied");
    expect(client.getOrderWorkflow).toHaveBeenCalledTimes(2);
    expect(reads.getState().phase).toBe("ready");
  });

  it("recovers a rejected response contract without loosening its schema", async () => {
    const client = fakeClient();
    client.getOrderWorkflow.mockResolvedValueOnce(fixture("workflow-null-summary"));
    const reads = createMobileReadQueries(scope, client);
    await reads.load(workflowQuery);
    expect(reads.getState()).toEqual({ phase: "contract-error" });
    await reads.refresh();
    expect(reads.getState().phase).toBe("ready");
  });

  it.each([
    [{ status: 403, payload: fixture("error-missing-code") }, "contract-error"],
    [{ status: 500, payload: fixture("error-denied") }, "contract-error"],
    [{ status: 200, payload: fixture("order-workflow-minimal") }, "error"],
    [new Error("Untrusted transport prose: FORBIDDEN, retry now"), "error"],
  ])("keeps malformed thrown values out of successful data", async (error, phase) => {
    const client = fakeClient();
    client.getOrderWorkflow.mockRejectedValueOnce(error);
    const reads = createMobileReadQueries(scope, client);
    await reads.load(workflowQuery);
    expect(reads.getState()).toEqual({ phase });
    expect(client.getOrderWorkflow).toHaveBeenCalledTimes(1);
  });

  it("handles a synchronous method failure with the same safe recovery path", async () => {
    const client = fakeClient();
    client.getOrderWorkflow.mockImplementationOnce(() => { throw new Error("synthetic synchronous failure"); });
    const reads = createMobileReadQueries(scope, client);
    await reads.load(workflowQuery);
    expect(reads.getState()).toEqual({ phase: "error" });
    await reads.refresh();
    expect(reads.getState().phase).toBe("ready");
  });

  it("snapshots query filters for manual refresh without coercing exact input strings", async () => {
    const client = fakeClient();
    client.searchCatalog.mockRejectedValueOnce(new Error("synthetic offline"));
    const reads = createMobileReadQueries(scope, client);
    const input = { q: "first", inStock: "true" as const, minSalePriceMinor: "9007199254740993", attributeFilters: '{"synthetic":"a&b"}' };
    await reads.load({ kind: "catalog", input });
    input.q = "changed";
    input.minSalePriceMinor = "0";
    await reads.refresh();
    expect(client.searchCatalog.mock.calls[1]![0]).toEqual({ q: "first", inStock: "true", minSalePriceMinor: "9007199254740993", attributeFilters: '{"synthetic":"a&b"}', buyerOrganizationId: scope.organizationId });
  });

  it("discards a late success and a late failure after newer queries complete", async () => {
    const client = fakeClient();
    const oldSuccess = deferred();
    const oldFailure = deferred();
    client.searchCatalog.mockReturnValueOnce(oldSuccess.promise).mockReturnValueOnce(oldFailure.promise).mockResolvedValue(fixture("catalog-empty"));
    const reads = createMobileReadQueries(scope, client);
    const first = reads.load({ kind: "catalog", input: { q: "first" } });
    const second = reads.load({ kind: "catalog", input: { q: "second" } });
    await reads.load({ kind: "catalog", input: { q: "latest" } });
    oldSuccess.resolve(fixture("catalog-null-price"));
    oldFailure.reject({ status: 403, payload: fixture("error-denied") });
    expect(await first).toBe("discarded");
    expect(await second).toBe("discarded");
    expect(reads.getState().phase).toBe("empty");
    await reads.refresh();
    expect(client.searchCatalog.mock.calls.at(-1)![0].q).toBe("latest");
  });

  it.each([
    { ...scope, generation: 2 },
    { ...scope, organizationId: "00000000-0000-4000-8000-000000000024", generation: 2 },
    { ...scope, userId: "00000000-0000-4000-8000-000000000022", generation: 2 },
    { ...scope, environment: "synthetic-other", generation: 2 },
  ])("invalidates pending reads and recovery on context reset %#", async (nextScope) => {
    const oldClient = fakeClient();
    const newClient = fakeClient();
    const pending = deferred();
    oldClient.getOrderWorkflow.mockReturnValueOnce(pending.promise);
    const reads = createMobileReadQueries(scope, oldClient);
    const old = reads.load(workflowQuery);
    reads.reset(nextScope, newClient);
    expect(reads.getState()).toEqual({ phase: "idle" });
    expect(await reads.refresh()).toBe("no-query");
    expect(newClient.getOrderWorkflow).not.toHaveBeenCalled();
    await reads.load(catalogQuery);
    pending.resolve(fixture("order-workflow-minimal"));
    expect(await old).toBe("discarded");
    expect(reads.getState().phase).toBe("ready");
    await reads.refresh();
    expect(newClient.searchCatalog).toHaveBeenCalledTimes(2);
    expect(newClient.searchCatalog.mock.calls[1]![0].buyerOrganizationId).toBe(nextScope.organizationId);
    expect(oldClient.searchCatalog).not.toHaveBeenCalled();
    expect(oldClient.getOrderWorkflow).toHaveBeenCalledTimes(1);
  });

  it("does not let a late unauthorized failure clear the new session view", async () => {
    const oldClient = fakeClient();
    const newClient = fakeClient();
    const pending = deferred();
    oldClient.getOrderWorkflow.mockReturnValueOnce(pending.promise);
    const reads = createMobileReadQueries(scope, oldClient);
    const old = reads.load(workflowQuery);
    reads.reset({ ...scope, generation: 2 }, newClient);
    await reads.load(catalogQuery);
    pending.reject({ status: 401, payload: { ...(fixture("error-denied") as object), statusCode: 401 } });
    expect(await old).toBe("discarded");
    expect(reads.getState().phase).toBe("ready");
  });

  it("preserves the existing method receiver rather than extracting an unbound method", async () => {
    let receiver: unknown;
    const client = fakeClient();
    client.searchCatalog.mockImplementation(function (this: MobileReadClient) {
      receiver = this;
      return Promise.resolve(fixture("catalog-empty"));
    });
    const reads = createMobileReadQueries(scope, client);
    await reads.load(catalogQuery);
    expect(receiver).toBe(client);
    expect(reads.getState().phase).toBe("empty");
  });

  it("does not issue any request before load or after a reset without a new query", async () => {
    const client = fakeClient();
    const reads = createMobileReadQueries(scope, client);
    expect(await reads.refresh()).toBe("no-query");
    reads.reset(scope, client);
    expect(await reads.refresh()).toBe("no-query");
    for (const method of Object.values(client)) expect(method).not.toHaveBeenCalled();
  });
});
