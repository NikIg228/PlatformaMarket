import { describe, expect, it } from "vitest";
import { MarketplaceApiError } from "@marketplace/api-client";
import { NcalayerError } from "@marketplace/eds-client";
import { identityFailure, identityReason, normalizeIdentityCms } from "./identity-signing-feedback";

describe("identity recovery feedback", () => {
  it("claims retained CMS only for a known server verification state", () => {
    expect(identityReason("VERIFIER_UNAVAILABLE")).toContain("подпись сохранена");
    expect(identityFailure(new MarketplaceApiError(503, { code: "VERIFIER_UNAVAILABLE", message: "private failure" }))).not.toContain("сохранена");
  });
  it("does not reflect certificate details or native errors into the interface", () => {
    expect(identityFailure(new NcalayerError("private certificate", "SIGNING_REJECTED"))).not.toContain("private");
    expect(identityFailure(new Error("private receipt"))).not.toContain("private");
  });
  it("normalizes supported PEM transport without accepting arbitrary prefixes", () => {
    expect(normalizeIdentityCms("-----BEGIN CMS-----\nAQID\n-----END CMS-----")).toBe("AQID");
    expect(normalizeIdentityCms("untrusted:AQID")).toBe("untrusted:AQID");
  });
});
