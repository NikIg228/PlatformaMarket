import type { Page } from "@playwright/test";
import type { SupplierVatSettings, VatPriceSnapshot } from "@marketplace/schemas";
const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const organizationId = id(1);
export const taxDeclaration: VatPriceSnapshot = {
  selection: { mode: "TAXABLE", rate: "16", basis: null }, ruleId: "KZ_STANDARD_2026_V1", source: "SUPPLIER_DEFAULT", defaultVersion: 1,
  declaredAt: "2026-10-14T09:00:00.000Z", declaredById: id(91), profile: { revisionId: id(92), version: 1, organizationVersion: 1, taxPeriodId: id(93), status: "VAT_PAYER", effectiveFrom: "2026-01-01", effectiveTo: null },
};
export const vatSettings: SupplierVatSettings = { supplierOrganizationId: organizationId, version: 1, defaultTax: taxDeclaration, profile: taxDeclaration.profile, profileIssue: null, canEdit: true, date: "2026-10-14" };
export async function taxFixture(page: Page) {
  const state = { settings: structuredClone(vatSettings), writes: [] as Array<Record<string, unknown>>, failRead: false, failSave: false, conflict: false };
  await page.route(`**/api/suppliers/${organizationId}/vat`, route => {
    if (route.request().method() === "GET") return route.fulfill(state.failRead ? { status: 503, json: { message: "Налоговые настройки временно недоступны" } } : { json: state.settings });
    const input = route.request().postDataJSON(); state.writes.push(input);
    if (state.conflict || state.failSave) return route.fulfill({ status: state.conflict ? 409 : 503, json: { message: state.conflict ? "Реквизиты изменились" : "Не удалось подтвердить сохранение" } });
    state.settings = { ...state.settings, version: state.settings.version + 1, defaultTax: input.selection ? { ...taxDeclaration, selection: input.selection } : null };
    return route.fulfill({ json: state.settings });
  });
  return state;
}
