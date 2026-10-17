import { BadRequestException, Controller, Get, Header, Headers, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { operatorAuditQuerySchema } from "@marketplace/schemas";
import { PermissionsGuard } from "../access-control/permissions.guard";
import { RequirePermissions } from "../access-control/require-permissions.decorator";
import { ApiCoreErrors, ApiCoreProtected, ApiCoreQuery, ApiCoreResponse } from "../../platform/openapi/core-openapi";
import { OperatorAuditService } from "./operator-audit.service";

@ApiTags("marketplace-operations") @ApiCoreProtected() @ApiCoreErrors()
@UseGuards(PermissionsGuard) @Controller("operations/audit")
export class OperatorAuditController {
  constructor(private readonly audit: OperatorAuditService) {}
  @Get() @Header("Cache-Control", "no-store") @RequirePermissions("audit.view")
  @ApiCoreQuery("OperatorAuditQuery") @ApiCoreResponse("OperatorAuditPage")
  list(@Query() query: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const parsed = operatorAuditQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException("Invalid audit filters");
    return this.audit.list(parsed.data, { actorId, organizationId });
  }
}
