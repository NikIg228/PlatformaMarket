import { BadRequestException, Body, Controller, Get, Header, Headers, Param, ParseUUIDPipe, Post, StreamableFile, UseGuards } from "@nestjs/common";
import { ApiProduces, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { saveSupplierStorefrontSchema, uploadSupplierLogoSchema } from "@marketplace/schemas";
import { ApiCoreBody, ApiCoreErrors, ApiCoreProtected, ApiCoreResponse, ApiUuidParam } from "../../platform/openapi/core-openapi";
import { PermissionsGuard } from "../access-control/permissions.guard";
import { RequirePermissions } from "../access-control/require-permissions.decorator";
import { SupplierStorefrontService } from "./supplier-storefront.service";

@ApiTags("supplier-storefront") @ApiCoreProtected() @ApiCoreErrors()
@ApiUuidParam("supplierId", "Supplier organization") @UseGuards(PermissionsGuard)
@Controller("suppliers/:supplierId/storefront")
export class SupplierStorefrontController {
  constructor(private readonly storefront: SupplierStorefrontService) {}
  @Get() @Header("Cache-Control", "no-store") @RequirePermissions("organization.view") @ApiCoreResponse("SupplierStorefrontSettings")
  current(@Param("supplierId", ParseUUIDPipe) id: string, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    return this.storefront.current(id, { actorId, organizationId });
  }
  @Post() @RequirePermissions("supplier.profile.manage") @ApiCoreBody("SaveSupplierStorefront") @ApiCoreResponse("SupplierStorefrontSettings", 201)
  save(@Param("supplierId", ParseUUIDPipe) id: string, @Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const parsed = saveSupplierStorefrontSchema.safeParse(body); if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.storefront.save(id, parsed.data, { actorId, organizationId });
  }
  @Post("logo") @RequirePermissions("supplier.profile.manage") @ApiCoreBody("UploadSupplierLogo") @ApiCoreResponse("SupplierStorefrontSettings", 201)
  @Throttle({ ip: { limit: 20, ttl: 60_000 }, user: { limit: 10, ttl: 60_000 }, tenant: { limit: 30, ttl: 60_000 } })
  upload(@Param("supplierId", ParseUUIDPipe) id: string, @Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const parsed = uploadSupplierLogoSchema.safeParse(body); if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.storefront.uploadLogo(id, parsed.data, { actorId, organizationId });
  }
  @Get("logo") @Header("Cache-Control", "no-store") @RequirePermissions("organization.view") @ApiCoreResponse("ProfileAvatar")
  logo(@Param("supplierId", ParseUUIDPipe) id: string, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    return this.storefront.logo(id, { actorId, organizationId });
  }
}

@ApiTags("public-catalog") @ApiCoreErrors() @ApiUuidParam("supplierId", "Supplier organization")
@Controller("catalog/suppliers/:supplierId")
export class PublicSupplierStorefrontController {
  constructor(private readonly storefront: SupplierStorefrontService) {}
  @Get() @Header("Cache-Control", "no-store") @ApiCoreResponse("SupplierStorefront")
  current(@Param("supplierId", ParseUUIDPipe) id: string) { return this.storefront.publicPage(id); }
  @Get("logo") @Header("Cache-Control", "no-store")
  @ApiProduces("image/png", "image/jpeg") @ApiResponse({ status: 200, schema: { type: "string", format: "binary" } })
  async logo(@Param("supplierId", ParseUUIDPipe) id: string) {
    const logo = await this.storefront.logo(id);
    return new StreamableFile(Buffer.from(logo.contentBase64, "base64"), { type: logo.contentType });
  }
}
