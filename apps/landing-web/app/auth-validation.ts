import { createRegistrationIntentSchema, emailLoginSchema, emailRegisterSchema } from "@marketplace/schemas";

const registrationFields = {
  ownerDisplayName: createRegistrationIntentSchema.shape.ownerDisplayName,
  email: createRegistrationIntentSchema.shape.email,
  password: emailRegisterSchema.shape.password,
  legalName: createRegistrationIntentSchema.shape.legalName,
  organizationDisplayName: createRegistrationIntentSchema.shape.organizationDisplayName,
  bin: createRegistrationIntentSchema.shape.bin,
};
const messages = {
  ownerDisplayName: "Укажите ФИО длиной от 2 до 160 символов.",
  email: "Укажите корректный рабочий email.",
  password: "Пароль должен содержать от 12 до 128 символов.",
  legalName: "Укажите юридическое наименование длиной от 2 до 240 символов.",
  organizationDisplayName: "Укажите название в кабинете длиной от 2 до 160 символов.",
  bin: "БИН должен содержать ровно 12 цифр.",
};
type RegistrationFields = Record<keyof typeof registrationFields, string> & { termsAccepted: boolean; privacyAccepted: boolean };

export function registrationErrors(form: RegistrationFields) {
  const errors: Partial<Record<keyof RegistrationFields | "consents", string>> = {};
  for (const key of Object.keys(registrationFields) as (keyof typeof registrationFields)[]) {
    const value = key === "email" ? form[key].trim() : form[key];
    if (!registrationFields[key].safeParse(value).success) errors[key] = messages[key];
  }
  if (!form.termsAccepted || !form.privacyAccepted) errors.consents = "Для регистрации примите условия использования и политику конфиденциальности.";
  return errors;
}

export function loginErrors(email: string, password: string) {
  return {
    email: emailLoginSchema.shape.email.safeParse(email.trim()).success ? undefined : messages.email,
    password: emailLoginSchema.shape.password.safeParse(password).success ? undefined : "Введите пароль длиной не более 128 символов.",
  };
}
