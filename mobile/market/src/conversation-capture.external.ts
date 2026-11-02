import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { readLocalCapture } from "./test-fixtures/read-local-capture";
import { replayConversationCapture } from "./test-fixtures/conversation-capture-replay";
import { conversationCaptureExample } from "./test-fixtures/conversation-capture-example";
import { writeCaptureReplayReport } from "./test-fixtures/write-capture-replay-report";

// Opt-in entry: excluded from normal *.test.ts suites and never imported by the application.
test("explicit offline saved GET capture consistency; never current-server acceptance", async () => {
  const path = process.env.MOBILE_CONVERSATION_CAPTURE_FILE;
  if (!path) throw Error("Set MOBILE_CONVERSATION_CAPTURE_FILE to an explicit local JSON file or synthetic.");
  const outputDirectory = resolve(__dirname, "../../../.tmp/mobile-session-checks");
  const report = await writeCaptureReplayReport(() => {
    if (path !== "synthetic") return readLocalCapture(path);
    const input = conversationCaptureExample("OFFER", true);
    mkdirSync(outputDirectory, { recursive: true });
    writeFileSync(resolve(outputDirectory, "synthetic-conversation-capture-example.json"), JSON.stringify(input, null, 2) + "\n");
    return input;
  }, replayConversationCapture, resolve(outputDirectory, "conversation-capture-replay-report.json"));
  console.log(JSON.stringify(report));
  if (report.status !== "CONSISTENT_READ") throw Error("Saved capture was rejected. Inspect the redacted replay report; raw payload was not copied.");
  expect(report.serverAccepted).toBe(false);
  expect(report.productionAuthorizationVerified).toBe(false);
  expect(report.networkRequests).toBe(0);
  expect(report.mutations).toBe(0);
});
