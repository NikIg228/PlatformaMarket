import { BadRequestException, Body, Controller, Get, Header, Headers, Param, Post, UseGuards } from "@nestjs/common";
import { operatorExceptionReviewSchema } from "@marketplace/schemas";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { PermissionsGuard } from "../access-control/permissions.guard";
import { RequirePermissions } from "../access-control/require-permissions.decorator";
import { ApiCoreBody, ApiCoreErrors, ApiCoreProtected, ApiCoreResponse, ApiUuidParam } from "../../platform/openapi/core-openapi";
import { OperatorDocumentExceptionsService } from "./operator-document-exceptions.service";

@ApiTags("marketplace-operations") @ApiCoreProtected() @ApiCoreErrors()
@UseGuards(PermissionsGuard)
@Controller("operations/document-exceptions")
export class OperatorDocumentExceptionsController {
  constructor(private readonly exceptions: OperatorDocumentExceptionsService) {}
  @Get(":id") @RequirePermissions("order.confirm")
  @Header("Cache-Control", "no-store")
  @ApiUuidParam("id", "Published discrepancy") @ApiCoreResponse("OperatorDocumentException")
  get(@Param("id") id: string, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    if (!z.uuid().safeParse(id).success) throw new BadRequestException("Invalid document exception");
    return this.exceptions.get(id, { actorId, organizationId });
  }
  @Post(":id/recommendation") @RequirePermissions("order.confirm", "support.ticket.manage")
  @ApiUuidParam("id", "Published discrepancy") @ApiCoreBody("OperatorExceptionReview") @ApiCoreResponse("OperatorExceptionReviewResult", 201)
  publish(@Param("id") id: string, @Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const parsed = operatorExceptionReviewSchema.safeParse(body);
    if (!z.uuid().safeParse(id).success || !parsed.success) throw new BadRequestException("Invalid document exception recommendation");
    return this.exceptions.publish(id, parsed.data, { actorId, organizationId });
  }
}
