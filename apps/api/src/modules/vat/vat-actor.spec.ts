import { describe, expect, it } from "vitest";
import { OffersService } from "../offers/offers.service";
import { OfferCommercialService } from "../offers/offer-commercial.service";
import { ImportsService } from "../imports/imports.service";
import { DataFreshnessService } from "../inventory/data-freshness.service";
import { IntegrationsService } from "../integrations/integrations.service";
const dependency = {} as never;
const tax = { selection: { mode: "TAXABLE", rate: "16", basis: null }, expectedRequisitesVersion: 1, acknowledged: true };
const context = { actorId: "actor", organizationId: "operator" };
describe("VAT declarations belong to the supplier", () => {
  it("denies all explicit declaration entry points before DB access, even for operator context", async () => {
    const offers = new OffersService(dependency, dependency, dependency, dependency, dependency);
    const commercial = new OfferCommercialService(dependency, dependency, dependency, dependency, dependency);
    const imports = new ImportsService(dependency, dependency, dependency, dependency, dependency, dependency, dependency);
    const overrides = new DataFreshnessService(dependency, dependency, dependency);
    const integrations = new IntegrationsService(dependency, dependency, dependency);
    for (const result of [offers.setPrice("supplier", "offer", { tax } as never, context),
      commercial.savePrice("supplier", "offer", { tax } as never, context),
      imports.createBatch("supplier", { columnMapping: { taxAcknowledged: true } } as never, context),
      overrides.createOverride("supplier", { tax } as never, context),
      integrations.createBinding("supplier", "connection", { priceTax: {} } as never, context)]) {
      await expect(result).rejects.toThrow("Налоговые условия подтверждает представитель поставщика");
    }
  });
});
