import { z } from "zod";
import { errorResponseSchema } from "../../../packages/schemas/src/core-api";
import type { ReadScope } from "../../../contracts/mobile-read/read-adapter";

// Local synthetic fixture projection of OwnersService.buyerDashboard only.
// buyer-web has local TS types, not an accepted shared CURRENT response schema.
// No root organization/cart owner is supplied: captured port scope is provenance,
// never proof of cart ownership or permission; linked reads must verify separately.
const orderBinding = z.object({ id: z.uuid(), buyerOrganizationId: z.uuid() });
const orderProjection = orderBinding.extend({ orderNumber: z.string(), status: z.string(), createdAt: z.string(), supplier: z.object({ displayName: z.string() }) });
const count = z.number().int().nonnegative();
const projection = z.object({ activeCart: z.object({ id: z.uuid(), itemCount: count, updatedAt: z.string() }).nullable(), pendingOrders: count, savedLists: count, recentOrders: z.array(orderProjection).max(8) });
export type BuyerDashboardFixture = z.output<typeof projection>;
export type BuyerDashboardFixturePort = (scope: ReadScope) => Promise<unknown>;
export type BuyerDashboardFixtureClient = { buyerDashboardFixture?: BuyerDashboardFixturePort };
export type BuyerDashboardFixtureState = { phase: "idle" } | { phase: "loading"; target: { kind: "buyer-dashboard" } }
  | { phase: "ready"; read: { kind: "buyer-dashboard"; value: BuyerDashboardFixture } }
  | { phase: "contract-error" | "authentication-required" | "denied" | "unavailable" | "retry-limited" | "error" };

export function decodeBuyerDashboardFixture(body: unknown, scope: ReadScope): BuyerDashboardFixture | null {
  // Reject foreign/ambiguous order contexts before reading numbers, names or dates.
  const identities = z.object({ recentOrders: z.array(orderBinding).max(8) }).safeParse(body);
  if (!identities.success || identities.data.recentOrders.some(order => order.buyerOrganizationId !== scope.organizationId) || new Set(identities.data.recentOrders.map(order => order.id)).size !== identities.data.recentOrders.length) return null;
  const parsed = projection.safeParse(body);
  return parsed.success ? parsed.data : null;
}
function failure(error: unknown): BuyerDashboardFixtureState {
  if (typeof error !== "object" || error === null || !("status" in error) || !("payload" in error)) return { phase: "error" };
  const status = error.status, parsed = errorResponseSchema.safeParse(error.payload);
  if (typeof status !== "number" || !Number.isInteger(status) || status < 300 || status > 599 || !parsed.success || parsed.data.statusCode !== status) return { phase: "contract-error" };
  return { phase: status === 401 ? "authentication-required" : status === 403 ? "denied" : status === 404 ? "unavailable" : status === 429 ? "retry-limited" : "error" };
}
/** Explicit scope-bound synthetic reader; no URL, native HTTP binding or samples. */
export function createBuyerDashboardFixtureRead(scope: ReadScope, port?: BuyerDashboardFixturePort) {
  const owner = Object.freeze({ ...scope });
  let state: BuyerDashboardFixtureState = { phase: "idle" }, pending: object | null = null;
  return {
    getState: () => state,
    reset() { pending = null; state = { phase: "idle" }; },
    async load(): Promise<"applied" | "discarded"> {
      const ticket = {}; pending = ticket; state = { phase: "loading", target: { kind: "buyer-dashboard" } };
      let next: BuyerDashboardFixtureState;
      try {
        if (!port) next = { phase: "unavailable" };
        else {
          const body = await port(owner); if (pending !== ticket) return "discarded";
          const value = decodeBuyerDashboardFixture(body, owner);
          next = value ? { phase: "ready", read: { kind: "buyer-dashboard", value } } : { phase: "contract-error" };
        }
      } catch (error) { if (pending !== ticket) return "discarded"; next = failure(error); }
      if (pending !== ticket) return "discarded";
      pending = null; state = next; return "applied";
    },
  };
}
