import { afterEach, describe, expect, it, vi } from "vitest";
import { SecurityCryptoService } from "./security-crypto.service";

afterEach(() => vi.unstubAllEnvs());
describe("protected identity values", () => {
  it("uses stable purpose-separated keyed fingerprints and randomized authenticated encryption", () => {
    vi.stubEnv("APP_SECURITY_ENCRYPTION_KEY", Buffer.alloc(32, 1).toString("base64"));
    const crypto = new SecurityCryptoService(), value = "000000000001";
    const first = crypto.encrypt(value), second = crypto.encrypt(value);
    expect(first).not.toBe(second); expect(crypto.decrypt(first)).toBe(value);
    expect(crypto.fingerprint(value, "identity")).toBe(new SecurityCryptoService().fingerprint(value, "identity"));
    expect(crypto.fingerprint(value, "identity")).not.toBe(crypto.fingerprint(value, "another-purpose"));
    vi.stubEnv("APP_SECURITY_ENCRYPTION_KEY", Buffer.alloc(32, 2).toString("base64"));
    const rotated = new SecurityCryptoService();
    expect(rotated.fingerprint(value, "identity")).not.toBe(crypto.fingerprint(value, "identity"));
    expect(() => rotated.decrypt(first)).toThrow();
  });
});
