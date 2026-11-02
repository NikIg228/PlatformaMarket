import { z } from "zod";
import { errorResponseSchema } from "../../../packages/schemas/src/core-api";
import type { ReadScope } from "../../../contracts/mobile-read/read-adapter";

// LOCAL SYNTHETIC FIXTURE boundary, not an accepted CURRENT API response schema.
// OwnersService.lists returns SavedList scalars + SavedListItem[] (Prisma).
// buyer-web has a local SavedList TS type; no accepted shared CURRENT runtime
// response schema was found. Live Decimal JSON encoding remains unverified;
// these fixtures explicitly use exact Decimal(18,6) strings.
const identity = z.object({ id: z.uuid(), organizationId: z.uuid() });
const rowBindings = identity.extend({ items: z.array(z.object({ id: z.uuid(), listId: z.uuid(), offerId: z.uuid() })) });
const timestamp = z.iso.datetime({ offset: true });
export const savedListItemFixtureSchema = z.object({ id: z.uuid(), listId: z.uuid(), offerId: z.uuid(), quantity: z.string().regex(/^-?\d{1,12}(?:\.\d{1,6})?$/), note: z.string().nullable(), createdAt: timestamp, updatedAt: timestamp });
export const savedListHeaderFixtureSchema = identity.extend({ createdById: z.uuid(), name: z.string(), isDefault: z.boolean(), createdAt: timestamp, updatedAt: timestamp });
const listFixture = savedListHeaderFixtureSchema.extend({ items: z.array(savedListItemFixtureSchema) });
export type FixtureSavedList = Omit<z.output<typeof listFixture>, "createdById">;
export type SavedListsFixturePort = (scope: ReadScope) => Promise<unknown>;
export type SavedListsFixtureClient = { savedListsFixture?: SavedListsFixturePort };
export type SavedListsFixtureState = { phase: "idle" } | { phase: "loading"; target: { kind: "saved-lists" } }
  | { phase: "ready" | "empty"; read: { kind: "saved-lists"; value: FixtureSavedList[] } }
  | { phase: "contract-error" | "authentication-required" | "denied" | "unavailable" | "retry-limited" | "error" };

export function decodeSavedListsFixture(body: unknown, scope: ReadScope): FixtureSavedList[] | null {
  // Reject foreign rows before decoding their names/notes or projecting content.
  const context = z.array(identity).safeParse(body);
  if (!context.success || context.data.some(row => row.organizationId !== scope.organizationId) || new Set(context.data.map(row => row.id)).size !== context.data.length) return null;
  const bindings = z.array(rowBindings).safeParse(body);
  if (!bindings.success) return null;
  const itemIds = new Set<string>();
  for (const list of bindings.data) {
    const offers = new Set<string>();
    for (const item of list.items) {
      if (item.listId !== list.id || itemIds.has(item.id) || offers.has(item.offerId)) return null;
      itemIds.add(item.id); offers.add(item.offerId);
    }
  }
  const parsed = z.array(listFixture).safeParse(body);
  if (!parsed.success) return null;
  // Colleagues' organization lists are valid. createdById is NOT an actor grant
  // or private-owner filter, and is deliberately absent from the display model.
  return parsed.data.map(({ createdById: _createdById, ...list }) => list);
}
/** Explicit in-memory fixture adapter; no HTTP binding or default sample data. */
export function createSavedListsFixtureReader(body: unknown): SavedListsFixturePort {
  const text = JSON.stringify(body);
  return async () => text === undefined ? undefined : JSON.parse(text);
}
function failure(error: unknown): SavedListsFixtureState {
  if (typeof error !== "object" || error === null || !("status" in error) || !("payload" in error)) return { phase: "error" };
  const status = error.status, parsed = errorResponseSchema.safeParse(error.payload);
  if (typeof status !== "number" || !Number.isInteger(status) || status < 300 || status > 599 || !parsed.success || parsed.data.statusCode !== status) return { phase: "contract-error" };
  return { phase: status === 401 ? "authentication-required" : status === 403 ? "denied" : status === 404 ? "unavailable" : status === 429 ? "retry-limited" : "error" };
}
export function createSavedListsFixtureRead(scope: ReadScope, port?: SavedListsFixturePort) {
  const owner = Object.freeze({ ...scope });
  let state: SavedListsFixtureState = { phase: "idle" }, pending: object | null = null;
  return {
    getState: () => state,
    reset() { pending = null; state = { phase: "idle" }; },
    async load(): Promise<"applied" | "discarded"> {
      const request = {}; pending = request; state = { phase: "loading", target: { kind: "saved-lists" } };
      let next: SavedListsFixtureState;
      try {
        if (!port) next = { phase: "unavailable" };
        else {
          const body = await port(owner);
          if (pending !== request) return "discarded";
          const value = decodeSavedListsFixture(body, owner);
          next = value === null ? { phase: "contract-error" } : { phase: value.length ? "ready" : "empty", read: { kind: "saved-lists", value } };
        }
      } catch (error) { next = failure(error); }
      if (pending !== request) return "discarded";
      pending = null; state = next; return "applied";
    },
  };
}
