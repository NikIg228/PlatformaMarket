import { jest } from "@jest/globals";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeCaptureReplayReport } from "./test-fixtures/write-capture-replay-report";
import { readLocalCapture, localCaptureLimitBytes } from "./test-fixtures/read-local-capture";
import { replayCoreReadCapture } from "./test-fixtures/core-read-capture-replay";
import { replayConversationCapture } from "./test-fixtures/conversation-capture-replay";
import { replayNativeMetadataCapture } from "./test-fixtures/native-metadata-capture-replay";
import { replayCartOperationCapture } from "./test-fixtures/cart-operation-capture-replay";
import { coreReadCaptureExample } from "./test-fixtures/core-read-capture-example";
import { conversationCaptureExample } from "./test-fixtures/conversation-capture-example";
import { nativeMetadataCaptureExample } from "./test-fixtures/native-metadata-capture-example";
import { cartOperationCaptureExample } from "./test-fixtures/cart-operation-capture-example";

const directory = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "capture-report-test-"));
const consumers = [
  { name: "core", replay: replayCoreReadCapture, example: () => coreReadCaptureExample(), success: "CONSISTENT_READ", invalidStage: "input" },
  { name: "conversation", replay: replayConversationCapture, example: () => Promise.resolve(conversationCaptureExample("OFFER", true)), success: "CONSISTENT_READ", invalidStage: "envelope" },
  { name: "metadata", replay: replayNativeMetadataCapture, example: () => nativeMetadataCaptureExample(), success: "CONSISTENT_READ", invalidStage: "input" },
  { name: "cart", replay: replayCartOperationCapture, example: () => cartOperationCaptureExample("checkout"), success: "CONSISTENT_RESPONSE", invalidStage: "input" },
] as const;
type ReplayReport = Awaited<ReturnType<(typeof consumers)[number]["replay"]>>;
beforeAll(() => {
  mkdirSync(join(directory, "PRIVATE_DIRECTORY")); writeFileSync(join(directory, "PRIVATE_INVALID.json"), "{PRIVATE_SAVED_CONTENT");
  writeFileSync(join(directory, "PRIVATE_OVERSIZE.json"), Buffer.alloc(localCaptureLimitBytes + 1, 32));
});
afterEach(() => jest.restoreAllMocks());
afterAll(() => rmSync(directory, { recursive: true }));

it.each(consumers)("$name writes the current existing decoder's redacted refusal over stale success for real file failures", async consumer => {
  const fetcher = jest.spyOn(globalThis, "fetch").mockRejectedValue(Error("Unexpected network"));
  const reportFile = join(directory, consumer.name + "-report.json");
  for (const file of ["PRIVATE_MISSING.json", "PRIVATE_DIRECTORY", "PRIVATE_INVALID.json", "PRIVATE_OVERSIZE.json"]) {
    writeFileSync(reportFile, JSON.stringify({ status: consumer.success, stale: true }));
    const replay = (input: unknown) => consumer.replay(input);
    const report = await writeCaptureReplayReport<ReplayReport>(() => readLocalCapture(join(directory, file)), replay, reportFile);
    expect(report.status).toBe("INPUT_INVALID"); expect(report.stage).toBe(consumer.invalidStage); expect(JSON.parse(readFileSync(reportFile, "utf8"))).toEqual(report);
    expect(report).toMatchObject({ serverAccepted: false, productionAuthorizationVerified: false }); expect(report).not.toHaveProperty("stale");
    const output = readFileSync(reportFile, "utf8"); expect(output).not.toContain("PRIVATE"); expect(output).not.toContain(directory);
  }
  expect(fetcher).not.toHaveBeenCalled();
});
it.each(consumers)("$name retains exact regular capture bytes and writes only the existing redacted success report", async consumer => {
  const file = join(directory, consumer.name + "-valid.json"), reportFile = join(directory, "nested", consumer.name + "-report.json"), bytes = JSON.stringify(await consumer.example(), null, 2) + "\n";
  writeFileSync(file, bytes); const report = await writeCaptureReplayReport<ReplayReport>(() => readLocalCapture(file), input => consumer.replay(input), reportFile);
  expect(report.status).toBe(consumer.success); expect(readFileSync(file, "utf8")).toBe(bytes); expect(JSON.parse(readFileSync(reportFile, "utf8"))).toEqual(report);
  expect(report).toMatchObject({ serverAccepted: false, productionAuthorizationVerified: false }); expect(readFileSync(reportFile, "utf8")).not.toContain("00000000-");
});
it.each(consumers)("$name discards thrown asynchronous loader payloads without exposing a path or error details", async consumer => {
  const reportFile = join(directory, consumer.name + "-async-report.json");
  const report = await writeCaptureReplayReport<ReplayReport>(async () => { throw { private: "PRIVATE_ERROR_PAYLOAD", path: "PRIVATE_FILE" }; }, input => consumer.replay(input), reportFile);
  expect(report.status).toBe("INPUT_INVALID"); expect(readFileSync(reportFile, "utf8")).not.toContain("PRIVATE");
});
it("report output failure propagates instead of returning a success marker", async () => {
  const blocker = join(directory, "output-is-file"); writeFileSync(blocker, "owned test blocker");
  await expect(writeCaptureReplayReport(() => ({}), async () => ({ status: "synthetic-only" }), join(blocker, "report.json"))).rejects.toBeDefined();
  expect(readFileSync(blocker, "utf8")).toBe("owned test blocker");
});
