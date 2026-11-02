import { jest } from "@jest/globals";
import { MarketHttpError } from "./market-transport";
import { supportRecoveryCases, supportCommandRecoveryExample, type SupportRecoveryCase, type SupportRecoveryExample } from "./test-fixtures/support-command-recovery-example";
import { replaySupportCommandRecovery, type SupportRecoveryReport } from "./test-fixtures/support-command-recovery-replay";
import { supportDetail, supportSummary, supportId } from "./test-fixtures/support";
import { commandEnvelope, createdTicket } from "./test-fixtures/support-commands";
import type { CreateSupportInput } from "./support-command-fixture";

async function example(caseId: SupportRecoveryCase = "reply-http-500") { return JSON.parse(JSON.stringify(await supportCommandRecoveryExample(caseId))) as SupportRecoveryExample; }
const request = (input: SupportRecoveryExample, field: "initial" | "replay" = "replay") => input[field].requestBody as Record<string, unknown>;
const result = (input: SupportRecoveryExample) => input.replay.body as Record<string, unknown>;
function hidden(target: object, field: string) { const getter = jest.fn(() => { throw Error("SENSITIVE_SUPPORT_RECOVERY"); }); Object.defineProperty(target, field, { configurable: true, enumerable: true, get: getter }); return getter; }
function flags(report: SupportRecoveryReport) {
  expect(Object.isFrozen(report)).toBe(true); expect(report).toMatchObject({ responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY", modelAuthorization: "SYNTHETIC_ONLY", reviewProvenance: "SIMULATED_SOURCE_RECOVERY_ONLY", nativeBindingPerformed: false, nativeKeyProviderAccessed: false, businessEligibilityVerified: false, productionAuthorizationVerified: false, serverAccepted: false, effectProven: false, automaticRetryPerformed: false, returnedIdReadPerformed: false, privateFileBytesAccessed: false, credentialStoreAccessed: false, realNetworkRequests: 0, realServerMutations: 0 });
  for (const field of ["scope", "expected", "query", "parent", "initial", "observation", "replay", "body", "requestBody", "ticketId", "ticketVersion", "idempotencyKey", "subject", "description", "number", "messages", "links", "path", "error"]) expect(report).not.toHaveProperty(field);
  for (const text of ["SENSITIVE", "00000000-", "SYNTHETIC private", "SYNTHETIC user"]) expect(JSON.stringify(report)).not.toContain(text);
}
afterEach(() => jest.restoreAllMocks());

it.each(supportRecoveryCases)("saved %s retains original model key/input across independent read and explicit retry", async caseId => {
  const input = await supportCommandRecoveryExample(caseId), before = JSON.stringify(input), report = await replaySupportCommandRecovery(input);
  expect(report).toMatchObject({ status: "CONSISTENT_RECOVERY", parentPhase: "ready", observationPhase: "ready", initialPhase: caseId.endsWith("http-500") ? "unknown" : "invalid-result", retryPhase: "success", initialResponseAccepted: false, sourceResponseAccepted: true, unresolved: false, retainedPriorRead: false, samePreparedRequest: true, explicitSourceRetryPerformed: true, parentGetCalls: 1, observationGetCalls: 1, commandCalls: 2, syntheticCapturedKeyReads: 1, nativeBindingPerformed: false, nativeKeyProviderAccessed: false, serverAccepted: false, effectProven: false, automaticRetryPerformed: false, returnedIdReadPerformed: false, realNetworkRequests: 0, realServerMutations: 0 });
  expect(input.initial.requestBody).toEqual(input.replay.requestBody); expect(input.initial.path).toBe(input.replay.path); expect(input.parent.path).toBe(input.observation.path); expect(JSON.stringify(input)).toBe(before);
  flags(report);
});
it.each([null, [], {}, { formatVersion: 2 }, { formatVersion: 1, kind: "operator-recovery" }])("invalid root remains local/redacted: %p", async input => { const report = await replaySupportCommandRecovery(input); expect(report).toMatchObject({ status: "INPUT_INVALID", parentGetCalls: 0, observationGetCalls: 0, commandCalls: 0, syntheticCapturedKeyReads: 0 }); flags(report); });
it.each(["root", "scope", "expected", "parent", "initial", "observation", "replay"])("unexpected private %s header is rejected before any saved body", async field => {
  const input = await example(), first = hidden(input.parent, "body"), last = hidden(input.replay, "body"), target = field === "root" ? input : field === "scope" ? input.scope : field === "expected" ? input.expected! : input[field as "parent" | "initial" | "observation" | "replay"], secret = hidden(target, "headers");
  const report = await replaySupportCommandRecovery(input); expect(report.status).toBe("INPUT_INVALID"); for (const getter of [first, last, secret]) expect(getter).not.toHaveBeenCalled(); flags(report);
});
it.each(["product", "environment", "userId", "organizationId", "generation"] as const)("invalid %s scope cannot read or retry", async field => {
  const input = await example(), first = hidden(input.parent, "body"); Object.assign(input.scope, { [field]: field === "generation" ? 0 : field === "environment" ? "http://private.invalid/api" : "SENSITIVE" }); expect(await replaySupportCommandRecovery(input)).toMatchObject({ status: "INPUT_INVALID", parentGetCalls: 0, commandCalls: 0, syntheticCapturedKeyReads: 0 }); expect(first).not.toHaveBeenCalled();
});
it.each(["parent", "initial", "observation", "replay"] as const)("all %s headers are checked before the first saved body", async field => {
  const input = await example(), first = hidden(input.parent, "body"); input[field].method = field === "parent" || field === "observation" ? "POST" : "GET"; expect((await replaySupportCommandRecovery(input)).status).toBe("INPUT_INVALID"); expect(first).not.toHaveBeenCalled();
});
it.each(["parent", "initial", "observation", "replay"] as const)("wrong %s path cannot inspect that body", async field => {
  const input = await example(); input[field].path += "?SENSITIVE=true"; const body = hidden(input[field], "body"), report = await replaySupportCommandRecovery(input); expect(report.status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled(); flags(report);
});
it.each(supportRecoveryCases)("%s known initial denial never dispatches observation or retry", async caseId => {
  const input = await example(caseId); input.initial.httpStatus = 400; input.initial.body = commandEnvelope(400).payload; const observation = hidden(input.observation, "body"), replay = hidden(input.replay, "body");
  const report = await replaySupportCommandRecovery(input); expect(report).toMatchObject({ status: "UNSUPPORTED_CONTEXT", initialPhase: "rejected", observationGetCalls: 0, commandCalls: 1, syntheticCapturedKeyReads: 1, explicitSourceRetryPerformed: false }); expect(observation).not.toHaveBeenCalled(); expect(replay).not.toHaveBeenCalled(); flags(report);
});
it("a known successful initial create is not automatically retried by the unresolved-only format", async () => {
  const input = await example("create-http-500"); input.initial.httpStatus = 201; input.initial.body = createdTicket(input.initial.requestBody as CreateSupportInput); const observation = hidden(input.observation, "body"), replay = hidden(input.replay, "body");
  const report = await replaySupportCommandRecovery(input); expect(report).toMatchObject({ status: "UNSUPPORTED_CONTEXT", initialPhase: "success", initialResponseAccepted: true, observationGetCalls: 0, commandCalls: 1, explicitSourceRetryPerformed: false }); expect(observation).not.toHaveBeenCalled(); expect(replay).not.toHaveBeenCalled(); flags(report);
});
it.each(supportRecoveryCases)("%s observation HTTP refusal prevents retry request/response access", async caseId => {
  for (const status of [401, 403, 404, 429, 500]) { const input = await example(caseId); input.observation.httpStatus = status; input.observation.body = commandEnvelope(status).payload; const body = hidden(input.replay, "body"), command = hidden(input.replay, "requestBody"), report = await replaySupportCommandRecovery(input);
    expect(report).toMatchObject({ status: "CONSUMER_REJECTED", observationGetCalls: 1, commandCalls: 1, syntheticCapturedKeyReads: 1, sourceResponseAccepted: false, explicitSourceRetryPerformed: false }); expect(body).not.toHaveBeenCalled(); expect(command).not.toHaveBeenCalled(); flags(report); }
});
it.each(["id", "organizationId"] as const)("reply observation %s binds before private metadata", async field => {
  const input = await example(), observation = input.observation.body as ReturnType<typeof supportDetail>; observation[field] = supportId(99); const subject = hidden(observation, "subject"), messages = hidden(observation, "messages"), replay = hidden(input.replay, "body");
  const report = await replaySupportCommandRecovery(input); expect(report).toMatchObject({ status: "CONSUMER_REJECTED", commandCalls: 1, explicitSourceRetryPerformed: false }); for (const getter of [subject, messages, replay]) expect(getter).not.toHaveBeenCalled(); flags(report);
});
it("foreign observed list row fails before private fields and the retained retry", async () => {
  const input = await example("create-http-500"), row = (input.observation.body as ReturnType<typeof supportSummary>[])[0]!; row.organizationId = supportId(99); const title = hidden(row, "subject"), replay = hidden(input.replay, "body"); expect(await replaySupportCommandRecovery(input)).toMatchObject({ status: "CONSUMER_REJECTED", commandCalls: 1, explicitSourceRetryPerformed: false }); expect(title).not.toHaveBeenCalled(); expect(replay).not.toHaveBeenCalled();
});
it.each(["isInternal", "ticketId"] as const)("unbound public observation message %s prevents private body and retry", async field => {
  const input = await example(), row = (input.observation.body as ReturnType<typeof supportDetail>).messages[0]!; if (field === "isInternal") row.isInternal = true; else row.ticketId = supportId(99); const body = hidden(row, "body"), replay = hidden(input.replay, "body"); expect(await replaySupportCommandRecovery(input)).toMatchObject({ status: "CONSUMER_REJECTED", commandCalls: 1 }); expect(body).not.toHaveBeenCalled(); expect(replay).not.toHaveBeenCalled();
});
it.each(supportRecoveryCases)("%s a different saved replay key cannot replace the original attempt", async caseId => {
  const input = await example(caseId); request(input).idempotencyKey = supportId(999); const body = hidden(input.replay, "body"), report = await replaySupportCommandRecovery(input); expect(report).toMatchObject({ status: "INPUT_INVALID", commandCalls: 1, syntheticCapturedKeyReads: 1, samePreparedRequest: false, sourceResponseAccepted: false }); expect(body).not.toHaveBeenCalled(); flags(report);
});
it.each(["body", "isInternal", "attachments", "reopen"])("changed reply retry %s cannot expand or replace its original wire", async field => {
  const input = await example(); request(input)[field] = field === "body" ? "SENSITIVE" : field === "attachments" ? [{}] : true; const body = hidden(input.replay, "body"), report = await replaySupportCommandRecovery(input); expect(report).toMatchObject({ status: "INPUT_INVALID", commandCalls: 1, syntheticCapturedKeyReads: 1 }); expect(body).not.toHaveBeenCalled(); flags(report);
});
it.each(["subject", "description", "category", "priority", "links"])("changed create retry %s cannot replace the retained fields", async field => {
  const input = await example("create-http-500"); request(input)[field] = field === "priority" ? "URGENT" : field === "links" ? [{}] : "SENSITIVE changed field"; const body = hidden(input.replay, "body"); expect(await replaySupportCommandRecovery(input)).toMatchObject({ status: "INPUT_INVALID", commandCalls: 1, syntheticCapturedKeyReads: 1 }); expect(body).not.toHaveBeenCalled();
});
it.each(supportRecoveryCases)("%s a failed replay cannot erase the earlier unknown outcome", async caseId => {
  for (const status of [400, 401, 403, 404, 409, 429, 500]) { const input = await example(caseId); input.replay.httpStatus = status; input.replay.body = commandEnvelope(status).payload; const report = await replaySupportCommandRecovery(input);
    expect(report).toMatchObject({ status: "CONSUMER_REJECTED", retryPhase: "unknown", unresolved: true, sourceResponseAccepted: false, samePreparedRequest: true, explicitSourceRetryPerformed: true, commandCalls: 2, syntheticCapturedKeyReads: 1 }); flags(report); }
});
it.each(["organizationId", "requesterId"])("create retry response %s binds before private subject", async field => {
  const input = await example("create-http-500"); result(input)[field] = supportId(99); const subject = hidden(result(input), "subject"), report = await replaySupportCommandRecovery(input);
  expect(report).toMatchObject({ status: "CONSUMER_REJECTED", retryPhase: "invalid-result", unresolved: true, samePreparedRequest: true, syntheticCapturedKeyReads: 1 }); expect(subject).not.toHaveBeenCalled(); flags(report);
});
it.each(["ticketId", "authorId", "isInternal"])("reply retry response %s binds before private text", async field => {
  const input = await example(); result(input)[field] = field === "isInternal" ? true : supportId(99); const body = hidden(result(input), "body"), report = await replaySupportCommandRecovery(input);
  expect(report).toMatchObject({ status: "CONSUMER_REJECTED", retryPhase: "invalid-result", unresolved: true, samePreparedRequest: true }); expect(body).not.toHaveBeenCalled(); flags(report);
});
it("retry response cannot append an unrequested file or inspect its descriptors", async () => {
  const input = await example(), file = {}, descriptor = hidden(file, "assetId"); result(input).attachments = [file]; const body = hidden(result(input), "body"), report = await replaySupportCommandRecovery(input);
  expect(report).toMatchObject({ status: "CONSUMER_REJECTED", retryPhase: "invalid-result", unresolved: true }); expect(body).not.toHaveBeenCalled(); expect(descriptor).not.toHaveBeenCalled(); flags(report);
});
it.each(["body", "subject"])("retry receipt %s must still match retained original content", async field => {
  const input = await example(field === "body" ? "reply-http-500" : "create-http-500"); result(input)[field] = "SENSITIVE"; const report = await replaySupportCommandRecovery(input); expect(report).toMatchObject({ status: "CONSUMER_REJECTED", retryPhase: "invalid-result", unresolved: true, commandCalls: 2, syntheticCapturedKeyReads: 1 }); flags(report);
});
it.each(["initial", "observation", "replay"] as const)("throwing %s body cannot forge a known HTTP denial", async field => {
  const input = await example(); Object.defineProperty(input[field], "body", { get: () => { throw new MarketHttpError(403, commandEnvelope(403).payload); } }); const report = await replaySupportCommandRecovery(input); expect(report.status).toBe("INPUT_INVALID"); flags(report);
});
it("a much newer own CLOSED observation still resolves the original unknown public reply with its old key", async () => {
  const input = await example(); const observation = input.observation.body as ReturnType<typeof supportDetail>; observation.version = 33; observation.requesterId = supportId(99);
  const report = await replaySupportCommandRecovery(input); expect(report).toMatchObject({ status: "CONSISTENT_RECOVERY", observationPhase: "ready", retryPhase: "success", samePreparedRequest: true, syntheticCapturedKeyReads: 1 }); flags(report);
});
it("unknown create retry can use the retained form even when the independent own list is empty", async () => { const input = await example("create-http-500"); input.observation.body = []; const report = await replaySupportCommandRecovery(input); expect(report).toMatchObject({ status: "CONSISTENT_RECOVERY", observationPhase: "empty", samePreparedRequest: true, syntheticCapturedKeyReads: 1 }); flags(report); });
it("all source recovery generation/replays avoid global fetch and arbitrary returned-ID reads", async () => { const fetcher = jest.spyOn(globalThis, "fetch").mockRejectedValue(Error("Unexpected source network")); for (const caseId of supportRecoveryCases) { const report = await replaySupportCommandRecovery(await supportCommandRecoveryExample(caseId)); expect(report).toMatchObject({ status: "CONSISTENT_RECOVERY", parentGetCalls: 1, observationGetCalls: 1, commandCalls: 2, returnedIdReadPerformed: false }); flags(report); } expect(fetcher).not.toHaveBeenCalled(); });
it.each(["reply-http-500", "reply-invalid-receipt"] as const)("%s older ignored ticket DTO cannot certify a new observation before retry", async caseId => {
  const input = await example(caseId); (input.observation.body as ReturnType<typeof supportDetail>).version = input.expected!.ticketVersion - 1;
  const report = await replaySupportCommandRecovery(input); expect(report).toMatchObject({ status: "UNSUPPORTED_CONTEXT", observationPhase: "ready", retainedPriorRead: true, explicitSourceRetryPerformed: false, samePreparedRequest: false, commandCalls: 1, syntheticCapturedKeyReads: 1, sourceResponseAccepted: false, unresolved: true }); flags(report);
});
it.each(["reply-http-500", "reply-invalid-receipt"] as const)("%s retained prior ticket view cannot inspect retry request or receipt", async caseId => {
  const input = await example(caseId); (input.observation.body as ReturnType<typeof supportDetail>).version = input.expected!.ticketVersion - 1; const request = hidden(input.replay, "requestBody"), body = hidden(input.replay, "body");
  const report = await replaySupportCommandRecovery(input); expect(report).toMatchObject({ status: "UNSUPPORTED_CONTEXT", retainedPriorRead: true, commandCalls: 1, syntheticCapturedKeyReads: 1 }); expect(request).not.toHaveBeenCalled(); expect(body).not.toHaveBeenCalled(); flags(report);
});
it.each(["reply-http-500", "reply-invalid-receipt"] as const)("%s freshly accepted same-version ticket still permits original retained-key recovery", async caseId => {
  const input = await example(caseId), observation = input.observation.body as ReturnType<typeof supportDetail>; observation.version = input.expected!.ticketVersion; observation.status = "OPEN";
  const report = await replaySupportCommandRecovery(input); expect(report).toMatchObject({ status: "CONSISTENT_RECOVERY", retainedPriorRead: false, samePreparedRequest: true, explicitSourceRetryPerformed: true, commandCalls: 2, syntheticCapturedKeyReads: 1 }); flags(report);
});
