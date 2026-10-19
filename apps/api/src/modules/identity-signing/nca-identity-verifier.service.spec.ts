import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { NcaIdentityVerifierService } from "./nca-identity-verifier.service";
import type { MarketplaceEnvironment } from "../../platform/config/environment";
import { environment } from "../../platform/config/environment";
import { readFile } from "node:fs/promises";

vi.mock("../../platform/config/environment", () => ({ environment: vi.fn() }));
vi.mock("node:fs/promises", () => ({ readFile: vi.fn() }));
const hash = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const policy = Buffer.from("deployment-owned-policy");
const now = Date.now();
const input = { original: Buffer.from("server-owned challenge"), cms: Buffer.from("synthetic CMS"),
  createdAt: new Date(now - 1000), acceptedAt: new Date(now) };
function receipt() {
  return { protocol: 1, status: "VERIFIED", trustProfile: "TEST", policySha256: hash(policy),
    iin: "000000000001", originalSha256: hash(input.original), cmsSha256: hash(input.cms), certificateSha256: "a".repeat(64),
    verifiedAt: new Date(now).toISOString(), timestampAt: new Date(now).toISOString(),
    validFrom: new Date(now - 86400000).toISOString(), validUntil: new Date(now + 86400000).toISOString(),
    certificatesBase64: Array(6).fill("AQID"),
    revocations: Array.from({ length: 4 }, () => ({ source: "https://pki.example.test/crl", sha256: hash("crl"),
      contentBase64: Buffer.from("crl").toString("base64"), thisUpdate: new Date(now - 86400000).toISOString(), nextUpdate: new Date(now + 86400000).toISOString() })),
  };
}
const settings = { NODE_ENV: "test", NCA_IDENTITY_JAVA_PATH: "/trusted/java", NCA_IDENTITY_CLASSPATH: "/trusted/classes",
  NCA_IDENTITY_POLICY_PATH: "/trusted/policy", NCA_IDENTITY_POLICY_SHA256: hash(policy) };
function fixture() {
  const service = new NcaIdentityVerifierService();
  const execute = vi.spyOn(service as unknown as { execute(binary: string, args: string[], input: string): Promise<string> }, "execute")
    .mockResolvedValue(JSON.stringify(receipt()));
  return { service, execute };
}
beforeEach(() => {
  vi.mocked(environment).mockReturnValue({ ...settings } as MarketplaceEnvironment);
  vi.mocked(readFile).mockResolvedValue(policy);
});

describe("bounded independent identity verifier adapter", () => {
  it("binds verified receipts to both server bytes and CMS; sends private material through stdin only", async () => {
    const f = fixture();
    expect((await f.service.verify(input)).status).toBe("VERIFIED");
    const [binary, args, stdin] = f.execute.mock.calls[0];
    expect(binary).toBe(settings.NCA_IDENTITY_JAVA_PATH);
    expect(args).not.toContain(input.cms.toString("base64"));
    expect(stdin.split("\n")).toEqual([input.original.toString("base64"), input.cms.toString("base64"), input.createdAt.toISOString(), input.acceptedAt.toISOString(), ""]);
  });
  it("does not launch without complete pinned configuration or if the file changed", async () => {
    const f = fixture();
    vi.mocked(readFile).mockResolvedValue(Buffer.from("changed"));
    expect(await f.service.verify(input)).toMatchObject({ code: "VERIFIER_UNAVAILABLE" });
    vi.mocked(environment).mockReturnValue({ NODE_ENV: "test" } as MarketplaceEnvironment);
    expect(await f.service.verify(input)).toMatchObject({ code: "VERIFIER_UNAVAILABLE" });
    expect(f.execute).not.toHaveBeenCalled();
  });
  it("rejects a wrong payload, stale receipt, stale CRL or modified evidence", async () => {
    const f = fixture();
    for (const change of [
      { originalSha256: "0".repeat(64) }, { cmsSha256: "0".repeat(64) }, { policySha256: "0".repeat(64) },
      { verifiedAt: new Date(now - 180000).toISOString() },
      { revocations: receipt().revocations.map(crl => ({ ...crl, nextUpdate: new Date(now - 1).toISOString() })) },
      { revocations: receipt().revocations.map(crl => ({ ...crl, contentBase64: "AQID" })) },
    ]) {
      f.execute.mockResolvedValueOnce(JSON.stringify({ ...receipt(), ...change }));
      expect(await f.service.verify(input)).toMatchObject({ code: "VERIFIER_UNAVAILABLE" });
    }
  });
  it("denies test trust in production and does not disclose process errors", async () => {
    const f = fixture();
    vi.mocked(environment).mockReturnValue({ ...settings, NODE_ENV: "production" } as MarketplaceEnvironment);
    expect(await f.service.verify(input)).toMatchObject({ code: "VERIFIER_UNAVAILABLE" });
    f.execute.mockRejectedValueOnce(new Error("private certificate and filesystem data"));
    expect(await f.service.verify(input)).toEqual({ protocol: 1, status: "REJECTED", code: "VERIFIER_UNAVAILABLE" });
    f.execute.mockResolvedValueOnce("malformed JSON");
    expect(await f.service.verify(input)).toMatchObject({ code: "VERIFIER_UNAVAILABLE" });
  });
  it("bounds concurrent verifier processes and releases capacity on failure", async () => {
    const f = fixture(); const releases: Array<(value: string) => void> = [];
    f.execute.mockImplementation(() => new Promise(resolve => { releases.push(resolve); }));
    const one = f.service.verify(input), two = f.service.verify(input);
    await vi.waitFor(() => expect(f.execute).toHaveBeenCalledTimes(2));
    expect(await f.service.verify(input)).toMatchObject({ code: "VERIFIER_UNAVAILABLE" });
    // Resolve both test promises individually; the real process wrapper has its own timeout.
    const output = JSON.stringify({ protocol: 1, status: "REJECTED", code: "INVALID_SIGNATURE" });
    releases[0](output); releases[1](output); await Promise.all([one, two]);
    f.execute.mockResolvedValueOnce(output);
    expect(await f.service.verify(input)).toMatchObject({ code: "INVALID_SIGNATURE" });
  });
});
