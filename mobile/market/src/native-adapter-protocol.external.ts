import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { nativeAdapterProtocolCaseIds, syntheticNativeAdapterProtocol } from "./test-fixtures/native-adapter-protocol";

// Generated-only metadata; never a business command executor or default native binding.
test("generate redacted native candidate request protocol examples", async () => {
  if (process.env.MOBILE_SYNTHETIC_ADAPTER_PROTOCOL !== "generate") throw Error("Set MOBILE_SYNTHETIC_ADAPTER_PROTOCOL=generate for synthetic-only request shape examples.");
  const scenarios = [];
  for (const id of nativeAdapterProtocolCaseIds) scenarios.push(await syntheticNativeAdapterProtocol(id));
  expect(scenarios).toHaveLength(34); const routePatterns = new Set(scenarios.map(row => row.request.method + " " + row.request.pathPattern)).size; expect(routePatterns).toBe(25);
  const output = { formatVersion: 1, syntheticOnly: true, scenarioCount: scenarios.length, routePatterns, responseContractAccepted: false, serverAccepted: false, realNetworkRequests: 0, realServerMutations: 0, scenarios };
  const directory = resolve(__dirname, "../../../.tmp/mobile-session-checks"); mkdirSync(directory, { recursive: true });
  const bytes = Buffer.from(JSON.stringify(output, null, 2) + "\n", "utf8"); writeFileSync(resolve(directory, "synthetic-native-adapter-protocol.json"), bytes);
  writeFileSync(resolve(directory, "synthetic-native-adapter-protocol-receipt.json"), JSON.stringify({ formatVersion: 1, file: "synthetic-native-adapter-protocol.json", bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), syntheticOnly: true, scenarioCount: scenarios.length, routePatterns, serverAccepted: false, realNetworkRequests: 0, realServerMutations: 0 }, null, 2) + "\n");
  console.log(JSON.stringify({ status: "SYNTHETIC_REDACTED_ADAPTER_PROTOCOL_GENERATED", scenarios: scenarios.length, routePatterns, realNetworkRequests: 0, realServerMutations: 0, responseContractAccepted: false }));
});
