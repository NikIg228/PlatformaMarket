import { jest } from "@jest/globals";
import { publicCityListResponseSchema } from "../../../packages/schemas/src/core-api";
import { createPublicCitiesFixtureRead, decodePublicCitiesFixture, citySnapshot, type PublicCitiesFixtureClient } from "./public-cities-fixture-read";
import { cityFixture, cityScope } from "./test-fixtures/public-cities";
import { listDraftId } from "./test-fixtures/list-draft";
import { reviewEnvelope } from "./test-fixtures/published-reviews";
type Port = NonNullable<PublicCitiesFixtureClient["publicCitiesFixture"]>;
it("reuses actual public city schema and preserves source order/names without invented KK, coordinates or a default city", () => {
  const raw = cityFixture().reverse(); expect(publicCityListResponseSchema.safeParse(raw).success).toBe(true); expect(decodePublicCitiesFixture(raw)).toEqual(raw); expect(decodePublicCitiesFixture([])).toEqual([]); for (const row of decodePublicCitiesFixture(raw)!) { expect(row).not.toHaveProperty("nameKk"); expect(row).not.toHaveProperty("latitude"); }
});
it("does not read unneeded source geography/contact/private fields, or any names for duplicate IDs", () => {
  const raw = cityFixture(), hidden = jest.fn(() => { throw new Error("Excluded city data read"); }); for (const item of raw) for (const key of ["latitude", "longitude", "organizationId", "country", "addresses", "nameKk", "metadata"]) Object.defineProperty(item, key, { get: hidden }); Object.defineProperty(raw[0]!.region, "coordinates", { get: hidden }); expect(decodePublicCitiesFixture(raw)).toEqual(cityFixture()); expect(hidden).not.toHaveBeenCalled(); raw[1]!.id = raw[0]!.id; Object.defineProperty(raw[0]!, "nameRu", { get: hidden }); expect(decodePublicCitiesFixture(raw)).toBeNull(); expect(hidden).not.toHaveBeenCalled();
});
it.each([null, {}, [null], [{ id: "invalid", nameRu: "name", region: { nameRu: "region" } }], [{ ...cityFixture()[0], nameRu: undefined }], [{ ...cityFixture()[0], region: null }], [{ ...cityFixture()[0], region: {} }]])("rejects malformed/partial city list %j without sample rows or region synthesis", body => { expect(decodePublicCitiesFixture(body)).toBeNull(); });
it("keeps empty actual source labels for an explicit disabled UI boundary rather than renaming or dropping rows", () => {
  const raw = cityFixture(); raw[0]!.nameRu = "  "; raw[1]!.region.nameRu = ""; expect(decodePublicCitiesFixture(raw)).toEqual(raw);
});
it("a captured selected city is an immutable detached snapshot, not a live mutable response reference", () => {
  const raw = cityFixture()[0]!, selected = citySnapshot(raw); raw.nameRu = "SYNTHETIC changed"; raw.region.nameRu = "SYNTHETIC changed region"; expect(selected).toEqual(cityFixture()[0]); expect(Object.isFrozen(selected)).toBe(true); expect(Object.isFrozen(selected.region)).toBe(true);
});
it("does not invent a request limit or truncate the actual shared array", () => {
  const rows = Array.from({ length: 301 }, (_, n) => ({ ...cityFixture()[0]!, id: listDraftId(7000 + n) })); expect(decodePublicCitiesFixture(rows)).toHaveLength(301);
});
it("freezes current scope, uses no guessed HTTP/default data, and returns an explicit empty state", async () => {
  const scope = { ...cityScope }, port = jest.fn<Port>().mockResolvedValueOnce([]), model = createPublicCitiesFixtureRead(scope, port); scope.organizationId = listDraftId(99); await model.load(); expect(port).toHaveBeenCalledWith(cityScope); expect(Object.isFrozen(port.mock.calls[0]![0])).toBe(true); expect(model.getState()).toEqual({ phase: "empty", read: { kind: "public-cities", value: [] } }); const absent = createPublicCitiesFixtureRead(cityScope); await absent.load(); expect(absent.getState()).toEqual({ phase: "unavailable" });
});
it.each([[401, "authentication-required"], [403, "denied"], [404, "unavailable"], [429, "retry-limited"], [500, "error"]] as const)("maps structured %s safely, clears prior rows and retries the same no-query read", async (status, phase) => {
  const port = jest.fn<Port>().mockResolvedValueOnce(cityFixture()).mockRejectedValueOnce(reviewEnvelope(status)).mockResolvedValueOnce(cityFixture()), model = createPublicCitiesFixtureRead(cityScope, port); await model.load(); await model.load(); expect(model.getState()).toEqual({ phase }); expect(JSON.stringify(model.getState())).not.toContain("SYNTHETIC"); await model.load(); expect(model.getState()).toMatchObject({ phase: "ready" }); expect(port.mock.calls.every(call => call.length === 1)).toBe(true);
});
it("plain offline/contradictory errors are not translated into an empty directory", async () => {
  const port = jest.fn<Port>().mockRejectedValueOnce(new Error("SYNTHETIC private offline")).mockRejectedValueOnce({ ...reviewEnvelope(403), payload: reviewEnvelope(401).payload }), model = createPublicCitiesFixtureRead(cityScope, port); await model.load(); expect(model.getState()).toEqual({ phase: "error" }); await model.load(); expect(model.getState()).toEqual({ phase: "contract-error" });
});
it("latest response/reset discard late data and errors before any field is read", async () => {
  let finish!: (body: unknown) => void; const port = jest.fn<Port>().mockImplementationOnce(() => new Promise(yes => { finish = yes; })).mockResolvedValueOnce(cityFixture()), model = createPublicCitiesFixtureRead(cityScope, port), old = model.load(); await model.load(); const hidden = jest.fn(() => { throw new Error("Stale city data read"); }), raw = [{}]; Object.defineProperty(raw[0]!, "id", { get: hidden }); finish(raw); expect(await old).toBe("discarded"); expect(hidden).not.toHaveBeenCalled(); expect(model.getState()).toMatchObject({ phase: "ready" }); let reject!: (error: unknown) => void; port.mockImplementationOnce(() => new Promise((_yes, no) => { reject = no; })); const pending = model.load(), error = {}; Object.defineProperty(error, "status", { get: hidden }); Object.defineProperty(error, "payload", { get: hidden }); model.reset(); reject(error); expect(await pending).toBe("discarded"); expect(hidden).not.toHaveBeenCalled(); expect(model.getState()).toEqual({ phase: "idle" });
});
