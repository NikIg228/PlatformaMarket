import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { expect, type Page } from "@playwright/test";
import { organizationRequisitesResponseSchema } from "@marketplace/schemas";

/** Scoped legacy-browser fixture; restore the supplier's prior requisites head. */
export async function installSupplierTaxFixture(db: PrismaClient, page: Page, identity: { organizationId: string; userId: string }) {
  const url = new URL(process.env.DATABASE_URL!);
  expect(["localhost", "127.0.0.1"]).toContain(url.hostname);
  expect(url.pathname).toBe(process.env.GITHUB_ACTIONS === "true" ? "/marketplace" : "/dentmarket_audit_20260914");
  const accessToken = await page.evaluate(() => JSON.parse(sessionStorage.getItem("dentmarket:supplier-session")!).accessToken as string);
  const response = await page.request.get("http://127.0.0.1:4012/api/organizations/current/requisites", { headers: { authorization: `Bearer ${accessToken}` } });
  expect(response.ok()).toBe(true);
  const current = organizationRequisitesResponseSchema.parse(await response.json());
  const previous = await db.organizationRequisites.findUnique({ where: { organizationId: identity.organizationId } });
  const bankId = randomUUID(), version = (previous?.version ?? 0) + 1;
  const revision = await db.$transaction(async tx => {
    const revision = await tx.organizationRequisitesRevision.create({ data: {
      organizationId: identity.organizationId, version, source: current.source,
      fields: { legalForm: "LEGAL_ENTITY", bankAccounts: [{ id: bankId, bankName: "Synthetic Bank", iban: "KZ86125KZT5004100100", bic: "FAKEKZXX", kbe: "17", currency: "KZT" }], defaultBankAccountId: bankId,
        taxPeriods: [{ id: randomUUID(), status: "VAT_PAYER", effectiveFrom: "2026-01-01", effectiveTo: null, reference: null }] },
      createdById: identity.userId, createdByName: "Browser fixture", confirmedById: identity.userId, confirmedByName: "Browser fixture", confirmedAt: new Date(),
    } });
    await tx.organizationRequisites.upsert({ where: { organizationId: identity.organizationId }, create: { organizationId: identity.organizationId, version }, update: { version } });
    return revision;
  });
  return async () => db.$transaction(async tx => {
    const head = await tx.organizationRequisites.findUniqueOrThrow({ where: { organizationId: identity.organizationId } });
    expect(head.version).toBe(version);
    if (previous) await tx.organizationRequisites.update({ where: { organizationId: identity.organizationId }, data: { version: previous.version } });
    else await tx.organizationRequisites.delete({ where: { organizationId: identity.organizationId } });
    await tx.organizationRequisitesRevision.delete({ where: { id: revision.id } });
  });
}

export async function confirmStandardVat(page: Page) {
  await page.getByRole("combobox", { name: "Налоговый режим", exact: true }).click();
  await page.getByRole("option", { name: "Облагается НДС", exact: true }).click();
  await page.getByRole("combobox", { name: "Ставка НДС", exact: true }).click();
  await page.getByRole("option", { name: "16% — общая ставка", exact: true }).click();
  await page.getByRole("checkbox", { name: "Подтверждаю применимость режима и ставки к этому товару" }).check();
}
