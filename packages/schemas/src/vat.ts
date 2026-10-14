import { z } from "zod";

export const vatModeSchema = z.enum(["TAXABLE", "NOT_VAT_PAYER", "EXEMPT", "ZERO_RATED"]);
export const vatSelectionSchema = z.object({
  mode: vatModeSchema,
  rate: z.enum(["0", "5", "10", "16"]).nullable(),
  basis: z.string().trim().max(500).nullable(),
}).strict().superRefine((value, context) => {
  if (value.mode === "TAXABLE" && (!value.rate || value.rate === "0"))
    context.addIssue({ code: "custom", path: ["rate"], message: "Выберите положительную ставку НДС" });
  if (value.mode === "ZERO_RATED" && value.rate !== "0")
    context.addIssue({ code: "custom", path: ["rate"], message: "Для нулевой ставки укажите 0%" });
  if (["NOT_VAT_PAYER", "EXEMPT"].includes(value.mode) && value.rate !== null)
    context.addIssue({ code: "custom", path: ["rate"], message: "В этом режиме ставка не указывается" });
  if ((value.mode === "EXEMPT" || value.mode === "ZERO_RATED" || (value.mode === "TAXABLE" && value.rate !== "16")) && (value.basis?.length ?? 0) < 5)
    context.addIssue({ code: "custom", path: ["basis"], message: "Укажите основание применения режима или пониженной ставки" });
});
export type VatSelection = z.infer<typeof vatSelectionSchema>;

// The supplier declares applicability. This catalogue does not classify products.
export const VAT_RATE_RULES = [
  { id: "KZ_STANDARD_2026_V1", rate: "16", label: "16% — общая ставка", from: "2026-01-01", to: null },
  { id: "KZ_MEDICAL_2026_V1", rate: "5", label: "5% — пониженная ставка", from: "2026-01-01", to: "2026-12-31" },
  { id: "KZ_MEDICAL_2027_V1", rate: "10", label: "10% — пониженная ставка", from: "2027-01-01", to: null },
] as const;
export function vatCalendarDate(at = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Qyzylorda", year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}
export function vatRule(selection: VatSelection, date: string): string | null {
  if (selection.mode !== "TAXABLE") return `KZ_${selection.mode}_DECLARATION_V1`;
  return VAT_RATE_RULES.find(rule => rule.rate === selection.rate && rule.from <= date && (rule.to === null || date <= rule.to))?.id ?? null;
}

export const vatProfileSchema = z.object({
  revisionId: z.uuid(), version: z.number().int().positive(), organizationVersion: z.number().int().positive(),
  taxPeriodId: z.uuid(), status: z.enum(["VAT_PAYER", "NOT_VAT_PAYER"]),
  effectiveFrom: z.iso.date(), effectiveTo: z.iso.date().nullable(),
}).strict();
export type VatProfile = z.infer<typeof vatProfileSchema>;
export const vatPriceSnapshotSchema = z.object({
  selection: vatSelectionSchema, ruleId: z.string().min(1), profile: vatProfileSchema,
  declaredAt: z.iso.datetime(), declaredById: z.uuid(),
  source: z.enum(["EXPLICIT", "SUPPLIER_DEFAULT", "IMPORT_DEFAULT"]),
  defaultVersion: z.number().int().positive().nullable(),
}).strict();
export type VatPriceSnapshot = z.infer<typeof vatPriceSnapshotSchema>;
const minor = z.string().regex(/^(0|[1-9]\d{0,39})$/);
export const vatLineSnapshotSchema = z.object({
  declaration: vatPriceSnapshotSchema,
  calculationVersion: z.literal("GROSS_LINE_HALF_UP_V1"),
  grossMinor: minor, baseMinor: minor, vatMinor: minor,
}).strict();
export type VatLineSnapshot = z.infer<typeof vatLineSnapshotSchema>;

/** Confirmation metadata does not alter the buyer's commercial terms. */
export function sameAcceptedVat(previous?: VatLineSnapshot | null, current?: VatLineSnapshot | null): boolean {
  if (!previous || !current) return !previous && !current;
  const a = previous.declaration, b = current.declaration;
  return (["mode", "rate", "basis"] as const).every(key => a.selection[key] === b.selection[key]) &&
    (["revisionId", "version", "organizationVersion", "taxPeriodId", "status", "effectiveFrom", "effectiveTo"] as const).every(key => a.profile[key] === b.profile[key]) &&
    a.ruleId === b.ruleId && (["calculationVersion", "grossMinor", "baseMinor", "vatMinor"] as const).every(key => previous[key] === current[key]);
}

export const supplierVatSettingsSchema = z.object({
  supplierOrganizationId: z.uuid(), version: z.number().int().nonnegative(),
  defaultTax: vatPriceSnapshotSchema.nullable(), profile: vatProfileSchema.nullable(),
  profileIssue: z.string().nullable(), defaultIssue: z.string().nullable().optional(), canEdit: z.boolean(), date: z.iso.date(),
}).strict();
export const saveSupplierVatSettingsSchema = z.object({
  expectedVersion: z.number().int().nonnegative(), expectedRequisitesVersion: z.number().int().positive().nullable(),
  selection: vatSelectionSchema.nullable(), acknowledged: z.literal(true),
  idempotencyKey: z.string().trim().min(8).max(160),
}).strict();
export const offerVatInputSchema = z.object({
  selection: vatSelectionSchema, expectedRequisitesVersion: z.number().int().positive(), acknowledged: z.literal(true),
}).strict();
export type OfferVatInput = z.infer<typeof offerVatInputSchema>;
const bulkFields = {
  offerIds: z.array(z.uuid()).min(1).max(500).refine(ids => new Set(ids).size === ids.length, "Предложения не должны повторяться"),
  tax: offerVatInputSchema,
};
export const previewOfferVatSchema = z.object(bulkFields).strict();
export const applyOfferVatSchema = z.object({ ...bulkFields,
  previewHash: z.string().regex(/^[a-f0-9]{64}$/), idempotencyKey: z.string().trim().min(8).max(160),
}).strict();
export const offerVatPreviewSchema = z.object({
  previewHash: z.string(), selection: vatSelectionSchema,
  items: z.array(z.object({ offerId: z.uuid(), name: z.string(), offerVersion: z.number().int().positive(),
    amountMinor: minor, previous: vatSelectionSchema.nullable(), changed: z.boolean() }).strict()),
  changedCount: z.number().int().nonnegative(), unchangedCount: z.number().int().nonnegative(),
}).strict();
export const offerVatApplyResultSchema = z.object({ updatedOfferIds: z.array(z.uuid()), unchangedCount: z.number().int().nonnegative() }).strict();
export type SupplierVatSettings = z.infer<typeof supplierVatSettingsSchema>;
export type SaveSupplierVatSettingsInput = z.infer<typeof saveSupplierVatSettingsSchema>;
export type PreviewOfferVatInput = z.infer<typeof previewOfferVatSchema>;
export type ApplyOfferVatInput = z.infer<typeof applyOfferVatSchema>;
export type OfferVatPreview = z.infer<typeof offerVatPreviewSchema>;
export type OfferVatApplyResult = z.infer<typeof offerVatApplyResultSchema>;

function unsignedMinor(value: string): bigint {
  if (!/^(0|[1-9]\d{0,39})$/.test(value)) throw new Error("Invalid integer minor amount");
  return BigInt(value);
}
/** Positive rational, rounded once to the nearest minor unit; ties round up. */
function halfUp(numerator: bigint, denominator: bigint): bigint {
  return (numerator * 2n + denominator) / (denominator * 2n);
}
export function calculateVatLine(grossMinor: string, declaration: VatPriceSnapshot): VatLineSnapshot {
  const gross = unsignedMinor(grossMinor), selection = vatSelectionSchema.parse(declaration.selection);
  const rate = BigInt(selection.rate ?? "0");
  const vat = selection.mode === "TAXABLE" ? halfUp(gross * rate, 100n + rate) : 0n;
  return { declaration, calculationVersion: "GROSS_LINE_HALF_UP_V1", grossMinor: gross.toString(), baseMinor: (gross - vat).toString(), vatMinor: vat.toString() };
}
export function grossFromNetMinor(netMinor: string, selection: VatSelection): string {
  const net = unsignedMinor(netMinor);
  const parsed = vatSelectionSchema.parse(selection);
  return parsed.mode === "TAXABLE" ? halfUp(net * (100n + BigInt(parsed.rate!)), 100n).toString() : net.toString();
}
export function vatLegacyFields(selection: VatSelection) {
  return { includesVat: selection.mode === "TAXABLE" || selection.mode === "ZERO_RATED", vatRate: selection.rate === null ? null : Number(selection.rate) };
}
export function sumVatLines(lines: readonly VatLineSnapshot[]) {
  return lines.reduce((total, line) => ({ grossMinor: (BigInt(total.grossMinor) + unsignedMinor(line.grossMinor)).toString(),
    baseMinor: (BigInt(total.baseMinor) + unsignedMinor(line.baseMinor)).toString(), vatMinor: (BigInt(total.vatMinor) + unsignedMinor(line.vatMinor)).toString() }),
  { grossMinor: "0", baseMinor: "0", vatMinor: "0" });
}
/** Recompute only the amount for an accepted/fulfilled quantity using the immutable order declaration. */
export function orderLineVat(offerSnapshot: unknown, grossMinor: string): VatLineSnapshot | null {
  const record = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  const tax = record(record(offerSnapshot)?.pricing)?.tax;
  if (tax === undefined || tax === null) return null;
  return calculateVatLine(grossMinor, vatLineSnapshotSchema.parse(tax).declaration);
}
export function vatLabel(selection: VatSelection | null | undefined): string {
  if (!selection) return "НДС не уточнён";
  if (selection.mode === "TAXABLE") return `Включая НДС ${selection.rate}%`;
  if (selection.mode === "ZERO_RATED") return "НДС 0%";
  if (selection.mode === "EXEMPT") return "Освобождено от НДС";
  return "Без НДС — неплательщик";
}
