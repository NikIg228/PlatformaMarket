import { BadRequestException, Body, Controller, Get, Headers, NotFoundException, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { cdekCityQuerySchema, cdekSandboxQuoteInputSchema } from "@marketplace/schemas";
import { PermissionsGuard } from "../access-control/permissions.guard";
import { RequirePermissions } from "../access-control/require-permissions.decorator";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { ApiCoreBody, ApiCoreErrors, ApiCoreProtected, ApiCoreQuery, ApiCoreResponse, ApiUuidParam } from "../../platform/openapi/core-openapi";
import { CdekSandboxAdapter } from "./cdek-sandbox.adapter";

@ApiTags("logistics")
@ApiCoreProtected()
@ApiCoreErrors()
@UseGuards(PermissionsGuard)
@RequirePermissions("delivery.view")
@Controller("supplier-orders/:orderId/cdek-sandbox")
export class CdekSandboxController {
  constructor(private readonly prisma: PrismaService, private readonly cdek: CdekSandboxAdapter) {}
  private async requireOrder(orderId: string, organizationId: string) {
    if (!organizationId) throw new NotFoundException("Order not found");
    const order = await this.prisma.supplierOrder.findFirst({
      where: { id: orderId, OR: [{ buyerOrganizationId: organizationId }, { supplierOrganizationId: organizationId }] },
      select: { id: true },
    });
    if (!order) throw new NotFoundException("Order not found");
  }

  @Get()
  @ApiUuidParam("orderId", "Supplier order identifier")
  @ApiCoreResponse("CdekSandboxStatus")
  async status(@Param("orderId", ParseUUIDPipe) orderId: string, @Headers("x-organization-id") organizationId: string) {
    await this.requireOrder(orderId, organizationId);
    return { enabled: this.cdek.enabled(), mode: "sandbox" as const };
  }

  @Get("cities")
  @ApiUuidParam("orderId", "Supplier order identifier")
  @ApiCoreQuery("CdekCityQuery")
  @ApiCoreResponse("CdekCities")
  async cities(@Param("orderId", ParseUUIDPipe) orderId: string, @Headers("x-organization-id") organizationId: string, @Query() query: unknown) {
    await this.requireOrder(orderId, organizationId);
    const parsed = cdekCityQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException("Укажите название города, от 2 до 100 символов.");
    return this.cdek.cities(parsed.data.city);
  }

  @Post("quotes")
  @ApiUuidParam("orderId", "Supplier order identifier")
  @ApiCoreBody("CdekSandboxQuoteInput")
  @ApiCoreResponse("CdekSandboxQuote", 201)
  async quote(@Param("orderId", ParseUUIDPipe) orderId: string, @Headers("x-organization-id") organizationId: string, @Body() body: unknown) {
    await this.requireOrder(orderId, organizationId);
    const parsed = cdekSandboxQuoteInputSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Проверьте города, вес в граммах и размеры в сантиметрах.");
    return this.cdek.quote(parsed.data);
  }
}
