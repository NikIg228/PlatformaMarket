import { z } from "zod";
import { organizationProfileFieldsSchema } from "./organization-profile";

// Format/checksum only: neither a valid IBAN nor a saved tax status is external verification.
export function validKazakhstanIban(value: string): boolean {
  if (!/^KZ\d{2}[A-Z0-9]{16}$/.test(value)) return false;
  let remainder = 0;
  for (const character of value.slice(4) + value.slice(0, 4)) {
    const digits = /[A-Z]/.test(character) ? String(character.charCodeAt(0) - 55) : character;
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

export const organizationBankAccountSchema = z.object({
  id: z.uuid(),
  bankName: z.string().trim().min(2, "Укажите название банка").max(200),
  iban: z.string().trim().toUpperCase().regex(/^KZ\d{2}[A-Z0-9]{16}$/, "Укажите ИИК из 20 символов, начиная с KZ")
    .refine(validKazakhstanIban, "Проверьте контрольные цифры ИИК"),
  bic: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{8}$/, "БИК должен содержать 8 латинских букв или цифр"),
  kbe: z.string().trim().regex(/^\d{2}$/, "Укажите двухзначный КБе"),
  currency: z.literal("KZT"),
}).strict();

export const organizationTaxPeriodSchema = z.object({
  id: z.uuid(),
  status: z.enum(["VAT_PAYER", "NOT_VAT_PAYER"]),
  effectiveFrom: z.iso.date(),
  // Inclusive end date. Null means no recorded end, not a promise of permanent validity.
  effectiveTo: z.iso.date().nullable(),
  reference: z.string().trim().max(200).nullable(),
}).strict().refine(value => value.effectiveTo === null || value.effectiveTo >= value.effectiveFrom, {
  path: ["effectiveTo"], message: "Окончание периода не может быть раньше начала",
});

export const organizationRequisitesFieldsSchema = z.object({
  legalForm: z.enum(["LEGAL_ENTITY", "INDIVIDUAL_ENTREPRENEUR"]).nullable(),
  bankAccounts: z.array(organizationBankAccountSchema).max(10),
  defaultBankAccountId: z.uuid().nullable(),
  taxPeriods: z.array(organizationTaxPeriodSchema).max(20),
}).strict().superRefine((value, context) => {
  const seenIds = new Set<string>(), seenIbans = new Set<string>();
  for (const [index, account] of value.bankAccounts.entries()) {
    if (seenIds.has(account.id)) context.addIssue({ code: "custom", path: ["bankAccounts", index, "id"], message: "Счёт уже добавлен" });
    if (seenIbans.has(account.iban)) context.addIssue({ code: "custom", path: ["bankAccounts", index, "iban"], message: "Такой ИИК уже добавлен" });
    seenIds.add(account.id); seenIbans.add(account.iban);
  }
  if (value.defaultBankAccountId && !seenIds.has(value.defaultBankAccountId)) {
    context.addIssue({ code: "custom", path: ["defaultBankAccountId"], message: "Выберите счёт из реквизитов этой организации" });
  }
  const periods = value.taxPeriods.map((period, index) => ({ ...period, index })).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  const taxIds = new Set<string>();
  for (const [position, period] of periods.entries()) {
    if (taxIds.has(period.id)) context.addIssue({ code: "custom", path: ["taxPeriods", period.index, "id"], message: "Период уже добавлен" });
    taxIds.add(period.id);
    const previous = periods[position - 1];
    if (previous && (previous.effectiveTo === null || previous.effectiveTo >= period.effectiveFrom)) {
      context.addIssue({ code: "custom", path: ["taxPeriods", period.index, "effectiveFrom"], message: "Периоды налогового статуса не должны пересекаться" });
    }
  }
});

export const organizationRequisitesSourceSchema = z.object({
  organizationVersion: z.number().int().positive(),
  legalName: z.string(), displayName: z.string(), identifier: z.string(),
  profile: organizationProfileFieldsSchema.nullable(),
  legalAddressText: z.string().nullable(), deliveryAddressText: z.string().nullable(),
  profileComplete: z.boolean(), requiresPaymentDetails: z.boolean(),
}).strict();

const actorSchema = z.object({ id: z.uuid(), displayName: z.string() }).strict();
export const organizationRequisitesRevisionSchema = z.object({
  id: z.uuid(), version: z.number().int().positive(),
  fields: organizationRequisitesFieldsSchema,
  source: organizationRequisitesSourceSchema,
  createdAt: z.iso.datetime(), createdBy: actorSchema,
  confirmedAt: z.iso.datetime().nullable(), confirmedBy: actorSchema.nullable(),
}).strict();

export const organizationRequisitesIssueSchema = z.object({
  code: z.enum(["PROFILE_REQUIRED", "LEGAL_FORM_REQUIRED", "BANK_ACCOUNT_REQUIRED", "TAX_STATUS_REQUIRED", "SOURCE_CHANGED", "UNCONFIRMED"]),
  path: z.string(), message: z.string(),
}).strict();
export const organizationRequisitesResponseSchema = z.object({
  organizationId: z.uuid(), canEdit: z.boolean(), version: z.number().int().nonnegative(),
  source: organizationRequisitesSourceSchema,
  current: organizationRequisitesRevisionSchema.nullable(),
  readiness: z.object({
    asOfDate: z.iso.date(), complete: z.boolean(), confirmed: z.boolean(), ready: z.boolean(),
    issues: z.array(organizationRequisitesIssueSchema),
  }).strict(),
}).strict();

const commandSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  expectedOrganizationVersion: z.number().int().positive(),
  idempotencyKey: z.string().trim().min(8).max(160),
}).strict();
export const saveOrganizationRequisitesSchema = commandSchema.extend({ fields: organizationRequisitesFieldsSchema });
export const confirmOrganizationRequisitesSchema = commandSchema.extend({
  expectedVersion: z.number().int().positive(), acknowledged: z.literal(true),
});
export const organizationRequisitesMutationSchema = z.object({ revisionId: z.uuid(), version: z.number().int().positive() }).strict();
export const organizationRequisitesHistoryQuerySchema = z.object({ beforeVersion: z.coerce.number().int().positive().optional() }).strict();
export const organizationRequisitesHistorySchema = z.object({
  items: z.array(organizationRequisitesRevisionSchema).max(20), nextBeforeVersion: z.number().int().positive().nullable(),
}).strict();

export type OrganizationBankAccount = z.infer<typeof organizationBankAccountSchema>;
export type OrganizationTaxPeriod = z.infer<typeof organizationTaxPeriodSchema>;
export type OrganizationRequisitesFields = z.infer<typeof organizationRequisitesFieldsSchema>;
export type OrganizationRequisitesSource = z.infer<typeof organizationRequisitesSourceSchema>;
export type OrganizationRequisitesRevision = z.infer<typeof organizationRequisitesRevisionSchema>;
export type OrganizationRequisitesIssue = z.infer<typeof organizationRequisitesIssueSchema>;
export type OrganizationRequisitesResponse = z.infer<typeof organizationRequisitesResponseSchema>;
export type SaveOrganizationRequisitesInput = z.infer<typeof saveOrganizationRequisitesSchema>;
export type ConfirmOrganizationRequisitesInput = z.infer<typeof confirmOrganizationRequisitesSchema>;
export type OrganizationRequisitesMutation = z.infer<typeof organizationRequisitesMutationSchema>;
export type OrganizationRequisitesHistory = z.infer<typeof organizationRequisitesHistorySchema>;
export type OrganizationRequisitesHistoryQuery = z.infer<typeof organizationRequisitesHistoryQuerySchema>;
