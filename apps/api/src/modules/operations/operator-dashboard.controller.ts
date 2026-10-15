import { BadRequestException, Controller, Get, Headers, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { operatorDashboardQuerySchema } from "@marketplace/schemas";
import { ApiCoreErrors, ApiCoreProtected, ApiCoreQuery, ApiCoreResponse } from "../../platform/openapi/core-openapi";
import { PermissionsGuard } from "../access-control/permissions.guard";
import { RequirePermissions } from "../access-control/require-permissions.decorator";
import { OperatorDashboardService } from "./operator-dashboard.service";

@ApiTags("marketplace-operations")
@ApiCoreProtected()
@ApiCoreErrors()
@UseGuards(PermissionsGuard)
@Controller("operations")
export class OperatorDashboardController {
  constructor(private readonly dashboardService: OperatorDashboardService) {}

  @Get("dashboard")
  @RequirePermissions("organization.view")
  @ApiCoreQuery("OperatorDashboardQuery")
  @ApiCoreResponse("OperatorDashboard")
  dashboard(@Query() query: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    if (!operatorDashboardQuerySchema.safeParse(query).success) throw new BadRequestException("Invalid dashboard query");
    return this.dashboardService.dashboard({ actorId, organizationId });
  }

  @Get("capabilities")
  @RequirePermissions("organization.view")
  @ApiCoreQuery("OperatorDashboardQuery")
  @ApiCoreResponse("OperatorCapabilities")
  capabilities(@Query() query: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    if (!operatorDashboardQuerySchema.safeParse(query).success) throw new BadRequestException("Invalid capabilities query");
    return this.dashboardService.capabilities({ actorId, organizationId });
  }
}
