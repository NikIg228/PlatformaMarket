import { jest } from "@jest/globals";
import { nativeAdapterProtocolCaseIds, syntheticNativeAdapterProtocol } from "./test-fixtures/native-adapter-protocol";

it.each(nativeAdapterProtocolCaseIds)("redacted synthetic%s comes from one actual candidate call without response or admission claims", async id => {
  const report = await syntheticNativeAdapterProtocol(id);
  expect(report).toMatchObject({ scenario: id, syntheticPortCalls: 1, returnedRawIdentity: true, responseContractAccepted: false, businessEligibilityVerified: false, nativeBindingPerformed: false, nativeUuidProviderAccessed: false, realNetworkRequests: 0, realServerMutations: 0, serverAccepted: false, productionAuthorizationVerified: false });
  const text = JSON.stringify(report); expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i);
  for (const value of ["SYNTHETIC", "https:", "5800000000000000000", "1600000000000000000", "999999999999.999999", "0.500001"]) expect(text).not.toContain(value);
  expect(Object.isFrozen(report)).toBe(true); expect(Object.isFrozen(report.request.bodyFields)).toBe(true); expect(JSON.parse(text)).toEqual(report);
});
it("34 samples cover exactly25 actual method/path patterns and all five selected families", async () => {
  const rows = await Promise.all(nativeAdapterProtocolCaseIds.map(syntheticNativeAdapterProtocol)); expect(rows).toHaveLength(34); expect(new Set(rows.map(row => row.scenario)).size).toBe(34); expect(new Set(rows.map(row => row.request.method + " " + row.request.pathPattern)).size).toBe(25);
  expect(Object.fromEntries(["conversation-read", "conversation-command", "cart", "buyer-workflow", "buyer-workspace"].map(family => [family, rows.filter(row => row.family === family).length]))).toEqual({ "conversation-read": 3, "conversation-command": 6, cart: 8, "buyer-workflow": 10, "buyer-workspace": 7 });
});
it("serialized source field types retain exact financial strings and distinct key/version/body rules", async () => {
  const get = async (id: string) => (await syntheticNativeAdapterProtocol(id)).request;
  expect((await get("cart-reprice")).bodyFields).toMatchObject({ "acceptedItems[].snapshot.unitPriceMinor": "string", "acceptedItems[].snapshot.tax.vatMinor": "string" });
  expect((await get("workflow-receive-shipment")).bodyFields["items[].deliveredQuantity"]).toBe("string"); expect((await get("workflow-return-goods")).bodyFields["items[].quantity"]).toBe("string");
  expect((await get("cart-add")).bodyFields).toEqual({ offerId: "string", quantity: "number" }); expect((await get("cart-checkout")).bodyFields).toEqual({ expectedVersion: "number", idempotencyKey: "string" });
  expect((await get("cart-validate")).bodyType).toBe("absent"); expect((await get("workspace-remove-item")).bodyType).toBe("absent"); expect((await get("workspace-update-comment")).bodyFields).toEqual({ body: "string", version: "number" });
  expect((await get("conversation-detail")).queryKeys).toEqual(["beforeSequence"]); expect((await get("conversation-context")).queryKeys).toEqual(["contextId", "contextType"]);
});
it("all candidate samples stay on injected ports without any real fetch", async () => {
  const fetch = jest.spyOn(globalThis, "fetch").mockRejectedValue(Error("FORBIDDEN_NETWORK"));
  try { for (const id of nativeAdapterProtocolCaseIds) await syntheticNativeAdapterProtocol(id); expect(fetch).not.toHaveBeenCalled(); }
  finally { fetch.mockRestore(); }
});
