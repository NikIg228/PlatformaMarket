import { BadRequestException, Body, Controller, Get, Header, Headers, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { operatorTrustQuerySchema, operatorTrustEventsQuerySchema, operatorTrustResolveSchema } from "@marketplace/schemas";
import { PermissionsGuard } from "../access-control/permissions.guard";
import { RequirePermissions } from "../access-control/require-permissions.decorator";
import { ApiCoreBody, ApiCoreErrors, ApiCoreProtected, ApiCoreQuery, ApiCoreResponse, ApiUuidParam } from "../../platform/openapi/core-openapi";
import { OperatorTrustService } from "./operator-trust.service";

@ApiTags("trust-commerce") @ApiCoreProtected() @ApiCoreErrors()
@UseGuards(PermissionsGuard) @Controller("trust/operator")
export class OperatorTrustController {
  constructor(private readonly trust: OperatorTrustService) {}
  @Get() @Header("Cache-Control", "no-store")
  @ApiCoreQuery("OperatorTrustQuery") @ApiCoreResponse("OperatorTrust")
  overview(@Query() query: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const parsed = operatorTrustQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException("Invalid trust filters");
    return this.trust.overview(parsed.data, { actorId, organizationId });
  }
  @Get("suppliers/:id/events") @Header("Cache-Control", "no-store") @RequirePermissions("trust.rating.view")
  @ApiUuidParam("id", "Supplier organization") @ApiCoreQuery("OperatorTrustEventsQuery") @ApiCoreResponse("OperatorTrustEvents")
  events(@Param("id", new ParseUUIDPipe()) id: string, @Query() query: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const parsed = operatorTrustEventsQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException("Invalid event filters");
    return this.trust.events(id, parsed.data.offset, { actorId, organizationId });
  }
  @Post("incidents/:id/resolve") @RequirePermissions("trust.incident.manage")
  @ApiUuidParam("id", "Incident") @ApiCoreBody("OperatorTrustResolve") @ApiCoreResponse("OperatorTrustResolved", 201)
  resolve(@Param("id", new ParseUUIDPipe()) id: string, @Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const parsed = operatorTrustResolveSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid incident resolution");
    return this.trust.resolve(id, parsed.data, { actorId, organizationId });
  }
}
