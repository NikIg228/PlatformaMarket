import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  outboxDeadLetterQuerySchema,
  outboxEventIdSchema,
  outboxReplaySchema,
} from "@marketplace/schemas";
import { PermissionsGuard } from "../access-control/permissions.guard";
import { RequirePermissions } from "../access-control/require-permissions.decorator";
import {
  ApiCoreBody,
  ApiCoreErrors,
  ApiCoreProtected,
  ApiCoreQuery,
  ApiCoreResponse,
  ApiUuidParam,
} from "../../platform/openapi/core-openapi";
import { OperationsService } from "./operations.service";
import { OperationWorkflowService } from "./operation-workflow.service";
import { operationAssignmentSchema, operationQueueTypeSchema } from "@marketplace/schemas";
import { z } from "zod";

@ApiTags("marketplace-operations")
@ApiCoreProtected()
@ApiCoreErrors()
@UseGuards(PermissionsGuard)
@Controller("operations")
export class OperationsController {
  constructor(private readonly operations: OperationsService, private readonly workflow: OperationWorkflowService) {}

  @Get("work-queue/assignees") @RequirePermissions("organization.view")
  @ApiCoreResponse("OperationAssignees")
  assignees(@Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) { return this.workflow.assignees({ actorId, organizationId }); }

  @Get("work-queue/:type/:id") @RequirePermissions("organization.view")
  @ApiUuidParam("id", "Queue object") @ApiCoreResponse("OperationObject")
  object(@Param("type") type: string, @Param("id") id: string, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const kind = operationQueueTypeSchema.safeParse(type);
    if (!kind.success || !z.uuid().safeParse(id).success) throw new BadRequestException("Invalid queue object");
    return this.workflow.object(kind.data, id, { actorId, organizationId });
  }

  @Post("work-queue/:type/:id/assignment") @RequirePermissions("support.ticket.manage")
  @ApiUuidParam("id", "Queue object") @ApiCoreBody("OperationAssignment") @ApiCoreResponse("OperationAssignmentResult", 201)
  assign(@Param("type") type: string, @Param("id") id: string, @Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const parsed = operationAssignmentSchema.safeParse(body); const kind = operationQueueTypeSchema.safeParse(type);
    if (!parsed.success || !kind.success || !z.uuid().safeParse(id).success) throw new BadRequestException("Invalid queue assignment");
    return this.workflow.assign(kind.data, id, parsed.data, { actorId, organizationId });
  }

  @Get("work-queue/:type/:id/history") @RequirePermissions("organization.view")
  @ApiUuidParam("id", "Queue object") @ApiCoreResponse("OperationHistory")
  history(@Param("type") type: string, @Param("id") id: string, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const kind = operationQueueTypeSchema.safeParse(type);
    if (!kind.success || !z.uuid().safeParse(id).success) throw new BadRequestException("Invalid queue object");
    return this.workflow.history(kind.data, id, { actorId, organizationId });
  }

  @Get("work-queue")
  @ApiCoreResponse("OperationWorkQueue")
  @RequirePermissions("organization.view")
  workQueue(
    @Query("offset") offset: string | undefined,
    @Headers("x-user-id") actorId: string,
    @Headers("x-organization-id") organizationId: string,
  ) {
    const parsed = z.coerce.number().int().min(0).max(100_000).safeParse(offset ?? 0);
    if (!parsed.success) throw new BadRequestException("Invalid queue offset");
    return this.operations.workQueue({ actorId, organizationId }, parsed.data);
  }

  @Get("outbox/dead-letter")
  @ApiCoreQuery("OutboxDeadLetterQuery")
  @ApiCoreResponse("OutboxDeadLetterListResponse")
  @RequirePermissions("operations.outbox.view")
  deadLetters(
    @Query() query: unknown,
    @Headers("x-user-id") actorId: string,
    @Headers("x-organization-id") organizationId: string,
  ) {
    const parsed = outboxDeadLetterQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.operations.listDeadLetters(parsed.data, {
      actorId,
      organizationId,
    });
  }

  @Post("outbox/dead-letter/:eventId/replay")
  @ApiUuidParam("eventId", "Dead-letter outbox event identifier")
  @ApiCoreBody("OutboxReplayRequest")
  @ApiCoreResponse("OutboxReplayResponse", 200)
  @RequirePermissions("operations.outbox.replay")
  replayDeadLetter(
    @Param("eventId") eventId: string,
    @Body() body: unknown,
    @Headers("x-user-id") actorId: string,
    @Headers("x-organization-id") organizationId: string,
  ) {
    const eventIdResult = outboxEventIdSchema.safeParse(eventId);
    if (!eventIdResult.success)
      throw new BadRequestException(eventIdResult.error.flatten());
    const parsed = outboxReplaySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.operations.replayDeadLetter(eventId, parsed.data, {
      actorId,
      organizationId,
    });
  }
}
