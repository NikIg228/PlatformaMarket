import { Controller, Get, Header, Headers, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PermissionsGuard } from "../access-control/permissions.guard";
import { RequirePermissions } from "../access-control/require-permissions.decorator";
import { ApiCoreErrors, ApiCoreProtected, ApiCoreResponse } from "../../platform/openapi/core-openapi";
import { OperatorTechnicalService } from "./operator-technical.service";
@ApiTags("marketplace-operations") @ApiCoreProtected() @ApiCoreErrors()
@UseGuards(PermissionsGuard) @Controller("operations/technical")
export class OperatorTechnicalController {
  constructor(private readonly technical: OperatorTechnicalService) {}
  @Get() @Header("Cache-Control", "no-store") @RequirePermissions("operations.outbox.view") @ApiCoreResponse("OperatorTechnical")
  get(@Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) { return this.technical.get({ actorId, organizationId }); }
}
