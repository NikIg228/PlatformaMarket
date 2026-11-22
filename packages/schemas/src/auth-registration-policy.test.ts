import { expect, it } from "vitest";
import { createRegistrationIntentSchema, emailRegisterSchema, emailResetPasswordSchema, emailLoginSchema } from "./commercial";
it.each(["Abcdefgh", "A1234567", "A!@#$%^&", "AБвгдежз"])("accepts supported password %s", password => {
  expect(emailRegisterSchema.shape.password.safeParse(password).success).toBe(true);
  expect(emailResetPasswordSchema.shape.password.safeParse(password).success).toBe(true);
});
it.each(["Abcdefg", "abcdefgh", "А1234567", "12345678"])("rejects password without eight characters and Latin uppercase %s", password => {
  expect(emailRegisterSchema.shape.password.safeParse(password).success).toBe(false);
});
it("keeps existing login credentials valid", () => expect(emailLoginSchema.shape.password.safeParse("old").success).toBe(true));
it("leaves legal name blank and records mandatory agreement but no marketing opt-in", () => {
  const input = { email: "test@example.invalid", ownerDisplayName: "Test owner", organizationDisplayName: "Test clinic", bin: "123456789012", capability: "BUYER", termsAccepted: true, privacyAccepted: true, idempotencyKey: "test-registration" };
  expect(createRegistrationIntentSchema.parse(input)).toMatchObject({ legalName: "", termsAccepted: true, privacyAccepted: true, marketingConsent: false });
  expect(createRegistrationIntentSchema.safeParse({ ...input, termsAccepted: false }).success).toBe(false);
});
