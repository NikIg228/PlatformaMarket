import { createRegistrationIntentSchema, emailLoginSchema, emailRegisterSchema } from "@marketplace/schemas";

const registrationFields = {
  ownerDisplayName: createRegistrationIntentSchema.shape.ownerDisplayName,
  email: createRegistrationIntentSchema.shape.email,
  password: emailRegisterSchema.shape.password,
  organizationDisplayName: createRegistrationIntentSchema.shape.organizationDisplayName,
  bin: createRegistrationIntentSchema.shape.bin,
};
const messages = {
  ownerDisplayName: "Укажите ФИО длиной от 2 до 160 символов.",
  email: "Укажите корректный рабочий email.",
  password: "Минимум 8 символов и одна заглавная латинская буква (A–Z) и одна цифра.",
  organizationDisplayName: "Укажите название в кабинете длиной от 2 до 160 символов.",
  bin: "БИН должен содержать ровно 12 цифр.",
};
type RegistrationFields = Record<keyof typeof registrationFields, string>;

export function registrationErrors(form: RegistrationFields, passwordConfirmation: string) {
  const errors: Partial<Record<keyof RegistrationFields | "passwordConfirmation", string>> = {};
  for (const key of Object.keys(registrationFields) as (keyof typeof registrationFields)[]) {
    const value = key === "email" ? form[key].trim() : form[key];
    if (!registrationFields[key].safeParse(value).success) errors[key] = messages[key];
  }
  if (!passwordConfirmation) errors.passwordConfirmation = "Повторите пароль.";
  else if (passwordConfirmation !== form.password) errors.passwordConfirmation = "Пароли не совпадают.";
  return errors;
}

export function loginErrors(email: string, password: string) {
  return {
    email: emailLoginSchema.shape.email.safeParse(email.trim()).success ? undefined : messages.email,
    password: emailLoginSchema.shape.password.safeParse(password).success ? undefined : "Введите пароль длиной не более 128 символов.",
  };
}
