import { describe, expect, it } from "vitest";
import type { OperatorCapabilities } from "@marketplace/schemas";
import { capabilityProjectionPartial, capabilityStates, formatOperatorCount } from "./operator-projection-view-model";

describe("operator projection presentation", () => {
  it("renders known zero differently from a failed source", () => {
    expect(formatOperatorCount({ status: "AVAILABLE", value: 0 })).toBe("0");
    expect(formatOperatorCount({ status: "UNAVAILABLE", value: null, reason: "SOURCE_UNAVAILABLE" })).toBe("Нет данных");
    expect(formatOperatorCount({ status: "AVAILABLE", value: 12001 }).replace(/\s/g, "")).toBe("12001");
  });
  it("does not present configured-but-unverified as profile availability", () => {
    expect(capabilityStates.EXTERNAL_CONFIRMATION_REQUIRED.label).toBe("Нужна внешняя проверка");
    expect(capabilityStates.EXTERNAL_CONFIRMATION_REQUIRED.tone).toBe("warning");
    expect(new Set(Object.values(capabilityStates).map(item => item.label)).size).toBe(5);
  });
  it("reports partial source failures even while all module flags are readable", () => {
    const data: OperatorCapabilities = { observedAt: "2026-10-14T00:00:00Z", profile: "pilot", scope: "PLATFORM_CONFIGURATION", capabilities: [], connectors: { status: "AVAILABLE", counts: { total: 0, readinessReady: 0, registeredLiveVerified: 0, externalDependencies: 0, blocked: 0 } }, activePaymentProviders: { status: "AVAILABLE", value: 0 }, activeComplianceRules: { status: "AVAILABLE", value: 0 } };
    expect(capabilityProjectionPartial(data)).toBe(false);
    expect(capabilityProjectionPartial({ ...data, activeComplianceRules: { status: "UNAVAILABLE", value: null, reason: "SOURCE_UNAVAILABLE" } })).toBe(true);
    expect(capabilityProjectionPartial({ ...data, connectors: { status: "UNAVAILABLE", counts: null, reason: "SOURCE_UNAVAILABLE" } })).toBe(true);
  });
});
