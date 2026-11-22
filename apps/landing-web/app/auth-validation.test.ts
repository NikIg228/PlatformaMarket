import { expect, it } from "vitest";
import { loginErrors, registrationErrors as validateRegistration } from "./auth-validation";

const registrationErrors = (form: Parameters<typeof validateRegistration>[0], confirmation = form.password) => validateRegistration(form, confirmation);

const valid = { ownerDisplayName: "Иван Иванов", email: "owner@example.invalid", password: "test-password", legalName: "ТОО Клиника", organizationDisplayName: "Клиника", bin: "123456789012", termsAccepted: true, privacyAccepted: true };

it("accepts normalized email and optional marketing consent is not required", () => {
  expect(registrationErrors({ ...valid, email: " OWNER@example.invalid " })).toEqual({});
});
it.each([
  ["ownerDisplayName", 160], ["organizationDisplayName", 160], ["legalName", 240], ["password", 128],
] as const)("enforces both boundaries for %s", (field, maximum) => {
  const minimum = field === "password" ? 12 : 2;
  expect(registrationErrors({ ...valid, [field]: "a".repeat(minimum) })[field]).toBeUndefined();
  expect(registrationErrors({ ...valid, [field]: "a".repeat(minimum - 1) })[field]).toBeTruthy();
  expect(registrationErrors({ ...valid, [field]: "a".repeat(maximum) })[field]).toBeUndefined();
  expect(registrationErrors({ ...valid, [field]: "a".repeat(maximum + 1) })[field]).toBeTruthy();
});
it("rejects malformed email, blank name, nonnumeric BIN and missing required consents", () => {
  const errors = registrationErrors({ ...valid, email: "a..b@example.invalid", ownerDisplayName: "  ", bin: "12345678901a", privacyAccepted: false });
  expect(Object.keys(errors).sort()).toEqual(["bin", "consents", "email", "ownerDisplayName"]);
});
it("login accepts existing short passwords but rejects empty or overlong credentials", () => {
  expect(loginErrors(" OWNER@example.invalid ", "short")).toEqual({email: undefined, password: undefined});
  expect(loginErrors("invalid", "").email).toBeTruthy();
  expect(loginErrors(valid.email, "").password).toBeTruthy();
  expect(loginErrors(valid.email, "a".repeat(128)).password).toBeUndefined();
  expect(loginErrors(valid.email, "a".repeat(129)).password).toBeTruthy();
});

it("requires an exact password confirmation, preserving spaces and case", () => {
  expect(registrationErrors(valid, "").passwordConfirmation).toBe("Повторите пароль.");
  expect(registrationErrors(valid, "different-password").passwordConfirmation).toBe("Пароли не совпадают.");
  expect(registrationErrors(valid, valid.password.toUpperCase()).passwordConfirmation).toBeTruthy();
  expect(registrationErrors(valid, `${valid.password} `).passwordConfirmation).toBeTruthy();
  expect(registrationErrors(valid, valid.password).passwordConfirmation).toBeUndefined();
});
