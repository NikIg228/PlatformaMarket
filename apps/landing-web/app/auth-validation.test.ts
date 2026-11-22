import { expect, it } from "vitest";
import { loginErrors, registrationErrors as validateRegistration } from "./auth-validation";

const registrationErrors = (form: Parameters<typeof validateRegistration>[0], confirmation = form.password) => validateRegistration(form, confirmation);

const valid = { ownerDisplayName: "Иван Иванов", email: "owner@example.invalid", password: "Test-password1", organizationDisplayName: "Клиника", bin: "123456789012" };

it("accepts normalized email without removed registration fields", () => {
  expect(registrationErrors({ ...valid, email: " OWNER@example.invalid " })).toEqual({});
});
it.each([
  ["ownerDisplayName", 50], ["organizationDisplayName", 50], ["password", 128],
] as const)("enforces both boundaries for %s", (field, maximum) => {
  const minimum = field === "password" ? 8 : 2;
  expect(registrationErrors({ ...valid, [field]: "A1" + "a".repeat(minimum - 2) })[field]).toBeUndefined();
  expect(registrationErrors({ ...valid, [field]: field === "password" ? "A1" + "a".repeat(minimum - 3) : "A".repeat(minimum - 1) })[field]).toBeTruthy();
  expect(registrationErrors({ ...valid, [field]: "A1" + "a".repeat(maximum - 2) })[field]).toBeUndefined();
  expect(registrationErrors({ ...valid, [field]: "A1" + "a".repeat(maximum - 1) })[field]).toBeTruthy();
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

it("explains short names without advertising the maximum", () => {
  expect(registrationErrors({ ...valid, ownerDisplayName: "А", organizationDisplayName: "К" })).toMatchObject({ ownerDisplayName: "Укажите ФИО длиной от 2 символов.", organizationDisplayName: "Укажите название в кабинете длиной от 2 символов." });
  expect(registrationErrors({ ...valid, ownerDisplayName: "А".repeat(51), organizationDisplayName: "К".repeat(51) })).toMatchObject({ ownerDisplayName: "Сократите ФИО.", organizationDisplayName: "Сократите название в кабинете." });
});
