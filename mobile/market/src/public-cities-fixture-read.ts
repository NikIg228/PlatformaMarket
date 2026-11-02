import { z } from "zod";
import { publicCityListResponseSchema, publicCitySchema, errorResponseSchema } from "../../../packages/schemas/src/core-api";
import type { ReadScope } from "../../../contracts/mobile-read/read-adapter";
export type PublicCity = z.output<typeof publicCitySchema>;
export function decodePublicCitiesFixture(body: unknown): PublicCity[] | null {
  const ids = z.array(publicCitySchema.pick({ id: true })).safeParse(body);
  if (!ids.success || new Set(ids.data.map(item => item.id)).size !== ids.data.length) return null;
  const parsed = publicCityListResponseSchema.safeParse(body); return parsed.success ? parsed.data : null;
}
export function citySnapshot(city: PublicCity): PublicCity { return Object.freeze({ id: city.id, nameRu: city.nameRu, region: Object.freeze({ nameRu: city.region.nameRu }) }); }
export type PublicCitiesFixtureClient = { publicCitiesFixture?: (scope: ReadScope) => Promise<unknown> };
export type PublicCitiesFixtureState = { phase: "idle" } | { phase: "loading"; target: { kind: "public-cities" } } | { phase: "ready" | "empty"; read: { kind: "public-cities"; value: PublicCity[] } } | { phase: "contract-error" | "authentication-required" | "denied" | "unavailable" | "retry-limited" | "error" };
function failure(error: unknown): PublicCitiesFixtureState {
  if (typeof error !== "object" || error === null || !("status" in error) || !("payload" in error)) return { phase: "error" };
  const status = error.status, parsed = errorResponseSchema.safeParse(error.payload);
  if (typeof status !== "number" || !Number.isInteger(status) || status < 300 || status > 599 || !parsed.success || parsed.data.statusCode !== status) return { phase: "contract-error" };
  return { phase: status === 401 ? "authentication-required" : status === 403 ? "denied" : status === 404 ? "unavailable" : status === 429 ? "retry-limited" : "error" };
}
export function createPublicCitiesFixtureRead(scope: ReadScope, port?: PublicCitiesFixtureClient["publicCitiesFixture"]) {
  const owner = Object.freeze({ ...scope }); let state: PublicCitiesFixtureState = { phase: "idle" }, pending: object | null = null;
  const load = async (): Promise<"applied" | "discarded"> => {
    const request = {}; pending = request; state = { phase: "loading", target: { kind: "public-cities" } }; let next: PublicCitiesFixtureState;
    try { if (!port) next = { phase: "unavailable" }; else { const body = await port(owner); if (pending !== request) return "discarded"; const value = decodePublicCitiesFixture(body); next = value ? { phase: value.length ? "ready" : "empty", read: { kind: "public-cities", value } } : { phase: "contract-error" }; } }
    catch (error) { if (pending !== request) return "discarded"; next = failure(error); }
    if (pending !== request) return "discarded"; pending = null; state = next; return "applied";
  };
  return { load, getState: () => state, reset() { pending = null; state = { phase: "idle" }; } };
}
