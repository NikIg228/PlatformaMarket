import { jest } from "@jest/globals";
import { createMarketTransport, MarketHttpError, type FetchTransport, type MarketRequestMethod } from "./market-transport";
import { createMarketSession } from "./market-session";
import { createBuyerWorkflowTransport } from "./buyer-workflow-transport";
import { createOrderCancellationCommands } from "./order-cancellation-command";
import { createOrderCancellationDrafts } from "./order-cancellation-draft";
import type { BuyerWorkflowCommandFixture, CancelOrderInput } from "./order-workflow-command-fixture";
import { cancellationCommandScope, cancellationCommandAuthorization, cancellationCommandWorkflow, cancellationCommandResult } from "./test-fixtures/order-cancellation-command";
import { cancellationId as uuid } from "./test-fixtures/cancellation-draft";

const api = "https://market.example.invalid/api";
type Reply = Awaited<ReturnType<FetchTransport>>;
function deferred<T>() { let resolve!: (value: T) => void, reject!: (value: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function observe(work: Promise<unknown>) {
  let state: "pending" | "resolved" | "rejected" = "pending", value: unknown;
  const done = work.then(result => { state = "resolved"; value = result; }, error => { state = "rejected"; value = error; });
  return { state: () => state, value: () => value, done };
}
async function flush() { for (let i = 0; i < 30; i++) await Promise.resolve(); }
function interrupted(work: ReturnType<typeof observe>) {
  expect(work.state()).toBe("rejected"); expect(work.value()).toBeInstanceOf(Error); expect(work.value()).toMatchObject({ name: "AbortError", message: "API request interrupted" }); expect(work.value()).not.toBeInstanceOf(MarketHttpError);
}
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

it.each(["GET", "POST", "PATCH", "DELETE"] as const)("settles cancellation of %s even when native fetch ignores AbortSignal, without reading late body", async method => {
  const gate = deferred<Reply>(), text = jest.fn<() => Promise<string>>().mockResolvedValue('{"SYNTHETIC":"private late response"}'), reply = { status: 200, ok: true, text }, fetcher = jest.fn<FetchTransport>().mockImplementation(() => gate.promise), http = createMarketTransport(api, fetcher), work = observe(http.request("/synthetic", { method, ...(method === "GET" ? {} : { body: { reviewed: true } }) }));
  try {
    http.cancelAll(); await flush(); interrupted(work); expect(fetcher.mock.calls[0]![1].signal?.aborted).toBe(true); expect(fetcher).toHaveBeenCalledTimes(1); expect(text).not.toHaveBeenCalled();
    gate.resolve(reply); await flush(); expect(text).not.toHaveBeenCalled(); interrupted(work);
  } finally { gate.resolve(reply); await work.done; http.cancelAll(); }
});
it("settles existing 20s timeout even when native fetch never honors abort", async () => {
  jest.useFakeTimers(); const gate = deferred<Reply>(), text = jest.fn<() => Promise<string>>().mockResolvedValue("{}"), reply = { status: 200, ok: true, text }, fetcher = jest.fn<FetchTransport>().mockImplementation(() => gate.promise), http = createMarketTransport(api, fetcher), work = observe(http.request("/synthetic"));
  try {
    jest.advanceTimersByTime(19_999); await flush(); expect(work.state()).toBe("pending"); jest.advanceTimersByTime(1); await flush(); interrupted(work); expect(text).not.toHaveBeenCalled(); expect(fetcher).toHaveBeenCalledTimes(1);
    gate.resolve(reply); await flush(); expect(text).not.toHaveBeenCalled();
  } finally { gate.resolve(reply); await work.done; http.cancelAll(); }
});
it.each(["cancel", "timeout"] as const)("settles existing %s while response body ignores abort and skips late JSON/metadata", async reason => {
  jest.useFakeTimers(); const gate = deferred<string>(), privateWire = '{"SYNTHETIC":"private body after abort"}', metadata = jest.fn(() => true), text = jest.fn<() => Promise<string>>().mockImplementation(() => gate.promise), reply = { status: 200, get ok() { return metadata(); }, text }, fetcher = jest.fn<FetchTransport>().mockResolvedValue(reply), http = createMarketTransport(api, fetcher), parse = jest.spyOn(JSON, "parse"), work = observe(http.request("/synthetic"));
  try {
    await flush(); expect(text).toHaveBeenCalledTimes(1); if (reason === "cancel") http.cancelAll(); else jest.advanceTimersByTime(20_000); await flush(); interrupted(work);
    gate.resolve(privateWire); await flush(); expect(metadata).not.toHaveBeenCalled(); expect(parse.mock.calls.some(([wire]) => wire === privateWire)).toBe(false);
  } finally { gate.resolve(privateWire); await work.done; http.cancelAll(); }
});
it("settles cancellation before a late private fetch rejection without leaking/replacing the abort outcome", async () => {
  const gate = deferred<Reply>(), failure = Error("SYNTHETIC private late fetch error"), fetcher = jest.fn<FetchTransport>().mockImplementation(() => gate.promise), http = createMarketTransport(api, fetcher), work = observe(http.request("/synthetic"));
  try { http.cancelAll(); await flush(); interrupted(work); const original = work.value(); gate.reject(failure); await flush(); expect(work.value()).toBe(original); expect(fetcher).toHaveBeenCalledTimes(1); }
  finally { gate.reject(failure); await work.done; http.cancelAll(); }
});
it("does not dispatch if private body serialization cancels the request before fetch", async () => {
  const fetcher = jest.fn<FetchTransport>(), http = createMarketTransport(api, fetcher), body = { toJSON() { http.cancelAll(); return { reviewed: true }; } }, work = observe(http.request("/synthetic", { method: "POST", body }));
  await work.done; interrupted(work); expect(fetcher).not.toHaveBeenCalled();
});
it.each(["fetch", "body"] as const)("synchronous cancellation inside %s drops resolved response without parsing private data", async stage => {
  const privateWire = '{"SYNTHETIC":"private synchronous response"}', parse = jest.spyOn(JSON, "parse"), text = jest.fn<() => Promise<string>>().mockImplementation(async () => { http.cancelAll(); return privateWire; }), fetcher = jest.fn<FetchTransport>().mockImplementation(async () => { if (stage === "fetch") http.cancelAll(); return { status: 200, ok: true, text }; }), http = createMarketTransport(api, fetcher), work = observe(http.request("/synthetic"));
  await work.done; interrupted(work); expect(text).toHaveBeenCalledTimes(stage === "fetch" ? 0 : 1); expect(parse.mock.calls.some(([wire]) => wire === privateWire)).toBe(false);
});
it("cancelAll settles concurrent requests and remains reusable with a fresh request signal", async () => {
  const gate = deferred<Reply>(), reply = { status: 200, ok: true, text: async () => '{"fresh":true}' }, fetcher = jest.fn<FetchTransport>().mockImplementationOnce(() => gate.promise).mockImplementationOnce(() => gate.promise).mockResolvedValue(reply), http = createMarketTransport(api, fetcher), first = observe(http.request("/synthetic/1")), second = observe(http.request("/synthetic/2"));
  try {
    http.cancelAll(); await flush(); interrupted(first); interrupted(second); expect(fetcher.mock.calls.slice(0, 2).every(([, init]) => init.signal?.aborted)).toBe(true);
    await expect(http.request("/synthetic/3")).resolves.toEqual({ fresh: true }); const signal = fetcher.mock.calls[2]![1].signal!; expect(signal.aborted).toBe(false); http.cancelAll(); expect(signal.aborted).toBe(false);
  } finally { gate.resolve(reply); await Promise.all([first.done, second.done]); http.cancelAll(); }
});
it("keeps the same 20s budget across fetch and body instead of granting a second deadline", async () => {
  jest.useFakeTimers(); const fetchGate = deferred<Reply>(), bodyGate = deferred<string>(), text = jest.fn<() => Promise<string>>().mockImplementation(() => bodyGate.promise), reply = { status: 200, ok: true, text }, fetcher = jest.fn<FetchTransport>().mockImplementation(() => fetchGate.promise), http = createMarketTransport(api, fetcher), work = observe(http.request("/synthetic"));
  try {
    jest.advanceTimersByTime(15_000); fetchGate.resolve(reply); await flush(); expect(text).toHaveBeenCalledTimes(1); jest.advanceTimersByTime(4_999); await flush(); expect(work.state()).toBe("pending"); jest.advanceTimersByTime(1); await flush(); interrupted(work);
  } finally { fetchGate.resolve(reply); bodyGate.resolve("{}"); await work.done; http.cancelAll(); }
});
it("a completed request clears its timeout and is not aborted by a later cancelAll", async () => {
  jest.useFakeTimers(); const fetcher = jest.fn<FetchTransport>().mockResolvedValue({ status: 200, ok: true, text: async () => '{"done":true}' }), http = createMarketTransport(api, fetcher); await expect(http.request("/synthetic")).resolves.toEqual({ done: true });
  const signal = fetcher.mock.calls[0]![1].signal!; jest.advanceTimersByTime(20_000); http.cancelAll(); expect(signal.aborted).toBe(false); expect(jest.getTimerCount()).toBe(0);
});
it.each(["fetch", "body"] as const)("an active %s failure retains original error identity", async stage => {
  const failure = Error("SYNTHETIC original active failure"), fetcher = jest.fn<FetchTransport>().mockImplementation(async () => { if (stage === "fetch") throw failure; return { status: 200, ok: true, text: async () => { throw failure; } }; }), http = createMarketTransport(api, fetcher);
  await expect(http.request("/synthetic")).rejects.toBe(failure); expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each([400, 401, 403, 404, 409, 429])( "active HTTP%i retains source payload/status without retry", async status => {
  const payload = { statusCode: status, message: "SYNTHETIC source error" }, fetcher = jest.fn<FetchTransport>().mockResolvedValue({ status, ok: false, text: async () => JSON.stringify(payload) }), http = createMarketTransport(api, fetcher);
  await expect(http.request("/synthetic")).rejects.toMatchObject({ status, payload }); expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each(["", "SYNTHETIC non-JSON"])("active non-JSON/empty response keeps existing null payload semantics:%s", async wire => {
  const fetcher = jest.fn<FetchTransport>().mockResolvedValue({ status: 200, ok: true, text: async () => wire }), http = createMarketTransport(api, fetcher); await expect(http.request("/synthetic")).resolves.toBeNull();
});
it("default native session leaves checking with network issue on timeout and never decodes a late restore", async () => {
  jest.useFakeTimers(); const gate = deferred<Reply>(), text = jest.fn<() => Promise<string>>().mockResolvedValue('{"SYNTHETIC":"private late session"}'), reply = { status: 200, ok: true, text }, fetcher = jest.fn<FetchTransport>().mockImplementation(() => gate.promise), session = createMarketSession(api, fetcher), work = session.start();
  try {
    expect(session.getSnapshot().phase).toBe("working"); jest.advanceTimersByTime(20_000); await flush(); expect(session.getSnapshot()).toMatchObject({ phase: "signed-out", issue: "network", canLogout: false }); await work;
    gate.resolve(reply); await flush(); expect(text).not.toHaveBeenCalled(); expect(session.getSnapshot().session).toBeUndefined(); expect(fetcher).toHaveBeenCalledTimes(1);
  } finally { gate.resolve(reply); await work; session.requireLogin(); }
});
it("unknown committed POST after transport timeout preserves original key and one effect across explicit replay", async () => {
  jest.useFakeTimers(); const scope = Object.freeze({ ...cancellationCommandScope, environment: api }), key = uuid(68001), workflow = cancellationCommandWorkflow(), gate = deferred<Reply>();
  let receipt: ReturnType<typeof cancellationCommandResult> | null = null, effects = 0;
  const fetcher = jest.fn<FetchTransport>().mockImplementation((_url, init) => {
    if (receipt) return Promise.resolve({ status: 200, ok: true, text: async () => JSON.stringify(receipt) });
    receipt = cancellationCommandResult(workflow.orderId, JSON.parse(init.body as string) as CancelOrderInput); effects++; return gate.promise;
  }), http = createMarketTransport(api, fetcher), raw = createBuyerWorkflowTransport(scope, (path, body) => http.request(path, { method: "POST", body, token: "SYNTHETIC-bearer", csrf: "SYNTHETIC-csrf" }), () => true), nextKey = jest.fn(() => key), fixture: BuyerWorkflowCommandFixture = { authorization: { ...cancellationCommandAuthorization(), scope }, nextWorkflowIdempotencyKey: nextKey, executeOrderWorkflow: raw.execute }, drafts = createOrderCancellationDrafts(scope), model = createOrderCancellationCommands(scope, fixture, drafts, id => id === workflow.orderId ? workflow : null, async () => workflow, () => true);
  const rawReason = "  SYNTHETIC original timeout cancellation\nЕкінші жол  "; drafts.syncWorkflow(workflow); const target = drafts.begin(workflow)!; drafts.setReason(target, rawReason); drafts.setDeclaration(target, true); drafts.review(target); const first = model.submit(workflow, target);
  try {
    expect(fetcher).toHaveBeenCalledTimes(1); expect(model.stateFor(workflow.orderId).phase).toBe("pending"); jest.advanceTimersByTime(20_000); await flush(); expect(model.stateFor(workflow.orderId)).toMatchObject({ phase: "unknown", unresolved: true, rawReason }); await first;
    expect(nextKey).toHaveBeenCalledTimes(1); expect(effects).toBe(1); expect(fetcher).toHaveBeenCalledTimes(1); await model.replay(workflow.orderId); expect(model.stateFor(workflow.orderId)).toMatchObject({ phase: "receipt", unresolved: false }); expect(effects).toBe(1); expect(nextKey).toHaveBeenCalledTimes(1); expect(fetcher).toHaveBeenCalledTimes(2);
    const [firstUrl, firstInit] = fetcher.mock.calls[0]!, [secondUrl, secondInit] = fetcher.mock.calls[1]!; expect(secondUrl).toBe(firstUrl); expect(secondInit.body).toBe(firstInit.body); expect(secondInit.method).toBe("POST"); expect(JSON.parse(secondInit.body as string)).toMatchObject({ idempotencyKey: key, expectedVersion: workflow.version, reason: rawReason.trim() });
    const late = jest.fn<() => Promise<string>>().mockResolvedValue("SYNTHETIC private old response"); gate.resolve({ status: 200, ok: true, text: late }); await flush(); expect(late).not.toHaveBeenCalled(); expect(model.stateFor(workflow.orderId).phase).toBe("receipt");
  } finally { gate.resolve({ status: 200, ok: true, text: async () => JSON.stringify(receipt) }); await first; model.dispose(); drafts.close(); raw.close(); http.cancelAll(); }
});
