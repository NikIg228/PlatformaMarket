import { BadRequestException, ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { organizationRequisitesFieldsSchema, organizationRequisitesSourceSchema, vatCalendarDate, vatPriceSnapshotSchema, vatRule, vatSelectionSchema,
  type OfferVatInput, type VatPriceSnapshot, type VatProfile, type VatSelection } from "@marketplace/schemas";

export const vatConflict = (message: string) => new ConflictException({ code: "VAT_TERMS_CHANGED", message });
export function storedVat(value: unknown): VatPriceSnapshot | null {
  if (value === null || value === undefined) return null;
  const parsed = vatPriceSnapshotSchema.safeParse(value);
  if (!parsed.success) throw vatConflict("Налоговые условия повреждены. Подтвердите их заново в предложении");
  return parsed.data;
}
export async function currentVatProfile(db: Prisma.TransactionClient, supplierId: string, date = vatCalendarDate()): Promise<VatProfile> {
  const [head, organization] = await Promise.all([
    db.organizationRequisites.findUnique({ where: { organizationId: supplierId } }),
    db.organization.findUnique({ where: { id: supplierId }, select: { version: true } }),
  ]);
  if (!head?.version || !organization) throw vatConflict("Заполните и подтвердите налоговый статус в реквизитах организации");
  const revision = await db.organizationRequisitesRevision.findUnique({ where: { organizationId_version: { organizationId: supplierId, version: head.version } } });
  const fields = organizationRequisitesFieldsSchema.safeParse(revision?.fields);
  const source = organizationRequisitesSourceSchema.safeParse(revision?.source);
  if (!revision?.confirmedAt || !fields.success || !source.success || source.data.organizationVersion !== organization.version)
    throw vatConflict("Подтвердите актуальную версию реквизитов организации перед изменением НДС");
  const period = fields.data.taxPeriods.find(item => item.effectiveFrom <= date && (item.effectiveTo === null || date <= item.effectiveTo));
  if (!period) throw vatConflict("В реквизитах нет налогового статуса на выбранную дату");
  return { revisionId: revision.id, version: revision.version, organizationVersion: organization.version,
    taxPeriodId: period.id, status: period.status, effectiveFrom: period.effectiveFrom, effectiveTo: period.effectiveTo };
}
export function validateVatSelection(selection: VatSelection, profile: VatProfile, date = vatCalendarDate()): string {
  const parsed = vatSelectionSchema.safeParse(selection);
  if (!parsed.success) throw new BadRequestException({ code: "INVALID_VAT_TERMS", message: "Проверьте режим, ставку и основание НДС", details: parsed.error.flatten() });
  if ((selection.mode === "NOT_VAT_PAYER") !== (profile.status === "NOT_VAT_PAYER"))
    throw new BadRequestException({ code: "VAT_PROFILE_MISMATCH", message: "Налоговый режим предложения не соответствует статусу поставщика в реквизитах" });
  const rule = vatRule(parsed.data, date);
  if (!rule) throw new BadRequestException({ code: "VAT_RATE_NOT_EFFECTIVE", message: "Выбранная ставка не действует на текущую дату. Выберите актуальную ставку" });
  return rule;
}
export function declareVat(selection: VatSelection, profile: VatProfile, actorId: string,
  source: VatPriceSnapshot["source"] = "EXPLICIT", defaultVersion: number | null = null, now = new Date()): VatPriceSnapshot {
  const parsed = vatSelectionSchema.parse(selection);
  return { selection: parsed, ruleId: validateVatSelection(parsed, profile, vatCalendarDate(now)), profile,
    declaredAt: now.toISOString(), declaredById: actorId, source, defaultVersion };
}
export async function assertVatCurrent(db: Prisma.TransactionClient, supplierId: string, snapshot: VatPriceSnapshot, date = vatCalendarDate()) {
  const profile = await currentVatProfile(db, supplierId, date);
  if (JSON.stringify(profile) !== JSON.stringify(snapshot.profile)) throw vatConflict("Налоговый профиль поставщика изменился. Поставщику нужно подтвердить НДС предложения заново");
  if (validateVatSelection(snapshot.selection, profile, date) !== snapshot.ruleId) throw vatConflict("Правило НДС изменилось. Поставщику нужно подтвердить условия предложения заново");
}

/** Missing input preserves an existing declaration. Defaults apply only to a new price. */
export async function resolvePriceVat(db: Prisma.TransactionClient, supplierId: string, actorId: string,
  previous: { taxSnapshot?: unknown } | null, explicit?: OfferVatInput, importDefault?: OfferVatInput,
  frozenDefault?: VatPriceSnapshot | null): Promise<VatPriceSnapshot | null> {
  if (explicit || (!previous && importDefault)) {
    const input = explicit ?? importDefault!;
    const profile = await currentVatProfile(db, supplierId);
    if (profile.version !== input.expectedRequisitesVersion) throw vatConflict("Реквизиты изменились после открытия формы. Обновите налоговые условия");
    return declareVat(input.selection, profile, actorId, explicit ? "EXPLICIT" : "IMPORT_DEFAULT");
  }
  if (previous) {
    const current = storedVat(previous.taxSnapshot);
    if (current) await assertVatCurrent(db, supplierId, current);
    return current;
  }
  if (frozenDefault !== undefined) {
    if (frozenDefault) await assertVatCurrent(db, supplierId, frozenDefault);
    return frozenDefault;
  }
  const settings = await db.supplierVatSettings.findUnique({ where: { supplierOrganizationId: supplierId } });
  const defaults = storedVat(settings?.defaultTax);
  if (!defaults) return null; // Transitional legacy API: never invent a tax mode.
  await assertVatCurrent(db, supplierId, defaults);
  return { ...defaults, source: "SUPPLIER_DEFAULT", defaultVersion: settings!.version };
}
