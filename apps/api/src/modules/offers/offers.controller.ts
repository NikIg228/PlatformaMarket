import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Put, UseGuards } from "@nestjs/common";
import { assignOfferPackagingSchema, createSupplierOfferSchema, setOfferPriceSchema, setOfferPublicationSchema, saveOfferCommercialSchema } from "@marketplace/schemas";
import { OfferCommercialService } from "./offer-commercial.service";
import { ApiTags } from "@nestjs/swagger";
import { PermissionsGuard } from "../access-control/permissions.guard";
import { RequirePermissions } from "../access-control/require-permissions.decorator";
import { OffersService } from "./offers.service";
import { ApiCoreBody, ApiCoreErrors, ApiCoreProtected, ApiCoreResponse, ApiUuidParam } from "../../platform/openapi/core-openapi";

@ApiTags("supplier-offers")
@UseGuards(PermissionsGuard)
@Controller("suppliers/:supplierOrganizationId/offers")
export class OffersController {
  constructor(private readonly offers: OffersService, private readonly commercial: OfferCommercialService) {}
  private context(actorId: string, organizationId: string) { return { actorId, organizationId }; }

  @Get()
  @RequirePermissions("catalog.product.view")
  list(@Param("supplierOrganizationId") supplierOrganizationId: string, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    return this.offers.list(supplierOrganizationId, this.context(actorId, organizationId));
  }

  @Post()
  @RequirePermissions("catalog.offer.edit")
  create(@Param("supplierOrganizationId") supplierOrganizationId: string, @Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const parsed = createSupplierOfferSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.offers.create(supplierOrganizationId, parsed.data, this.context(actorId, organizationId));
  }

  @Put(":offerId/price")
  @RequirePermissions("pricing.manage")
  setPrice(@Param("supplierOrganizationId") supplierOrganizationId: string, @Param("offerId") offerId: string, @Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const parsed = setOfferPriceSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.offers.setPrice(supplierOrganizationId, offerId, parsed.data, this.context(actorId, organizationId));
  }

  @Get(":offerId/commercial/:warehouseId")
  @RequirePermissions("catalog.product.view")
  @ApiCoreProtected()
  @ApiUuidParam("supplierOrganizationId", "Supplier organization")
  @ApiUuidParam("offerId", "Supplier offer")
  @ApiUuidParam("warehouseId", "Supplier warehouse")
  @ApiCoreResponse("OfferCommercialState")
  @ApiCoreErrors()
  getCommercial(@Param("supplierOrganizationId") supplierId: string, @Param("offerId") offerId: string, @Param("warehouseId") warehouseId: string,
    @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    return this.commercial.get(supplierId, offerId, warehouseId, this.context(actorId, organizationId));
  }

  @Put(":offerId/commercial")
  @RequirePermissions("pricing.manage", "inventory.adjust")
  @ApiCoreProtected()
  @ApiUuidParam("supplierOrganizationId", "Supplier organization")
  @ApiUuidParam("offerId", "Supplier offer")
  @ApiCoreBody("SaveOfferCommercialRequest")
  @ApiCoreResponse("OfferCommercialState")
  @ApiCoreErrors()
  saveCommercial(@Param("supplierOrganizationId") supplierId: string, @Param("offerId") offerId: string, @Body() body: unknown,
    @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const parsed = saveOfferCommercialSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.commercial.save(supplierId, offerId, parsed.data, this.context(actorId, organizationId));
  }

  @Put(":offerId/publication")
  @RequirePermissions("catalog.offer.publish")
  @ApiCoreProtected()
  @ApiUuidParam("supplierOrganizationId", "Supplier organization")
  @ApiUuidParam("offerId", "Supplier offer")
  @ApiCoreBody("SetOfferPublicationRequest")
  @ApiCoreResponse("SupplierOfferPublicationResponse")
  @ApiCoreErrors()
  setPublication(@Param("supplierOrganizationId") supplierOrganizationId: string, @Param("offerId") offerId: string, @Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const parsed = setOfferPublicationSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.offers.setPublication(supplierOrganizationId, offerId, parsed.data, this.context(actorId, organizationId));
  }

  @Put(":offerId/packaging")
  @RequirePermissions("catalog.offer.edit")
  assignPackaging(@Param("supplierOrganizationId") supplierOrganizationId: string, @Param("offerId") offerId: string, @Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const parsed = assignOfferPackagingSchema.safeParse(body); if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.offers.assignPackaging(supplierOrganizationId, offerId, parsed.data, this.context(actorId, organizationId));
  }
}
