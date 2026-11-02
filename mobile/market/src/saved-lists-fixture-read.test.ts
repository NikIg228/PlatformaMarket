import { jest } from "@jest/globals";
import { createSavedListsFixtureRead, createSavedListsFixtureReader, decodeSavedListsFixture, type SavedListsFixturePort } from "./saved-lists-fixture-read";
import type { ReadScope } from "./read-controller";
import { savedListFixture, savedListId, savedListOrganization, savedListUser } from "./test-fixtures/saved-lists";
const scope: ReadScope = { product: "market", environment: "synthetic-offline", userId: savedListUser, organizationId: savedListOrganization, generation: 1 };
const error = (status: number) => ({ status, payload: { statusCode: status, code: "SYNTHETIC_CODE", message: "SYNTHETIC private error", path: "/owner/saved-lists", timestamp: "2026-10-29T01:02:03.000Z" } });
it("preserves source order, exact raw decimals/names/notes/dates and allows lists created by a colleague in the same org", () => {
  const a = savedListFixture({ name: "  SYNTHETIC raw name  ", isDefault: false, createdById: savedListId(99) }), b = savedListFixture({ id: savedListId(810), isDefault: true, items: [] });
  const result = decodeSavedListsFixture([a, b], scope)!; expect(result.map(row => row.id)).toEqual([a.id, b.id]); expect(result[0]?.items[0]?.quantity).toBe("999999999999.999999"); expect(result[0]?.items[0]?.note).toBe(a.items[0]?.note); expect(result[0]?.name).toBe(a.name); expect(result[0]?.updatedAt).toBe(a.updatedAt); expect(result[0]).not.toHaveProperty("createdById");
});
it("rejects foreign org before reading content, and invalid item-list bindings before reading names/notes", () => {
  const foreign = savedListFixture({ organizationId: savedListId(99) }), getter = jest.fn(() => { throw new Error("Must not decode private fields"); }); Object.defineProperty(foreign, "name", { get: getter }); expect(decodeSavedListsFixture([foreign], scope)).toBeNull(); expect(getter).not.toHaveBeenCalled();
  const wrongList = savedListFixture(); wrongList.items[0]!.listId = savedListId(999); Object.defineProperty(wrongList.items[0]!, "note", { get: getter }); Object.defineProperty(wrongList, "name", { get: getter }); expect(decodeSavedListsFixture([wrongList], scope)).toBeNull(); expect(getter).not.toHaveBeenCalled();
});
it.each(["null", "envelope", "missing-items", "null-items", "numeric-quantity", "fraction-scale", "integer-precision", "missing-note", "invalid-date", "duplicate-list", "duplicate-item", "duplicate-offer", "invalid-id"])("rejects unsupported/inconsistent %s without best-effort row extraction", variant => {
  const a = savedListFixture(); let body: unknown = [a];
  if (variant === "null") body = null; if (variant === "envelope") body = { lists: [a], total: 1 };
  if (variant === "missing-items") body = [{ ...a, items: undefined }]; if (variant === "null-items") body = [{ ...a, items: null }];
  if (variant === "numeric-quantity") body = [{ ...a, items: [{ ...a.items[0], quantity: 1 }] }]; if (variant === "fraction-scale") a.items[0]!.quantity = "1.0000001"; if (variant === "integer-precision") a.items[0]!.quantity = "1000000000000";
  if (variant === "missing-note") body = [{ ...a, items: [{ ...a.items[0], note: undefined }] }]; if (variant === "invalid-date") a.updatedAt = "SYNTHETIC not a timestamp";
  if (variant === "duplicate-list") body = [a, a]; if (variant === "duplicate-item") a.items.push({ ...a.items[0]!, offerId: savedListId(999) }); if (variant === "duplicate-offer") a.items.push({ ...a.items[0]!, id: savedListId(999) }); if (variant === "invalid-id") a.id = "SYNTHETIC-invalid";
  expect(decodeSavedListsFixture(body, scope)).toBeNull();
});
it("does not impose write-schema min/positive/trim rules on historical read fields or invent an owner grant", () => {
  const a = savedListFixture({ name: "", isDefault: false }); a.items[0]!.quantity = "-1.000001"; a.items[0]!.note = null;
  const result = decodeSavedListsFixture([a], scope)!; expect(result[0]?.name).toBe(""); expect(result[0]?.items[0]?.quantity).toBe("-1.000001"); expect(result[0]?.items[0]?.note).toBeNull(); expect(decodeSavedListsFixture([], scope)).toEqual([]);
});
it("strips unknown raw fields instead of turning them into offer names/prices/URLs or authority", () => {
  const a = savedListFixture(), body = [{ ...a, secret: "SYNTHETIC private", canEdit: true, items: [{ ...a.items[0], offer: { name: "SYNTHETIC invented name", price: 123 }, url: "https://private.example.invalid" }] }];
  const result = decodeSavedListsFixture(body, scope)!; expect(result[0]).not.toHaveProperty("secret"); expect(result[0]).not.toHaveProperty("canEdit"); expect(result[0]?.items[0]).not.toHaveProperty("offer"); expect(result[0]?.items[0]).not.toHaveProperty("url");
});
it("the explicit fixture reader snapshots inputs and returns independent synthetic values, without a live default", async () => {
  const a = savedListFixture(), read = createSavedListsFixtureReader([a]); a.name = "SYNTHETIC changed after snapshot";
  expect(await read(scope)).toEqual([savedListFixture()]); const model = createSavedListsFixtureRead(scope); await model.load(); expect(model.getState().phase).toBe("unavailable");
});
it("binds the injected fixture call to a frozen scope snapshot and handles loaded-empty separately from null", async () => {
  const port = jest.fn<SavedListsFixturePort>().mockResolvedValue([]), caller = { ...scope }, model = createSavedListsFixtureRead(caller, port); caller.organizationId = savedListId(99); await model.load(); expect(port).toHaveBeenCalledWith(scope); expect(Object.isFrozen(port.mock.calls[0]![0])).toBe(true); expect(model.getState()).toEqual({ phase: "empty", read: { kind: "saved-lists", value: [] } });
  port.mockResolvedValue(null); await model.load(); expect(model.getState().phase).toBe("contract-error"); expect(model.getState()).not.toHaveProperty("read");
});
it.each([[401, "authentication-required"], [403, "denied"], [404, "unavailable"], [429, "retry-limited"], [500, "error"]] as const)("maps validated %s to %s without raw error prose", async (status, phase) => {
  const model = createSavedListsFixtureRead(scope, async () => { throw error(status); }); await model.load(); expect(model.getState()).toEqual({ phase }); expect(JSON.stringify(model.getState())).not.toContain("private");
});
it("rejects contradictory error envelope and handles a plain offline exception without retaining prior rows", async () => {
  const port = jest.fn<SavedListsFixturePort>().mockResolvedValue([savedListFixture()]), model = createSavedListsFixtureRead(scope, port); await model.load(); port.mockRejectedValueOnce(new Error("SYNTHETIC private offline")); await model.load(); expect(model.getState()).toEqual({ phase: "error" });
  port.mockRejectedValueOnce({ status: 403, payload: error(401).payload }); await model.load(); expect(model.getState()).toEqual({ phase: "contract-error" });
});
it("applies only the newest completion and drops pending data after reset, including identical scope", async () => {
  let first!: (value: unknown) => void, second!: (value: unknown) => void; const port = jest.fn<SavedListsFixturePort>().mockImplementationOnce(() => new Promise(yes => { first = yes; })).mockImplementationOnce(() => new Promise(yes => { second = yes; })); const model = createSavedListsFixtureRead(scope, port);
  const old = model.load(), fresh = model.load(); second([savedListFixture({ name: "SYNTHETIC newest" })]); expect(await fresh).toBe("applied"); first([savedListFixture({ name: "SYNTHETIC old" })]); expect(await old).toBe("discarded"); expect(JSON.stringify(model.getState())).toContain("SYNTHETIC newest");
  let finish!: (value: unknown) => void; port.mockImplementationOnce(() => new Promise(yes => { finish = yes; })); const pending = model.load(); model.reset(); finish([savedListFixture()]); expect(await pending).toBe("discarded"); expect(model.getState()).toEqual({ phase: "idle" });
});
