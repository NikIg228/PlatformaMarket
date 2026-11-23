import { afterEach, describe, expect, it } from "vitest";
import { SignatureAdapterRegistry } from "./signature-adapter-registry.service";
import { ConfiguredSignatureAdapter, MockSignatureAdapter } from "./signature-adapter";

const originalNodeEnv = process.env.NODE_ENV;
const originalGateway = process.env.SIGNATURE_GATEWAY_URL;

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = originalNodeEnv;
  if (originalGateway === undefined) delete process.env.SIGNATURE_GATEWAY_URL; else process.env.SIGNATURE_GATEWAY_URL = originalGateway;
});

describe("signature adapter registry", () => {
  it.each(["EDS", "EGOV_QR", "EXTERNAL"] as const)("never substitutes a mock for unconfigured %s", (method) => {
    process.env.NODE_ENV = "development";
    delete process.env.SIGNATURE_GATEWAY_URL;
    expect(() => new SignatureAdapterRegistry().resolve(method)).toThrow("SIGNATURE_GATEWAY_URL is missing");
    expect(new SignatureAdapterRegistry().capabilities().methods).not.toContain(method);
  });

  it.each(["MOCK", "SIMPLE"] as const)("allows explicit %s only outside production", (method) => {
    process.env.NODE_ENV = "test";
    expect(new SignatureAdapterRegistry().resolve(method)).toBeInstanceOf(MockSignatureAdapter);
    process.env.NODE_ENV = "production";
    expect(() => new SignatureAdapterRegistry().resolve(method)).toThrow("unavailable in production");
    expect(new SignatureAdapterRegistry().capabilities().methods).not.toContain(method);
  });

  it("uses the configured gateway for external signing", () => {
    process.env.NODE_ENV = "production";
    process.env.SIGNATURE_GATEWAY_URL = "https://signing.example.test";
    expect(new SignatureAdapterRegistry().resolve("EDS")).toBeInstanceOf(ConfiguredSignatureAdapter);
    expect(new SignatureAdapterRegistry().capabilities()).toEqual({ methods: ["EDS", "EGOV_QR", "EXTERNAL"], configuredExternalGateway: true });
  });

  it("fails closed when the production EDS gateway is absent", () => {
    process.env.NODE_ENV = "production";
    delete process.env.SIGNATURE_GATEWAY_URL;
    expect(() => new SignatureAdapterRegistry().resolve("EDS")).toThrow("SIGNATURE_GATEWAY_URL is missing");
  });
});
