import { expect, it } from "vitest";
import { authClientOptionsSchema, authRegistrationAcceptedSchema, localOperatorLoginSchema, operatorLoginSchema, currentOperatorSessionSchema } from "./local-auth.js";
it("operator login accepts credentials only; absent sessions are explicit null", () => {
  expect(operatorLoginSchema.parse({ email: " OPERATOR@example.invalid ", password: " pw " })).toEqual({ email: "operator@example.invalid", password: " pw " });
  for (const extra of [{ organizationId: "tenant" }, { authMethods: ["operator_password"] }, { role: "OPERATOR" }]) expect(operatorLoginSchema.safeParse({ email: "operator@example.invalid", password: "pw", ...extra }).success).toBe(false);
  expect(currentOperatorSessionSchema.parse(null)).toBeNull();
});
it("normalizes email without accepting tenant/authority claims", () => {
  expect(localOperatorLoginSchema.parse({ email: " TEST@example.invalid ", password: "test" }).email).toBe("test@example.invalid");
  expect(localOperatorLoginSchema.safeParse({ email: "test@example.invalid", password: "test", organizationId: "injected" }).success).toBe(false);
});
it("requires explicit delivery and never accepts a token in public response", () => {
  expect(authRegistrationAcceptedSchema.safeParse({ ok: true, email: "test@example.invalid", verificationRequired: true }).success).toBe(false);
  expect(authClientOptionsSchema.safeParse({ localOperatorPasswordEnabled: true, emailDelivery: "LOCAL_FILE", token: "secret" }).success).toBe(false);
});
