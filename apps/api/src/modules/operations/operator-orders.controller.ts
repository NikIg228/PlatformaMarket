import { BadRequestException, Controller, Get, Header, Headers, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { operatorDashboardQuerySchema, operatorOrdersQuerySchema } from "@marketplace/schemas";
import { ApiCoreErrors, ApiCoreProtected, ApiCoreQuery, ApiCoreResponse, ApiUuidParam } from "../../platform/openapi/core-openapi";
import { PermissionsGuard } from "../access-control/permissions.guard";
import { RequirePermissions } from "../access-control/require-permissions.decorator";
import { OperatorOrdersService } from "./operator-orders.service";

@ApiTags("marketplace-operations")
@ApiCoreProtected() @ApiCoreErrors() @UseGuards(PermissionsGuard)
@Controller("operations/orders")
export class OperatorOrdersController {
  constructor(private readonly orders: OperatorOrdersService) {}
  @Get() @Header("Cache-Control", "no-store") @RequirePermissions("order.confirm")
  @ApiCoreQuery("OperatorOrdersQuery") @ApiCoreResponse("OperatorOrders")
  list(@Query() query: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const parsed = operatorOrdersQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException("Invalid orders query");
    return this.orders.list(parsed.data, { actorId, organizationId });
  }
  @Get(":id") @Header("Cache-Control", "no-store") @RequirePermissions("order.confirm")
  @ApiUuidParam("id") @ApiCoreResponse("OperatorOrderDetail")
  detail(@Param("id", ParseUUIDPipe) id: string, @Query() query: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    if (!operatorDashboardQuerySchema.safeParse(query).success) throw new BadRequestException("Invalid order query");
    return this.orders.detail(id, { actorId, organizationId });
  }
}
