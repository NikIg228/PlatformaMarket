import { describe, expect, it } from "vitest";
import { sessionLogoutRequestSchema, sessionLogoutResponseSchema } from "./session-logout";
const sessionId = "10000000-0000-4000-8000-000000000001";
describe("exact session logout contract", () => {
  it("bounds a proof without accepting identity or parent selection", () => {
    const request = { sessionId, accessToken: "synthetic-access-token" };
    expect(sessionLogoutRequestSchema.parse(request)).toEqual(request);
    for (const extra of [{ userId: sessionId }, { originLoginSessionId: sessionId }, { organizationId: sessionId }, { accessToken: "a".repeat(8193) }, { sessionId: "all" }]) {
      expect(sessionLogoutRequestSchema.safeParse({ ...request, ...extra }).success).toBe(false);
    }
  });
  it("accepts only explicit terminal receipts, not a generic success or active status", () => {
    expect(sessionLogoutResponseSchema.parse({ sessionId, status: "REVOKED", loginStatus: "NOT_LINKED" }).sessionId).toBe(sessionId);
    for (const response of [{ ok: true }, { sessionId, status: "ACTIVE", loginStatus: "REVOKED" }, { sessionId, status: "REVOKED" }]) {
      expect(sessionLogoutResponseSchema.safeParse(response).success).toBe(false);
    }
  });
});
