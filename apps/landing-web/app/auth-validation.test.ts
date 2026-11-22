import { expect, it } from "vitest";
import { loginErrors, registrationErrors as validateRegistration } from "./auth-validation";

const registrationErrors = (form: Parameters<typeof validateRegistration>[0], confirmation = form.password) => validateRegistration(form, confirmation);

const valid = { ownerDisplayName: "Иван Иванов", email: "owner@example.invalid", password: "Test-password", organizationDisplayName: "Клиника", bin: "123456789012" };

it("accepts normalized email without removed registration fields", () => {
  expect(registrationErrors({ ...valid, email: " OWNER@example.invalid " })).toEqual({});
});
it.each([
  ["ownerDisplayName", 160], ["organizationDisplayName", 160], ["password", 128],
] as const)("enforces both boundaries for %s", (field, maximum) => {
  const minimum = field === "password" ? 8 : 2;
  expect(registrationErrors({ ...valid, [field]: "A".repeat(minimum) })[field]).toBeUndefined();
  expect(registrationErrors({ ...valid, [field]: "A".repeat(minimum - 1) })[field]).toBeTruthy();
  expect(registrationErrors({ ...valid, [field]: "A".repeat(maximum) })[field]).toBeUndefined();
  expect(registrationErrors({ ...valid, [field]: "A".repeat(maximum + 1) })[field]).toBeTruthy();
});
it("rejects malformed email, blank name, nonnumeric BIN", () => {
  const errors = registrationErrors({ ...valid, email: "a..b@example.invalid", ownerDisplayName: "  ", bin: "12345678901a" });
  expect(Object.keys(errors).sort()).toEqual(["bin", "email", "ownerDisplayName"]);
});
it("login accepts existing short passwords but rejects empty or overlong credentials", () => {
  expect(loginErrors(" OWNER@example.invalid ", "short")).toEqual({email: undefined, password: undefined});
  expect(loginErrors("invalid", "").email).toBeTruthy();
  expect(loginErrors(valid.email, "").password).toBeTruthy();
  expect(loginErrors(valid.email, "A".repeat(128)).password).toBeUndefined();
  expect(loginErrors(valid.email, "A".repeat(129)).password).toBeTruthy();
});

it("requires an exact password confirmation, preserving spaces and case", () => {
  expect(registrationErrors(valid, "").passwordConfirmation).toBe("Повторите пароль.");
  expect(registrationErrors(valid, "different-password").passwordConfirmation).toBe("Пароли не совпадают.");
  expect(registrationErrors(valid, valid.password.toUpperCase()).passwordConfirmation).toBeTruthy();
  expect(registrationErrors(valid, `${valid.password} `).passwordConfirmation).toBeTruthy();
  expect(registrationErrors(valid, valid.password).passwordConfirmation).toBeUndefined();
});
