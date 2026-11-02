import { NativePaymentIntentReadError, nativePaymentIntentReadsAvailable, type NativePaymentIntentReads } from "./native-payment-intent-reads";
import { z } from "zod";
import { errorResponseSchema, type CheckoutResponse } from "../../../packages/schemas/src/core-api";
import type { ReadScope } from "../../../contracts/mobile-read/read-adapter";

// Legacy decoder below is source-derived LOCAL FIXTURE only, NOT accepted CURRENT DTOs.
// Native path is separate: its scoped port validates a closed source projection before returning it.
// checkoutResponseSchema has NO typed paymentIntent field; CommerceService's
// GET includes the raw Prisma relation. A passthrough extension is never trusted.
const identity = z.object({ id: z.uuid(), checkoutId: z.uuid(), buyerOrganizationId: z.uuid() });
const pointer = identity.extend({ status: z.string() });
const targetSchema = z.object({ paymentIntentId: z.uuid(), checkoutId: z.uuid() });
export type PaymentIntentFixtureTarget = Readonly<z.output<typeof targetSchema>>;
export type CheckoutIntentPointer = { kind: "none" | "unavailable" } | { kind: "available"; id: string; status: string };
export function checkoutIntentFixturePointer(checkout: CheckoutResponse, buyerOrganizationId: string): CheckoutIntentPointer {
  if (checkout.buyerOrganizationId !== buyerOrganizationId) return { kind: "unavailable" };
  const raw = checkout.paymentIntent;
  if (raw === null) return { kind: "none" };
  const binding = identity.safeParse(raw);
  if (!binding.success || binding.data.checkoutId !== checkout.id || binding.data.buyerOrganizationId !== buyerOrganizationId) return { kind: "unavailable" };
  const parsed = pointer.safeParse(raw);
  return parsed.success && parsed.data.checkoutId === checkout.id && parsed.data.buyerOrganizationId === buyerOrganizationId ? { kind: "available", id: parsed.data.id, status: parsed.data.status } : { kind: "unavailable" };
}
// Exactly the current Prisma PaymentIntentStatus vocabulary, for display only.
export const fixtureIntentStatuses = Object.freeze(["DRAFT", "AWAITING_CONFIRMATION", "PENDING", "PROCESSING", "AUTHORIZED", "PARTIALLY_CAPTURED", "CAPTURED", "PARTIALLY_REFUNDED", "REFUNDED", "FAILED", "CANCELLED", "EXPIRED"] as const);
export type FixtureIntentStatus = typeof fixtureIntentStatuses[number];
export type PaymentIntentFixture = Readonly<{ id: string; checkoutId: string; buyerOrganizationId: string; status: string; totalAmountMinor: string | null; currency: string | null; provider: { name: string | null; code: string | null } | null; createdAt: string | undefined; updatedAt: string | undefined; expiresAt: string | null | undefined }>;
export type PaymentIntentFixturePort = (scope: ReadScope, target: PaymentIntentFixtureTarget) => Promise<unknown>;
export type PaymentIntentFixtureClient = { paymentIntentFixture?: PaymentIntentFixturePort };
export type PaymentIntentFixtureState = { phase: "idle" } | { phase: "loading"; target: { kind: "payment-intent" } }
  | { phase: "ready"; read: { kind: "payment-intent"; value: PaymentIntentFixture } }
  | { phase: "contract-error" | "authentication-required" | "denied" | "unavailable" | "retry-limited" | "error" };
const integerText = z.string().regex(/^-?\d{1,20}$/); // Prisma Decimal(20,0), local string fixtures only.
const currencyText = z.string().regex(/^[A-Z]{3}$/);
const own = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
export function decodePaymentIntentFixture(body: unknown, scope: ReadScope, target: PaymentIntentFixtureTarget): PaymentIntentFixture | null {
  const binding = identity.safeParse(body);
  if (!binding.success || binding.data.id !== target.paymentIntentId || binding.data.checkoutId !== target.checkoutId || binding.data.buyerOrganizationId !== scope.organizationId || !own(body)) return null;
  // Provider association is checked before name/code or any optional display data.
  const providerId = z.uuid().safeParse(body.providerId), rawProvider = body.provider;
  let provider: PaymentIntentFixture["provider"] = null;
  if (providerId.success && own(rawProvider)) {
    const nestedId = z.uuid().safeParse(rawProvider.id);
    if (nestedId.success && nestedId.data !== providerId.data) return null;
    if (nestedId.success) provider = { name: typeof rawProvider.name === "string" ? rawProvider.name : null, code: typeof rawProvider.code === "string" ? rawProvider.code : null };
  }
  if (typeof body.status !== "string") return null;
  const amount = integerText.safeParse(body.totalAmountMinor), currency = currencyText.safeParse(body.currency);
  // Unsupported raw wire representations remain unknown; no Number/BigInt
  // conversion, minor-unit scaling, sums or equality with checkout amounts.
  return { ...binding.data, status: body.status, totalAmountMinor: amount.success ? amount.data : null, currency: currency.success ? currency.data : null, provider,
    createdAt: typeof body.createdAt === "string" ? body.createdAt : undefined, updatedAt: typeof body.updatedAt === "string" ? body.updatedAt : undefined,
    expiresAt: body.expiresAt === null || typeof body.expiresAt === "string" ? body.expiresAt : undefined };
}
function failure(error: unknown): PaymentIntentFixtureState {
  if (error instanceof NativePaymentIntentReadError) return { phase: error.code === "scope" ? "authentication-required" : "contract-error" };
  if (!own(error) || !("status" in error) || !("payload" in error)) return { phase: "error" };
  const status = error.status, parsed = errorResponseSchema.safeParse(error.payload);
  if (typeof status !== "number" || !Number.isInteger(status) || status < 300 || status > 599 || !parsed.success || parsed.data.statusCode !== status) return { phase: "contract-error" };
  return { phase: status === 401 ? "authentication-required" : status === 403 ? "denied" : status === 404 ? "unavailable" : status === 429 ? "retry-limited" : "error" };
}
export function createPaymentIntentFixtureRead(scope: ReadScope, port?: PaymentIntentFixturePort, native?: NativePaymentIntentReads) {
  const owner = Object.freeze({ ...scope });
  let state: PaymentIntentFixtureState = { phase: "idle" }, pending: object | null = null, last: PaymentIntentFixtureTarget | null = null;
  const load = async (input: PaymentIntentFixtureTarget): Promise<"applied" | "discarded"> => {
    const ticket = {}; pending = ticket;
    const parsed = targetSchema.safeParse(input);
    if (!parsed.success) { pending = null; last = null; state = { phase: "contract-error" }; return "applied"; }
    const target = Object.freeze({ ...parsed.data }); last = target; state = { phase: "loading", target: { kind: "payment-intent" } };
    let next: PaymentIntentFixtureState;
    try {
      if (!port && nativePaymentIntentReadsAvailable(native, owner)) { const value = await native!.read(owner, target); if (pending !== ticket) return "discarded"; next = { phase: "ready", read: { kind: "payment-intent", value } }; }
      else if (!port) next = { phase: "unavailable" };
      else { const body = await port(owner, target); if (pending !== ticket) return "discarded"; const value = decodePaymentIntentFixture(body, owner, target); next = value ? { phase: "ready", read: { kind: "payment-intent", value } } : { phase: "contract-error" }; }
    } catch (error) { if (pending !== ticket) return "discarded"; next = failure(error); }
    if (pending !== ticket) return "discarded";
    pending = null; state = next; return "applied";
  };
  return { getState: () => state, load, refresh: () => last ? load(last) : Promise.resolve("no-query" as const), reset() { pending = null; last = null; state = { phase: "idle" }; } };
}
