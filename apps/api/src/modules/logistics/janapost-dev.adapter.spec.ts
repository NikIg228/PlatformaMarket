import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OutboundRequestGateway } from "../../platform/security/outbound-request.gateway";
import { JanaPostDevAdapter } from "./janapost-dev.adapter";

describe("JanaPost DEV adapter", () => {
  const request = vi.fn();
  let adapter: JanaPostDevAdapter;

  beforeEach(() => {
    request.mockReset();
    adapter = new JanaPostDevAdapter({ request } as unknown as OutboundRequestGateway);
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("LIMITED_TEST_STAND", "false");
    vi.stubEnv("JANAPOST_DEV_ENABLED", "true");
    vi.stubEnv("JANAPOST_DEV_CLIENT_ID", "TEST_PARTNER");
    vi.stubEnv("JANAPOST_DEV_SECRET", "synthetic-secret");
    request.mockResolvedValue({ ok: true, text: async () => '{"status":"delivered"}' });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it.each([
    ["JANAPOST_DEV_ENABLED", "false"],
    ["NODE_ENV", "production"],
    ["LIMITED_TEST_STAND", "true"],
    ["JANAPOST_DEV_SECRET", ""],
  ])("blocks a signed call with %s=%s", async (name, value) => {
    vi.stubEnv(name, value);
    await expect(adapter.status("JPD123")).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });

  it("sends public address requests without partner headers", async () => {
    request.mockResolvedValue({ ok: true, text: async () => "[]" });
    await expect(adapter.addresses("KZ")).resolves.toEqual([]);
    expect(request).toHaveBeenCalledWith(
      "https://api.janapost.kz/branch_service/public/partnership/address/list",
      expect.objectContaining({
        allowedHosts: ["api.janapost.kz"],
        headers: { "Content-Type": "application/json" },
        body: '{"parentId":"KZ"}',
      }),
    );
  });

  it("signs the exact canonical body and separates timestamps within one millisecond", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const areaId = "11571c9b-5583-4a79-860e-2f94c7813580";
    await adapter.branches({ start: 0, length: 20, address: "Алматы", areaId });
    await expect(adapter.status("JPD123")).resolves.toBe("delivered");
    const [url, options] = request.mock.calls[0]!;
    const body = `{"address":"Алматы","areaId":"${areaId}","length":20,"start":0}`;
    const signed = "X-RequestClientType=ThirdServices&X-RequestClientID=TEST_PARTNER"
      + "&X-RequestTimestamp=1700000000000&data=" + body;
    expect(url).toBe("https://api-dev.janatest.kz/warehouse/admin/domestic/b2b/branch/list/near/address");
    expect(options.body).toBe(body);
    expect(options.headers["X-RequestClientSign"]).toBe(
      createHmac("sha256", "synthetic-secret").update(signed).digest("base64"),
    );
    expect(request.mock.calls[1]![1].headers["X-RequestTimestamp"]).toBe("1700000000001");
  });

  it("rejects invalid input before calling the provider", async () => {
    await expect(adapter.status("../other")).rejects.toThrow("трек-номер");
    expect(request).not.toHaveBeenCalled();
  });

  it("rejects an invalid status and masks a transport error", async () => {
    request.mockResolvedValueOnce({ ok: true, text: async () => '{"status":0}' });
    request.mockRejectedValueOnce(new Error("private transport details"));
    await expect(adapter.status("JPD123")).rejects.toMatchObject({
      response: { code: "JANAPOST_INVALID_RESPONSE" },
    });
    await expect(adapter.status("JPD123")).rejects.toMatchObject({
      response: { code: "JANAPOST_UNAVAILABLE" },
    });
  });

  it.each([401, 429, 503])("masks HTTP %s without reading the provider error body", async status => {
    const responseBody = vi.fn().mockResolvedValue("private provider diagnostics");
    request.mockResolvedValue({ ok: false, status, text: responseBody });
    await expect(adapter.status("JPD123")).rejects.toMatchObject({
      response: { code: "JANAPOST_UNAVAILABLE" },
    });
    expect(responseBody).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("separates a timed-out call from a later explicit retry", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    request.mockRejectedValueOnce(new Error("timeout"));
    await expect(adapter.status("JPD123")).rejects.toMatchObject({
      response: { code: "JANAPOST_UNAVAILABLE" },
    });
    expect(request).toHaveBeenCalledTimes(1);
    await expect(adapter.status("JPD123")).resolves.toBe("delivered");
    const [first, retry] = request.mock.calls;
    expect(retry![1].body).toBe(first![1].body);
    expect(retry![1].headers["X-RequestTimestamp"]).not.toBe(first![1].headers["X-RequestTimestamp"]);
    expect(retry![1].headers["X-RequestClientSign"]).not.toBe(first![1].headers["X-RequestClientSign"]);
  });

  it("rejects malformed JSON without exposing its content", async () => {
    request.mockResolvedValue({ ok: true, text: async () => "<html>private diagnostics</html>" });
    await expect(adapter.status("JPD123")).rejects.toMatchObject({
      response: { code: "JANAPOST_INVALID_RESPONSE" },
    });
  });
});
