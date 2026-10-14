import { BadRequestException, Body, Controller, Get, Header, Headers, Param, Post, UseGuards } from "@nestjs/common";
import { applyOfferVatSchema, previewOfferVatSchema, saveSupplierVatSettingsSchema } from "@marketplace/schemas";
import { ApiCoreBody, ApiCoreErrors, ApiCoreProtected, ApiCoreResponse, ApiUuidParam } from "../../platform/openapi/core-openapi";
import { PermissionsGuard } from "../access-control/permissions.guard";
import { RequirePermissions } from "../access-control/require-permissions.decorator";
import { SupplierVatService } from "./supplier-vat.service";

@Controller("suppliers/:supplierOrganizationId/vat")
@UseGuards(PermissionsGuard)
@ApiCoreProtected() @ApiCoreErrors() @ApiUuidParam("supplierOrganizationId", "Supplier organization")
export class SupplierVatController {
  constructor(private readonly vat: SupplierVatService) {}
  @Get() @Header("Cache-Control", "no-store") @RequirePermissions("catalog.product.view")
  @ApiCoreResponse("SupplierVatSettings")
  current(@Param("supplierOrganizationId") supplierId: string, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    return this.vat.current(supplierId, { actorId, organizationId });
  }
  @Post() @Header("Cache-Control", "no-store") @RequirePermissions("pricing.manage")
  @ApiCoreBody("SaveSupplierVatSettingsRequest") @ApiCoreResponse("SupplierVatSettings", 201, "Changes only the default for new offers. Own supplier; acknowledged current requisites. Atomic version, audit/outbox and idempotency; conflicts return 409.")
  save(@Param("supplierOrganizationId") supplierId: string, @Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const parsed = saveSupplierVatSettingsSchema.safeParse(body); if (!parsed.success) throw new BadRequestException({ code: "INVALID_VAT_TERMS", message: "Проверьте настройки НДС", details: parsed.error.flatten() });
    return this.vat.save(supplierId, parsed.data, { actorId, organizationId });
  }
  @Post("offers/preview") @Header("Cache-Control", "no-store") @RequirePermissions("pricing.manage")
  @ApiCoreBody("PreviewOfferVatRequest") @ApiCoreResponse("OfferVatPreview", 201, "Read-only preview of explicitly selected own MANUAL/IMPORT offers. Hash binds actor, profile, date, versions and prices.")
  preview(@Param("supplierOrganizationId") supplierId: string, @Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const parsed = previewOfferVatSchema.safeParse(body); if (!parsed.success) throw new BadRequestException("Проверьте выбранные предложения и налоговые условия");
    return this.vat.preview(supplierId, parsed.data, { actorId, organizationId });
  }
  @Post("offers/apply") @Header("Cache-Control", "no-store") @RequirePermissions("pricing.manage")
  @ApiCoreBody("ApplyOfferVatRequest") @ApiCoreResponse("OfferVatApplyResult", 201, "Atomic all-or-nothing tax-only change after preview. Preserves gross amounts and price freshness. Stale preview returns 409; replay is idempotent; audit/outbox emitted.")
  apply(@Param("supplierOrganizationId") supplierId: string, @Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const parsed = applyOfferVatSchema.safeParse(body); if (!parsed.success) throw new BadRequestException("Проверьте предпросмотр изменения НДС");
    return this.vat.apply(supplierId, parsed.data, { actorId, organizationId });
  }
}
