import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
const transport = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("node:https", () => ({ request: transport.request }));
import { OutboundRequestGateway } from "./outbound-request.gateway";

class Gateway extends OutboundRequestGateway {
  send() { return this.dispatch(new URL("https://supplier.example/data"), { hostname: "supplier.example", address: { address: "93.184.216.34", family: 4 } }, { maxResponseBytes: 10 }); }
}
describe("rejected outbound transport lifetime", () => {
  function socket(headers: Record<string, string | undefined>, body?: string) {
    const response = Object.assign(new EventEmitter(), { headers, statusCode: 200, destroy: vi.fn(), resume: vi.fn() });
    const request = Object.assign(new EventEmitter(), { destroy: vi.fn(), write: vi.fn(), end: vi.fn() });
    transport.request.mockImplementation((_options, callback) => {
      request.end.mockImplementation(() => { callback(response); if (body !== undefined) { response.emit("data", body); response.emit("end"); } });
      return request;
    });
    return { response, request };
  }
  it.each([{ "content-encoding": "gzip" }, { "content-length": "1000000" }])("destroys both ends immediately on rejected headers %j", async headers => {
    const s = socket(headers);
    await expect(new Gateway().send()).rejects.toThrow();
    expect(s.response.destroy).toHaveBeenCalledOnce(); expect(s.request.destroy).toHaveBeenCalledOnce(); expect(s.response.resume).not.toHaveBeenCalled();
  });
  it("preserves the byte limit for chunked bodies", async () => {
    const s = socket({}, "a".repeat(11));
    await expect(new Gateway().send()).rejects.toThrow();
    expect(s.request.destroy).toHaveBeenCalledOnce(); expect(s.response.destroy).toHaveBeenCalledOnce();
  });
  it("keeps a bounded normal response usable", async () => {
    const s = socket({ "content-length": "2" }, "ok");
    await expect(new Gateway().send()).resolves.toMatchObject({ status: 200 });
    expect(s.request.destroy).not.toHaveBeenCalled(); expect(s.response.destroy).not.toHaveBeenCalled();
  });
});
