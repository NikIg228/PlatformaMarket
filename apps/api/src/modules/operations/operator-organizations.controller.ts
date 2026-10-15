import { BadRequestException, Controller, Get, Header, Headers, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { operatorDashboardQuerySchema, operatorOrganizationsQuerySchema } from "@marketplace/schemas";
import { ApiCoreErrors, ApiCoreProtected, ApiCoreQuery, ApiCoreResponse, ApiUuidParam } from "../../platform/openapi/core-openapi";
import { PermissionsGuard } from "../access-control/permissions.guard";
import { RequirePermissions } from "../access-control/require-permissions.decorator";
import { OperatorOrganizationsService } from "./operator-organizations.service";

@ApiTags("marketplace-operations")
@ApiCoreProtected() @ApiCoreErrors() @UseGuards(PermissionsGuard)
@Controller("operations/organizations")
export class OperatorOrganizationsController {
  constructor(private readonly organizations: OperatorOrganizationsService) {}

  @Get() @Header("Cache-Control", "no-store") @RequirePermissions("organization.view")
  @ApiCoreQuery("OperatorOrganizationsQuery") @ApiCoreResponse("OperatorOrganizations")
  list(@Query() query: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const parsed = operatorOrganizationsQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException("Invalid organizations query");
    return this.organizations.list(parsed.data, { actorId, organizationId });
  }

  @Get(":id") @Header("Cache-Control", "no-store") @RequirePermissions("organization.view")
  @ApiUuidParam("id") @ApiCoreResponse("OperatorOrganizationDetail")
  detail(@Param("id", ParseUUIDPipe) id: string, @Query() query: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    if (!operatorDashboardQuerySchema.safeParse(query).success) throw new BadRequestException("Invalid organization query");
    return this.organizations.detail(id, { actorId, organizationId });
  }
}
