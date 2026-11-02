import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { sessionProtocolCaseIds, syntheticNativeSessionProtocol } from "./test-fixtures/native-session-protocol";

// Generated synthetic runs only. No caller file, credential or API address is accepted.
test("generate redacted native session protocol examples through existing controller", async () => {
  if (process.env.MOBILE_SYNTHETIC_SESSION_PROTOCOL !== "generate") throw Error("Set MOBILE_SYNTHETIC_SESSION_PROTOCOL=generate for synthetic-only redacted protocol examples.");
  const scenarios = [];
  for (const id of sessionProtocolCaseIds) scenarios.push(await syntheticNativeSessionProtocol(id));
  expect(scenarios).toHaveLength(8);
  for (const scenario of scenarios) expect(scenario).toMatchObject({ realNetworkRequests: 0, realServerMutations: 0, businessCommandCalls: 0, serverAccepted: false, productionAuthorizationVerified: false });
  const output = { formatVersion: 1, syntheticOnly: true, scenarioCount: scenarios.length, serverAccepted: false, realNetworkRequests: 0, realServerMutations: 0, scenarios };
  const directory = resolve(__dirname, "../../../.tmp/mobile-session-checks"); mkdirSync(directory, { recursive: true });
  const bytes = Buffer.from(JSON.stringify(output, null, 2) + "\n", "utf8");
  writeFileSync(resolve(directory, "synthetic-native-session-protocol.json"), bytes);
  writeFileSync(resolve(directory, "synthetic-native-session-protocol-receipt.json"), JSON.stringify({ formatVersion: 1, file: "synthetic-native-session-protocol.json", bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), syntheticOnly: true, scenarioCount: scenarios.length, serverAccepted: false, realNetworkRequests: 0, realServerMutations: 0 }, null, 2) + "\n");
  console.log(JSON.stringify({ status: "SYNTHETIC_REDACTED_SESSION_PROTOCOL_GENERATED", scenarios: scenarios.length, realNetworkRequests: 0, realServerMutations: 0, serverAccepted: false }));
});
