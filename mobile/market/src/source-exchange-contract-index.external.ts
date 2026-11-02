import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { sourceExchangeContractIndex } from "./test-fixtures/source-exchange-contract-index";

test("generate owned synthetic source exchange metadata index", async () => {
  if (process.env.MOBILE_SOURCE_EXCHANGE_INDEX !== "generate") throw Error("Set MOBILE_SOURCE_EXCHANGE_INDEX=generate for owned synthetic source metadata only.");
  const directory = resolve(__dirname, "../../../.tmp/mobile-session-checks"); mkdirSync(directory, { recursive: true });
  const report = await sourceExchangeContractIndex(); expect(report).toMatchObject({ status: "OWNED_SOURCE_EXCHANGE_INDEX_READY", sourceConsumersVerified: true, completeAPIContract: false, serverAccepted: false, realNetworkRequests: 0, realServerMutations: 0 });
  const file = "source-exchange-contract-index.json", bytes = Buffer.from(JSON.stringify(report, null, 2) + "\n"); writeFileSync(resolve(directory, file), bytes);
  writeFileSync(resolve(directory, "source-exchange-contract-index-receipt.json"), JSON.stringify({ formatVersion: 1, syntheticOnly: true, file, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), sourceBatchCases: report.sourceBatchCases, compatibleCaseCount: report.compatibleCaseCount, exchangeCount: report.exchangeCount, uniqueRouteAndQueryShapeCount: report.uniqueRouteAndQueryShapeCount, serverAccepted: false, completeAPIContract: false, realNetworkRequests: 0, realServerMutations: 0 }, null, 2) + "\n");
  console.log(JSON.stringify({ status: report.status, compatibleCaseCount: report.compatibleCaseCount, exchangeCount: report.exchangeCount, uniqueRouteAndQueryShapeCount: report.uniqueRouteAndQueryShapeCount, serverAccepted: false, completeAPIContract: false, realNetworkRequests: 0, realServerMutations: 0 }));
});
