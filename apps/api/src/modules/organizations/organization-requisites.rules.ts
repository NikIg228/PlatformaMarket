import type { OrganizationRequisitesFields, OrganizationRequisitesIssue, OrganizationRequisitesResponse, OrganizationRequisitesRevision, OrganizationRequisitesSource } from "@marketplace/schemas";

export const emptyRequisites = (): OrganizationRequisitesFields => ({ legalForm: null, bankAccounts: [], defaultBankAccountId: null, taxPeriods: [] });

export function requisitesDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Qyzylorda", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  return ["year", "month", "day"].map(type => parts.find(part => part.type === type)!.value).join("-");
}

export function sameRequisitesSource(a: OrganizationRequisitesSource, b: OrganizationRequisitesSource) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function requisitesReadiness(source: OrganizationRequisitesSource, current: OrganizationRequisitesRevision | null, now = new Date()): OrganizationRequisitesResponse["readiness"] {
  const fields = current?.fields ?? emptyRequisites(), asOfDate = requisitesDate(now);
  const issues: OrganizationRequisitesIssue[] = [];
  if (!source.profileComplete || !source.legalAddressText || !/^\d{12}$/.test(source.identifier) || !source.legalName.trim()) {
    issues.push({ code: "PROFILE_REQUIRED", path: "source.profile", message: "Заполните контакты и адреса в настройках организации" });
  }
  if (!fields.legalForm) issues.push({ code: "LEGAL_FORM_REQUIRED", path: "legalForm", message: "Укажите юридическую форму организации" });
  if (source.requiresPaymentDetails && !fields.bankAccounts.some(account => account.id === fields.defaultBankAccountId)) {
    issues.push({ code: "BANK_ACCOUNT_REQUIRED", path: "defaultBankAccountId", message: "Добавьте и выберите счёт поставщика для оплаты" });
  }
  if (source.requiresPaymentDetails && !fields.taxPeriods.some(period => period.effectiveFrom <= asOfDate && (period.effectiveTo === null || period.effectiveTo >= asOfDate))) {
    issues.push({ code: "TAX_STATUS_REQUIRED", path: "taxPeriods", message: "Укажите налоговый статус, действующий на текущую дату" });
  }
  if (current && !sameRequisitesSource(source, current.source)) {
    issues.push({ code: "SOURCE_CHANGED", path: "source", message: "Данные организации изменились. Сохраните новую версию реквизитов и проверьте её" });
  }
  const complete = issues.length === 0, confirmed = Boolean(current?.confirmedAt);
  if (!confirmed) issues.push({ code: "UNCONFIRMED", path: "confirmation", message: "Проверьте и подтвердите сохранённую версию реквизитов" });
  return { asOfDate, complete, confirmed, ready: complete && confirmed, issues };
}
