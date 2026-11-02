import { jest } from "@jest/globals";
import { replayNativeMetadataCapture } from "./test-fixtures/native-metadata-capture-replay";
import { nativeMetadataCaptureExample } from "./test-fixtures/native-metadata-capture-example";
import { archiveId, archiveEnvelope } from "./test-fixtures/document-archive";
type Row = Record<string, unknown>;
const row = (value: unknown) => value as Row;
function hidden(value: Row, key: string) { const getter = jest.fn(() => { throw Error("PRIVATE_METADATA_CAPTURE_FIELD"); }); Object.defineProperty(value, key, { configurable: true, get: getter }); return getter; }
function expectPrivateReport(report: unknown) {
  expect(report).toMatchObject({ archiveMetadataOnly: true, serverAccepted: false, productionAuthorizationVerified: false, networkRequests: 0, mutations: 0, credentialStoreAccessed: false });
  expect(Object.isFrozen(report)).toBe(true);
  const text = JSON.stringify(report); for (const value of ["SYNTHETIC", "PRIVATE", "https:", "/documents", "900719925", "organizationId", "documentId", "nameRu"]) expect(text).not.toContain(value);
}
it.each(["document-archive", "archive-document", "public-cities"] as const)("actual native%s capture is consistent without outputting DTOs", async kind => {
  const report = await replayNativeMetadataCapture(await nativeMetadataCaptureExample(kind));
  expect(report).toMatchObject({ status: "CONSISTENT_READ", queryKind: kind, consumerPhase: "ready", matchedRecords: kind === "document-archive" ? 2 : 1 }); expectPrivateReport(report);
});
it.each(["document-archive", "public-cities"] as const)("actual empty%s remains distinct from malformed input", async kind => {
  const input = await nativeMetadataCaptureExample(kind); input.records[0]!.body = kind === "public-cities" ? [] : { items: [], nextCursor: null };
  const report = await replayNativeMetadataCapture(input); expect(report).toMatchObject({ status: "CONSISTENT_READ", consumerPhase: "empty" }); expectPrivateReport(report);
});
it("archive independent GET records can arrive in either saved order", async () => {
  const input = await nativeMetadataCaptureExample(); input.records.reverse(); expect(await replayNativeMetadataCapture(input)).toMatchObject({ status: "CONSISTENT_READ", matchedRecords: 2 });
});
it.each([403, 404, 429, 500])("summary HTTP%s leaves an explicit limited page, never complete capture acceptance", async status => {
  const input = await nativeMetadataCaptureExample(), saved = input.records.find(record => record.path.endsWith("/summary"))!;
  saved.httpStatus = status; saved.body = archiveEnvelope(status).payload;
  const report = await replayNativeMetadataCapture(input); expect(report).toMatchObject({ status: "LIMITED_READ", consumerPhase: "ready", summaryIssue: status === 403 ? "denied" : status === 404 ? "unavailable" : status === 429 ? "retry-limited" : "error" }); expectPrivateReport(report);
});
it("malformed summary is limited even when its page succeeds", async () => {
  const input = await nativeMetadataCaptureExample(); input.records.find(record => record.path.endsWith("/summary"))!.body = { total: 0 };
  expect(await replayNativeMetadataCapture(input)).toMatchObject({ status: "LIMITED_READ", consumerPhase: "ready", summaryIssue: "contract-error" });
});
it("summary authentication failure retains the actual consumer authentication boundary", async () => {
  const input = await nativeMetadataCaptureExample(), saved = input.records.find(record => record.path.endsWith("/summary"))!; saved.httpStatus = 401; saved.body = archiveEnvelope(401).payload;
  expect(await replayNativeMetadataCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", consumerPhase: "authentication-required" });
});
it("unconfirmed source pagination is reported as a limited read", async () => {
  const input = await nativeMetadataCaptureExample(), saved = input.records.find(record => !record.path.endsWith("/summary"))!; row(saved.body).nextCursor = archiveId(90001);
  expect(await replayNativeMetadataCapture(input)).toMatchObject({ status: "LIMITED_READ", pagination: "unconfirmed", summaryIssue: null });
});
it.each([401, 403, 404, 429, 500])("actual public city HTTP%s is classified without retry or raw error output", async status => {
  const input = await nativeMetadataCaptureExample("public-cities"); input.records[0]!.httpStatus = status; input.records[0]!.body = archiveEnvelope(status).payload;
  const report = await replayNativeMetadataCapture(input); expect(report).toMatchObject({ status: "CONSUMER_REJECTED", consumerPhase: status === 401 ? "authentication-required" : status === 403 ? "denied" : status === 404 ? "unavailable" : status === 429 ? "retry-limited" : "error", matchedRecords: 1 }); expectPrivateReport(report);
});
it.each(["document-archive", "archive-document"] as const)("foreign owner%s is rejected before private document title", async kind => {
  const input = await nativeMetadataCaptureExample(kind), document = kind === "archive-document" ? row(input.records[0]!.body) : (row(input.records[0]!.body).items as Row[])[0]!; document.ownerOrganizationId = archiveId(90002); const getter = hidden(document, "title");
  const report = await replayNativeMetadataCapture(input); expect(report).toMatchObject({ status: "CONSUMER_REJECTED", consumerPhase: "visibility-unverified" }); expect(getter).not.toHaveBeenCalled(); expectPrivateReport(report);
});
it("wrong selected document ID is rejected before its private title", async () => {
  const input = await nativeMetadataCaptureExample("archive-document"), body = row(input.records[0]!.body); body.id = archiveId(90003); const getter = hidden(body, "title");
  expect(await replayNativeMetadataCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", consumerPhase: "contract-error" }); expect(getter).not.toHaveBeenCalled();
});
it("native archive card reads forward identity fields without inspecting originals/signature/history/money", async () => {
  const input = await nativeMetadataCaptureExample("archive-document"), body = row(input.records[0]!.body), getters = ["checksumSha256", "amountMinor", "currency", "signatures", "versions", "paymentIntent", "downloadUrl"].map(key => hidden(body, key));
  const report = await replayNativeMetadataCapture(input); expect(report.status).toBe("CONSISTENT_READ"); for (const getter of getters) expect(getter).not.toHaveBeenCalled(); expectPrivateReport(report);
});
it("duplicate city IDs are rejected before names and private reference data", async () => {
  const input = await nativeMetadataCaptureExample("public-cities"), rows = input.records[0]!.body as Row[]; rows[1]!.id = rows[0]!.id; const getter = hidden(rows[0]!, "nameRu");
  expect(await replayNativeMetadataCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", consumerPhase: "contract-error" }); expect(getter).not.toHaveBeenCalled();
});
it.each(["method", "path", "httpStatus", "missing body", "extra headers", "duplicate path", "missing record", "extra record"] as const)("rejects%s capture metadata without touching document body", async mode => {
  const input = await nativeMetadataCaptureExample(), saved = input.records[0]!, getter = hidden(saved, "body"), raw = row(saved);
  if (mode === "method") raw.method = "POST";
  else if (mode === "path") raw.path = "/documents/archive?wrong=true";
  else if (mode === "httpStatus") raw.httpStatus = 199;
  else if (mode === "missing body") { Object.defineProperty(saved, "body", { configurable: true, value: undefined }); delete raw.body; }
  else if (mode === "extra headers") raw.headers = { Authorization: "PRIVATE_TOKEN" };
  else if (mode === "duplicate path") input.records[1]!.path = saved.path;
  else if (mode === "missing record") input.records.pop();
  else input.records.push({ ...input.records[1]! });
  expect(await replayNativeMetadataCapture(input)).toMatchObject({ status: "INPUT_INVALID", stage: "capture" }); expect(getter).not.toHaveBeenCalled();
});
it.each(["root token", "scope token", "query key", "query kind", "query filter"] as const)("rejects%s before capture body", async mode => {
  const input = await nativeMetadataCaptureExample(), getter = hidden(input.records[0]!, "body");
  if (mode === "root token") Object.defineProperty(input, "accessToken", { get: () => { throw Error("PRIVATE_TOKEN"); } });
  else if (mode === "scope token") row(input).scope = { ...input.scope, cookie: "PRIVATE_COOKIE" };
  else if (mode === "query key") row(input.query).headers = {};
  else if (mode === "query kind") row(input.query).kind = "archive-signatures";
  else row(input.query).input = { organizationId: archiveId(90004) };
  const report = await replayNativeMetadataCapture(input); expect(report.status).toBe("INPUT_INVALID"); expect(getter).not.toHaveBeenCalled(); expectPrivateReport(report);
});
it("a throwing body accessor cannot forge an actual HTTP response", async () => {
  const input = await nativeMetadataCaptureExample("public-cities"); Object.defineProperty(input.records[0]!, "body", { get: () => { throw archiveEnvelope(401); } });
  expect(await replayNativeMetadataCapture(input)).toMatchObject({ status: "INPUT_INVALID", stage: "capture", matchedRecords: 1 });
});
it("metadata replay performs no fetch, timers, credential or write capability calls", async () => {
  const input = await nativeMetadataCaptureExample(), fetch = jest.spyOn(globalThis, "fetch").mockRejectedValue(Error("FORBIDDEN_NETWORK")), timer = jest.spyOn(globalThis, "setTimeout");
  try { const report = await replayNativeMetadataCapture(input); expect(report.status).toBe("CONSISTENT_READ"); expect(fetch).not.toHaveBeenCalled(); expect(timer).not.toHaveBeenCalled(); expectPrivateReport(report); }
  finally { fetch.mockRestore(); timer.mockRestore(); }
});
