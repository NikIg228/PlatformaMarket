import { afterEach, expect, it, vi } from "vitest";
import { resilientGet } from "./resilient-get";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it("recovers a guest session after the API restarts without inventing a login", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockResolvedValueOnce(new Response(null, { status: 503 })).mockResolvedValueOnce(Response.json(null));
  vi.stubGlobal("fetch", fetcher);
  const pending = resilientGet("/api/auth/current", { credentials: "include" });
  await vi.runAllTimersAsync();
  expect(await (await pending).json()).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(fetcher.mock.calls[2][1]).toMatchObject({ method: "GET", credentials: "include" });
});
it.each([400, 401, 403, 404, 429])("does not retry HTTP %s", async status => {
  const fetcher = vi.fn().mockResolvedValue(new Response(null, { status })); vi.stubGlobal("fetch", fetcher);
  expect((await resilientGet("/api/auth/current")).status).toBe(status);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("cancels the retry delay when navigating away", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 502 })); vi.stubGlobal("fetch", fetcher);
  const controller = new AbortController();
  const pending = resilientGet("/catalog-search", { signal: controller.signal });
  const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
  await vi.advanceTimersByTimeAsync(0); controller.abort(); await rejected;
  await vi.runAllTimersAsync(); expect(fetcher).toHaveBeenCalledTimes(1);
});
