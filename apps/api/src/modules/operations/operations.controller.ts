import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiParam, ApiTags } from "@nestjs/swagger";
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
import { OperationQueueService } from "./operation-queue.service";
import { operationAssignmentSchema, operationQueueTypeSchema, operationWorkQueueQuerySchema } from "@marketplace/schemas";
import { z } from "zod";

@ApiTags("marketplace-operations")
@ApiCoreProtected()
@ApiCoreErrors()
@UseGuards(PermissionsGuard)
@Controller("operations")
export class OperationsController {
  constructor(private readonly operations: OperationsService, private readonly workflow: OperationWorkflowService, private readonly queue: OperationQueueService) {}

  @Get("work-queue/assignees") @RequirePermissions("organization.view")
  @ApiCoreResponse("OperationAssignees")
  assignees(@Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) { return this.workflow.assignees({ actorId, organizationId }); }

  @Get("work-queue/:type/:id") @RequirePermissions("organization.view")
  @ApiParam({ name: "type", enum: operationQueueTypeSchema.options })
  @ApiUuidParam("id", "Queue object") @ApiCoreResponse("OperationObject")
  object(@Param("type") type: string, @Param("id") id: string, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const kind = operationQueueTypeSchema.safeParse(type);
    if (!kind.success || !z.uuid().safeParse(id).success) throw new BadRequestException("Invalid queue object");
    return this.workflow.object(kind.data, id, { actorId, organizationId });
  }

  @Post("work-queue/:type/:id/assignment") @RequirePermissions("support.ticket.manage")
  @ApiParam({ name: "type", enum: operationQueueTypeSchema.options })
  @ApiUuidParam("id", "Queue object") @ApiCoreBody("OperationAssignment") @ApiCoreResponse("OperationAssignmentResult", 201)
  assign(@Param("type") type: string, @Param("id") id: string, @Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const parsed = operationAssignmentSchema.safeParse(body); const kind = operationQueueTypeSchema.safeParse(type);
    if (!parsed.success || !kind.success || !z.uuid().safeParse(id).success) throw new BadRequestException("Invalid queue assignment");
    return this.workflow.assign(kind.data, id, parsed.data, { actorId, organizationId });
  }

  @Get("work-queue/:type/:id/history") @RequirePermissions("organization.view")
  @ApiParam({ name: "type", enum: operationQueueTypeSchema.options })
  @ApiUuidParam("id", "Queue object") @ApiCoreResponse("OperationHistory")
  history(@Param("type") type: string, @Param("id") id: string, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const kind = operationQueueTypeSchema.safeParse(type);
    if (!kind.success || !z.uuid().safeParse(id).success) throw new BadRequestException("Invalid queue object");
    return this.workflow.history(kind.data, id, { actorId, organizationId });
  }

  @Get("work-queue")
  @Header("Cache-Control", "no-store")
  @ApiCoreQuery("OperationWorkQueueQuery")
  @ApiCoreResponse("OperationWorkQueue")
  @RequirePermissions("organization.view")
  workQueue(
    @Query() query: unknown,
    @Headers("x-user-id") actorId: string,
    @Headers("x-organization-id") organizationId: string,
  ) {
    const parsed = operationWorkQueueQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException("Invalid queue filters");
    return this.queue.list(parsed.data, { actorId, organizationId });
  }

  @Get("outbox/dead-letter")
  @Header("Cache-Control", "no-store")
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
  @ApiCoreResponse("OutboxReplayResponse", 201)
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
