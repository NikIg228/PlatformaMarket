import { jest } from "@jest/globals";
import { createReadController } from "./read-controller";
import { bindMarketReads, MarketHttpError } from "./market-transport";
import { createSupportCommandCaptureKernel, supportCommandCaptureKinds, submitSupportCapture, type SupportCommandCaptureKind } from "./test-fixtures/support-command-capture-kernel";
import { supportCommandCaptureExample, type SupportCommandCaptureExample } from "./test-fixtures/support-command-capture-example";
import { replaySupportCommandCapture, type SupportCommandCaptureReport } from "./test-fixtures/support-command-capture-replay";
import { supportId, supportSummary, supportDetail } from "./test-fixtures/support";
import { commandFields, commandEnvelope } from "./test-fixtures/support-commands";

async function example(kind: SupportCommandCaptureKind = "support-create") { return JSON.parse(JSON.stringify(await supportCommandCaptureExample(kind))) as SupportCommandCaptureExample; }
const request = (input: SupportCommandCaptureExample) => input.operation.requestBody as Record<string, unknown>;
const result = (input: SupportCommandCaptureExample) => input.operation.body as Record<string, unknown>;
function hidden(target: object, field: string) { const getter = jest.fn(() => { throw Error("SENSITIVE_SUPPORT_CAPTURE"); }); Object.defineProperty(target, field, { configurable: true, enumerable: true, get: getter }); return getter; }
function flags(report: SupportCommandCaptureReport) {
  expect(Object.isFrozen(report)).toBe(true); expect(report).toMatchObject({ responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY", modelAuthorization: "SYNTHETIC_ONLY", reviewProvenance: "SIMULATED_SOURCE_FORM_ONLY", nativeBindingPerformed: false, nativeKeyProviderAccessed: false, businessEligibilityVerified: false, productionAuthorizationVerified: false, serverAccepted: false, effectProven: false, independentPostResponseReadPerformed: false, privateFileBytesAccessed: false, credentialStoreAccessed: false, realNetworkRequests: 0, realServerMutations: 0 });
  for (const field of ["scope", "expected", "query", "parent", "operation", "body", "requestBody", "ticketId", "ticketVersion", "idempotencyKey", "subject", "description", "number", "messages", "links", "path", "error"]) expect(report).not.toHaveProperty(field);
  for (const text of ["SENSITIVE", "00000000-", "SYNTHETIC user", "SYNTHETIC private", "SYNTHETIC обращение"]) expect(JSON.stringify(report)).not.toContain(text);
}
afterEach(() => jest.restoreAllMocks());

it.each(supportCommandCaptureKinds)("saved %s uses the actual original forms, models and source routes", async kind => {
  const input = await supportCommandCaptureExample(kind), before = JSON.stringify(input), report = await replaySupportCommandCapture(input);
  expect(report).toMatchObject({ status: "CONSISTENT_RESPONSE", parentPhase: "ready", operationPhase: "success", sourceResponseAccepted: true, unresolved: false, parentGetCalls: 1, commandCalls: 1, syntheticCapturedKeyReads: 1, nativeBindingPerformed: false, nativeKeyProviderAccessed: false, serverAccepted: false, effectProven: false, realNetworkRequests: 0, realServerMutations: 0 });
  expect(JSON.stringify(input)).toBe(before);
  flags(report);
});
it.each([null, [], {}, { formatVersion: 2 }, { formatVersion: 1, kind: "operator-support" }])("invalid root stays redacted: %p", async input => { const report = await replaySupportCommandCapture(input); expect(report.status).toBe("INPUT_INVALID"); flags(report); });
it.each(["root", "scope", "query", "query-input", "parent", "operation"])("extra private %s field is rejected before any saved body", async field => {
  const input = await example(), body = hidden(input.parent, "body"), receipt = hidden(input.operation, "body"), target = field === "root" ? input : field === "scope" ? input.scope : field === "query" ? input.query! : field === "query-input" ? input.query!.input : field === "parent" ? input.parent : input.operation, secret = hidden(target, "headers");
  expect((await replaySupportCommandCapture(input)).status).toBe("INPUT_INVALID"); for (const getter of [body, receipt, secret]) expect(getter).not.toHaveBeenCalled();
});
it.each(["product", "environment", "userId", "organizationId", "generation"] as const)("invalid %s scope stops before parent or request", async field => {
  const input = await example(), body = hidden(input.parent, "body"), command = hidden(input.operation, "requestBody"); Object.assign(input.scope, { [field]: field === "generation" ? 0 : field === "environment" ? "http://private.invalid/api" : "SENSITIVE" });
  expect(await replaySupportCommandCapture(input)).toMatchObject({ status: "INPUT_INVALID", parentGetCalls: 0, commandCalls: 0, syntheticCapturedKeyReads: 0 }); expect(body).not.toHaveBeenCalled(); expect(command).not.toHaveBeenCalled();
});
it.each(supportCommandCaptureKinds)("%s refuses mismatched root/query/expected pairing", async kind => {
  const input = await example(kind), body = hidden(input.parent, "body"); if (kind === "support-create") input.expected = { ticketId: supportId(60), ticketVersion: 3 }; else input.query = (await example()).query;
  expect((await replaySupportCommandCapture(input)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
it.each(supportCommandCaptureKinds)("%s validates both headers before any saved body", async kind => {
  for (const [field, value] of [["method", "DELETE"], ["httpStatus", 600], ["httpStatus", "201"], ["path", ""]] as const) {
    const input = await example(kind), body = hidden(input.parent, "body"); Object.assign(input.operation, { [field]: value }); expect((await replaySupportCommandCapture(input)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
  }
});
it.each(supportCommandCaptureKinds)("%s exact path drift cannot consume the mismatched body", async kind => {
  for (const field of ["parent", "operation"] as const) { const input = await example(kind); input[field].path += "?SENSITIVE=true"; const body = hidden(input[field], "body"); const report = await replaySupportCommandCapture(input); expect(report).toMatchObject({ status: "INPUT_INVALID", commandCalls: 0 }); expect(body).not.toHaveBeenCalled(); flags(report); }
});
it.each(supportCommandCaptureKinds)("%s parent HTTP refusal prevents request, key and command access", async kind => {
  for (const status of [401, 403, 404, 429, 500]) { const input = await example(kind); input.parent.httpStatus = status; input.parent.body = commandEnvelope(status).payload; const body = hidden(input.operation, "body"), command = hidden(input.operation, "requestBody");
    const report = await replaySupportCommandCapture(input); expect(report).toMatchObject({ status: "CONSUMER_REJECTED", commandCalls: 0, syntheticCapturedKeyReads: 0 }); expect(body).not.toHaveBeenCalled(); expect(command).not.toHaveBeenCalled(); flags(report); }
});
it.each(supportCommandCaptureKinds)("%s command HTTP failures retain original known versus unknown outcome", async kind => {
  for (const status of [400, 401, 403, 404, 409, 429, 500]) { const input = await example(kind); input.operation.httpStatus = status; input.operation.body = commandEnvelope(status).payload; const report = await replaySupportCommandCapture(input);
    expect(report).toMatchObject({ status: "CONSUMER_REJECTED", operationPhase: status >= 429 ? "unknown" : "rejected", sourceResponseAccepted: false, unresolved: status >= 429, parentGetCalls: 1, commandCalls: 1, syntheticCapturedKeyReads: 1 }); flags(report); }
});
it.each(["id", "version", "organizationId"] as const)("reply parent %s binds before subject or public messages", async field => {
  const input = await example("support-reply"), parent = input.parent.body as ReturnType<typeof supportDetail>; if (field === "version") parent.version++; else parent[field] = supportId(99); const subject = hidden(parent, "subject"), messages = hidden(parent, "messages"), command = hidden(input.operation, "requestBody");
  expect(await replaySupportCommandCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", parentPhase: "contract-error", commandCalls: 0, syntheticCapturedKeyReads: 0 }); for (const getter of [subject, messages, command]) expect(getter).not.toHaveBeenCalled();
});
it("foreign support-list row stops before private fields or command", async () => {
  const input = await example(), row = (input.parent.body as ReturnType<typeof supportSummary>[])[0]!; row.organizationId = supportId(99); const subject = hidden(row, "subject"), command = hidden(input.operation, "requestBody");
  expect(await replaySupportCommandCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", commandCalls: 0 }); expect(subject).not.toHaveBeenCalled(); expect(command).not.toHaveBeenCalled();
});
it.each(["internal-message", "wrong-message-ticket", "wrong-link-ticket"])("reply %s metadata stops before private content", async changed => {
  const input = await example("support-reply"), parent = input.parent.body as ReturnType<typeof supportDetail>; if (changed === "internal-message") parent.messages[0]!.isInternal = true; else if (changed === "wrong-message-ticket") parent.messages[0]!.ticketId = supportId(99); else parent.links[0]!.ticketId = supportId(99);
  const body = hidden(parent.messages[0]!, "body"), subject = hidden(parent, "subject"); expect(await replaySupportCommandCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", commandCalls: 0 }); expect(body).not.toHaveBeenCalled(); expect(subject).not.toHaveBeenCalled();
});
it.each(["RESOLVED", "CLOSED"] as const)("new reply cannot submit to %s ticket", async status => {
  const input = await example("support-reply"); (input.parent.body as ReturnType<typeof supportDetail>).status = status; const body = hidden(input.operation, "body"), report = await replaySupportCommandCapture(input); expect(report).toMatchObject({ status: "UNSUPPORTED_CONTEXT", commandCalls: 0, syntheticCapturedKeyReads: 0 }); expect(body).not.toHaveBeenCalled(); flags(report);
});
it("an empty successfully read support list still enables the original synthetic create form", async () => { const input = await example(); input.parent.body = []; expect(await replaySupportCommandCapture(input)).toMatchObject({ status: "CONSISTENT_RESPONSE", parentPhase: "empty", commandCalls: 1 }); });
it("own organization ticket requester need not be the current user for the original public reply model", async () => { const input = await example("support-reply"); (input.parent.body as ReturnType<typeof supportDetail>).requesterId = supportId(99); expect((await replaySupportCommandCapture(input)).status).toBe("CONSISTENT_RESPONSE"); });
it.each(["subject", "description", "category"])("noncanonical create %s fails exact prepared wire before response", async field => {
  const input = await example(); request(input)[field] = "  " + request(input)[field] + "  "; const body = hidden(input.operation, "body"); expect(await replaySupportCommandCapture(input)).toMatchObject({ status: "INPUT_INVALID", commandCalls: 0 }); expect(body).not.toHaveBeenCalled();
});
it.each(supportCommandCaptureKinds)("%s rejects invalid or exposed captured key before response", async kind => {
  const input = await example(kind); request(input).idempotencyKey = "SENSITIVE"; const body = hidden(input.operation, "body"); const report = await replaySupportCommandCapture(input); expect(report).toMatchObject({ status: "INPUT_INVALID", commandCalls: 0, syntheticCapturedKeyReads: 0 }); expect(body).not.toHaveBeenCalled(); flags(report);
});
it.each(["links", "attachments", "reopen", "isInternal"])("outside-subset %s cannot expand support create or reply", async field => {
  const input = await example(field === "links" ? "support-create" : "support-reply"), body = hidden(input.operation, "body"), file = {}, secret = hidden(file, "private"); request(input)[field] = field === "isInternal" ? true : field === "reopen" ? true : [file];
  const report = await replaySupportCommandCapture(input); expect(report.status).toBe("INPUT_INVALID"); expect(report.commandCalls).toBe(0); expect(body).not.toHaveBeenCalled(); expect(secret).not.toHaveBeenCalled(); flags(report);
});
it.each(["organizationId", "requesterId"])("create response %s binds before private ticket fields", async field => {
  const input = await example(); result(input)[field] = supportId(99); const subject = hidden(result(input), "subject"), description = hidden(result(input), "description");
  const report = await replaySupportCommandCapture(input); expect(report).toMatchObject({ status: "CONSUMER_REJECTED", operationPhase: "invalid-result", sourceResponseAccepted: false, unresolved: true, commandCalls: 1 }); expect(subject).not.toHaveBeenCalled(); expect(description).not.toHaveBeenCalled(); flags(report);
});
it.each(["subject", "description", "category", "priority"])("create receipt %s must match the original submitted fields", async field => {
  const input = await example(); result(input)[field] = field === "priority" ? "URGENT" : "SENSITIVE"; const report = await replaySupportCommandCapture(input); expect(report).toMatchObject({ status: "CONSUMER_REJECTED", operationPhase: "invalid-result", unresolved: true }); flags(report);
});
it.each(["ticketId", "authorId", "isInternal"])("reply receipt %s binds before private text", async field => {
  const input = await example("support-reply"); result(input)[field] = field === "isInternal" ? true : supportId(99); const body = hidden(result(input), "body");
  const report = await replaySupportCommandCapture(input); expect(report).toMatchObject({ status: "CONSUMER_REJECTED", operationPhase: "invalid-result", unresolved: true }); expect(body).not.toHaveBeenCalled(); flags(report);
});
it("reply receipt rejects unrequested files without inspecting descriptors", async () => {
  const input = await example("support-reply"), file = {}, descriptor = hidden(file, "assetId"); result(input).attachments = [file]; const body = hidden(result(input), "body");
  const report = await replaySupportCommandCapture(input); expect(report).toMatchObject({ status: "CONSUMER_REJECTED", operationPhase: "invalid-result", unresolved: true }); expect(body).not.toHaveBeenCalled(); expect(descriptor).not.toHaveBeenCalled(); flags(report);
});
it("reply receipt body must match the actual prepared public message", async () => { const input = await example("support-reply"); result(input).body = "SENSITIVE"; const report = await replaySupportCommandCapture(input); expect(report).toMatchObject({ status: "CONSUMER_REJECTED", operationPhase: "invalid-result", unresolved: true }); flags(report); });
it.each(supportCommandCaptureKinds)("%s malformed409 remains unknown without a manufactured known conflict", async kind => { const input = await example(kind); input.operation.httpStatus = 409; input.operation.body = {}; const report = await replaySupportCommandCapture(input); expect(report).toMatchObject({ status: "CONSUMER_REJECTED", operationPhase: "unknown", unresolved: true }); flags(report); });
it.each(["parent", "operation"] as const)("throwing %s body cannot forge a known HTTP denial", async field => { const input = await example(); Object.defineProperty(input[field], "body", { get: () => { throw new MarketHttpError(403, commandEnvelope(403).payload); } }); const report = await replaySupportCommandCapture(input); expect(report.status).toBe("INPUT_INVALID"); flags(report); });
it("the default native read binding still exposes neither support writer nor key provider", async () => {
  const input = await example(), client = bindMarketReads(async () => input.parent.body, input.scope.organizationId), controller = createReadController({ scope: input.scope, client });
  try { await controller.load(input.query!); expect(controller.getSnapshot().state.phase).toBe("ready"); expect(client).not.toHaveProperty("supportCommandFixture"); expect(controller.supportCreateCommand.isAvailable()).toBe(false); expect(controller.supportReplyCommands.isAvailable()).toBe(false); } finally { controller.dispose(); }
});
it("late create response after kernel close cannot inspect result identity or text", async () => {
  const input = await example(); let finish!: (value: unknown) => void; const kernel = createSupportCommandCaptureKernel(input.scope, async () => input.parent.body, () => new Promise(resolve => { finish = resolve; }), () => supportId(339));
  await kernel.controller.load(input.query!); const work = submitSupportCapture(kernel.controller, "support-create", commandFields); expect(kernel.capturedKeyReads()).toBe(1); kernel.close(); const body = {}, id = hidden(body, "id"), subject = hidden(body, "subject"); finish(body); await work; expect(id).not.toHaveBeenCalled(); expect(subject).not.toHaveBeenCalled();
});
it("both generated captures and replays avoid global fetch and returned-ID reads", async () => {
  const fetcher = jest.spyOn(globalThis, "fetch").mockRejectedValue(Error("Unexpected offline network")); for (const kind of supportCommandCaptureKinds) { const report = await replaySupportCommandCapture(await supportCommandCaptureExample(kind)); expect(report).toMatchObject({ status: "CONSISTENT_RESPONSE", parentGetCalls: 1, commandCalls: 1 }); flags(report); } expect(fetcher).not.toHaveBeenCalled();
});
