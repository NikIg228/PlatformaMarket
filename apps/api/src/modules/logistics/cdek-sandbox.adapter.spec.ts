import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CdekSandboxAdapter } from "./cdek-sandbox.adapter";
import { OutboundRequestGateway } from "../../platform/security/outbound-request.gateway";

const response = (body: unknown, status = 200) => ({ ok: status < 300, status, text: async () => JSON.stringify(body) });
const token = () => response({ access_token: "test-token", expires_in: 3600 });
const input = { fromCityCode: 1, toCityCode: 2, packages: [{ weight: 1000, length: 20, width: 20, height: 10 }] };
const tariff = { tariff_code: 136, tariff_name: "Учебный тариф", delivery_mode: 4, delivery_sum: "123.45", period_min: 2, period_max: 4 };
describe("CDEK sandbox isolation and recovery", () => {
  const request = vi.fn();
  const adapter = () => new CdekSandboxAdapter({ request } as unknown as OutboundRequestGateway);
  beforeEach(() => {
    request.mockReset(); vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("LIMITED_TEST_STAND", "false");
    vi.stubEnv("CDEK_SANDBOX_ENABLED", "true"); vi.stubEnv("CDEK_SANDBOX_CLIENT_ID", "test-id"); vi.stubEnv("CDEK_SANDBOX_CLIENT_SECRET", "test-secret");
  });
  afterEach(() => vi.unstubAllEnvs());
  it.each(["production", "disabled", "limited", "missing-secret"])("fails closed in %s", async mode => {
    if (mode === "production") vi.stubEnv("NODE_ENV", "production");
    if (mode === "disabled") vi.stubEnv("CDEK_SANDBOX_ENABLED", "false");
    if (mode === "limited") vi.stubEnv("LIMITED_TEST_STAND", "true");
    if (mode === "missing-secret") vi.stubEnv("CDEK_SANDBOX_CLIENT_SECRET", "");
    await expect(adapter().quote(input)).rejects.toThrow(); expect(request).not.toHaveBeenCalled();
  });
  it("returns exact minor units and never a payable quote; reuses token", async () => {
    request.mockResolvedValueOnce(token()).mockResolvedValue(response({ tariff_codes: [tariff] }));
    const service = adapter();
    expect(await service.quote(input)).toMatchObject({ mode: "sandbox", payable: false, currency: "KZT", tariffs: [{ amountMinor: "12345" }] });
    await service.quote(input);
    expect(request).toHaveBeenCalledTimes(3);
    for (const [url, options] of request.mock.calls) {
      expect(url).toMatch(/^https:\/\/api\.edu\.cdek\.ru\/v2\//);
      expect(options.allowedHosts).toEqual(["api.edu.cdek.ru"]);
    }
    expect(JSON.parse(request.mock.calls[1][1].body)).toMatchObject({ currency: 2, packages: input.packages });
  });
  it("renews an expired token once", async () => {
    request.mockResolvedValueOnce(token()).mockResolvedValueOnce(response({}, 401)).mockResolvedValueOnce(token()).mockResolvedValueOnce(response([]));
    expect(await adapter().cities("Алматы")).toEqual([]); expect(request).toHaveBeenCalledTimes(4);
  });
  it("does not leak external errors or retry unknown failures", async () => {
    request.mockRejectedValue(new Error("secret provider response"));
    await expect(adapter().quote(input)).rejects.toThrow("Учебный сервис СДЭК недоступен");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it.each(["-1", "1.001", "NaN", "1000000000000"])("rejects invalid money %s", async amount => {
    request.mockResolvedValueOnce(token()).mockResolvedValueOnce(response({ tariff_codes: [{ ...tariff, delivery_sum: amount }] }));
    await expect(adapter().quote(input)).rejects.toThrow();
  });
  it("coalesces concurrent authentication", async () => {
    request.mockResolvedValueOnce(token()).mockResolvedValue(response([]));
    const service = adapter(); await Promise.all([service.cities("Алматы"), service.cities("Астана")]);
    expect(request.mock.calls.filter(([url]) => url.endsWith("/oauth/token"))).toHaveLength(1);
  });
});
