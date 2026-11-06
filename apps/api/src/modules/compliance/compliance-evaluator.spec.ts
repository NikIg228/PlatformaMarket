import { describe, expect, it } from "vitest";
import { evaluateCompliance, type ComplianceFacts, type ComplianceRuleInput } from "./compliance-evaluator";

const rule: ComplianceRuleInput = { id: "r1", code: "MEDICAL.REG", version: 3, riskLevel: "ORANGE", decision: "ALLOWED_WITH_DISCLOSURE", priority: 10, conditions: { requirements: { lotRequired: true, registrationCertificateRequired: true, minimumRemainingShelfLifeDays: 90 } }, requiredCredentialTypes: ["WHOLESALE_LICENSE"] };

describe("compliance evaluator", () => {
  const facts: ComplianceFacts = { at: new Date("2026-01-01"), sellerCapabilities: ["SUPPLIER"], buyerCapabilities: ["BUYER"], verifiedCredentialTypes: [] };
  const greenRule: ComplianceRuleInput = { ...rule, decision: "ALLOWED", riskLevel: "GREEN", requiredCredentialTypes: [], conditions: {} };

  it.each([
    { requiredCredentialAnyOf: [["LICENSE", "CERTIFICATE"]] },
    { lotRequired: true },
    { registrationCertificateRequired: true },
    { serialNumberRequired: true },
    { verifiedOriginRequired: true },
    { officialDistributorRequired: true },
    { minimumRemainingShelfLifeDays: 90 },
  ])("requires review for unmet requirement %j", (requirements) => {
    expect(evaluateCompliance([{ ...greenRule, conditions: { requirements } }], facts)).toMatchObject({ decision: "MANUAL_REVIEW", riskLevel: "ORANGE", status: "REVIEW_REQUIRED" });
  });

  it.each(["LICENSE", "CERTIFICATE"])("accepts either verified alternative: %s", (credential) => {
    const result = evaluateCompliance([{ ...greenRule, conditions: { requirements: { requiredCredentialAnyOf: [["LICENSE", "CERTIFICATE"]] } } }], { ...facts, verifiedCredentialTypes: [credential] });
    expect(result.status).toBe("PASSED");
    expect(result.missingCredentials).toEqual([]);
  });

  it("requires one credential from every alternative group and preserves BLOCKED", () => {
    const conditions = { requirements: { requiredCredentialAnyOf: [["LICENSE", "CERTIFICATE"], ["IMPORT", "DISTRIBUTOR"]] } };
    const partial = { ...facts, verifiedCredentialTypes: ["LICENSE"] };
    expect(evaluateCompliance([{ ...greenRule, conditions }], partial).status).toBe("REVIEW_REQUIRED");
    expect(evaluateCompliance([{ ...greenRule, conditions }], { ...partial, verifiedCredentialTypes: ["LICENSE", "IMPORT"] }).status).toBe("PASSED");
    expect(evaluateCompliance([{ ...greenRule, conditions, decision: "BLOCKED", riskLevel: "RED" }], partial)).toMatchObject({ status: "BLOCKED", riskLevel: "RED" });
  });

  it("does not interpret disclosure text or an inapplicable rule as an unmet requirement", () => {
    const disclosureText = "Не указан срок доставки; требуется уточнение условий";
    const allowed = evaluateCompliance([{ ...greenRule, disclosureText }], facts);
    expect(allowed.status).toBe("PASSED");
    expect(allowed.reasons).toContain(disclosureText);
    expect(evaluateCompliance([{ ...greenRule, conditions: { when: { sellerCapabilitiesAny: ["MANUFACTURER"] }, requirements: { requiredCredentialAnyOf: [["LICENSE"]] } } }], facts).status).toBe("PASSED");
  });

  it("preserves fulfilled lot/distributor requirements and the exact shelf-life boundary", () => {
    const requirements = { lotRequired: true, registrationCertificateRequired: true, serialNumberRequired: true, verifiedOriginRequired: true, officialDistributorRequired: true, minimumRemainingShelfLifeDays: 90 };
    const valid = { ...facts, officialDistributor: true, lot: { status: "ACTIVE", registrationCertificate: "certificate", serialNumber: "serial", originSource: "DIRECT", expirationDate: new Date(facts.at.getTime() + 90 * 86_400_000) } };
    expect(evaluateCompliance([{ ...greenRule, conditions: { requirements } }], valid).status).toBe("PASSED");
    expect(evaluateCompliance([{ ...greenRule, conditions: { requirements } }], { ...valid, lot: { ...valid.lot, expirationDate: new Date(valid.lot.expirationDate.getTime() - 1) } }).status).toBe("REVIEW_REQUIRED");
  });

  it("routes missing license and registration certificate to manual review", () => {
    const result = evaluateCompliance([rule], { at: new Date("2026-01-01"), sellerCapabilities: ["SUPPLIER"], buyerCapabilities: ["BUYER"], verifiedCredentialTypes: [], lot: { status: "ACTIVE", expirationDate: new Date("2026-12-01") } });
    expect(result.status).toBe("REVIEW_REQUIRED");
    expect(result.missingCredentials).toEqual(["WHOLESALE_LICENSE"]);
  });

  it("blocks recalled or expired lots regardless of configured green rules", () => {
    const result = evaluateCompliance([], { at: new Date("2026-01-01"), sellerCapabilities: [], buyerCapabilities: [], verifiedCredentialTypes: [], lot: { status: "RECALLED" } });
    expect(result).toMatchObject({ decision: "BLOCKED", riskLevel: "RED", status: "BLOCKED" });
  });
});
