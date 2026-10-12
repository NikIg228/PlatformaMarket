import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Query, Res, StreamableFile, UseGuards } from "@nestjs/common";
import { ApiProduces, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { z } from "zod";
import { conversationContextSchema, conversationEscalationSchema, conversationMessageInputSchema, conversationMessageQuerySchema, conversationQuerySchema, conversationReadSchema, conversationResolveSchema, startConversationSchema, uploadConversationAttachmentSchema } from "@marketplace/schemas";
import { ApiCoreBody, ApiCoreErrors, ApiCoreProtected, ApiCoreQuery, ApiCoreResponse, ApiUuidParam } from "../../platform/openapi/core-openapi";
import { PermissionsGuard } from "../access-control/permissions.guard";
import { RequirePermissions } from "../access-control/require-permissions.decorator";
import { ConversationsService } from "./conversations.service";

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new BadRequestException(result.error.flatten());
  return result.data;
}

@ApiTags("conversations")
@ApiCoreProtected()
@ApiCoreErrors()
@UseGuards(PermissionsGuard)
@Controller("conversations")
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get("context") @RequirePermissions("support.ticket.view")
  @ApiCoreQuery("ConversationContext") @ApiCoreResponse("ConversationLookup")
  lookup(@Query() query: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) { return this.conversations.lookup(parse(conversationContextSchema, query), { actorId, organizationId }); }

  @Get() @RequirePermissions("support.ticket.view")
  @ApiCoreQuery("ConversationQuery") @ApiCoreResponse("ConversationPage")
  list(@Query() query: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) { return this.conversations.list(parse(conversationQuerySchema, query), { actorId, organizationId }); }

  @Post() @RequirePermissions("support.ticket.create")
  @ApiCoreBody("StartConversation") @ApiCoreResponse("ConversationResult", 201)
  start(@Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) { return this.conversations.start(parse(startConversationSchema, body), { actorId, organizationId }); }

  @Post("attachments") @RequirePermissions("support.ticket.create")
  @ApiCoreBody("UploadConversationAttachment") @ApiCoreResponse("UploadedConversationAttachment", 201) @ApiCoreResponse("ErrorResponse", 413)
  upload(@Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    return this.conversations.uploadAttachment(parse(uploadConversationAttachmentSchema, body), { actorId, organizationId });
  }

  @Get(":id/messages/:messageId/attachments/:assetId") @RequirePermissions("support.ticket.view")
  @ApiUuidParam("id", "Conversation") @ApiUuidParam("messageId", "Conversation message") @ApiUuidParam("assetId", "Conversation attachment")
  @ApiProduces("application/octet-stream") @ApiResponse({ status: 200, schema: { type: "string", format: "binary" } })
  async download(@Param() params: { id: string; messageId: string; assetId: string }, @Headers("x-user-id") actorId: string,
    @Headers("x-organization-id") organizationId: string, @Res({ passthrough: true }) response: Response) {
    if (!Object.values(params).every(id => z.uuid().safeParse(id).success)) throw new BadRequestException("Invalid attachment identifier");
    const result = await this.conversations.downloadAttachment(params.id, params.messageId, params.assetId, { actorId, organizationId });
    response.setHeader("Content-Type", result.attachment.contentType);
    response.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(result.attachment.name)}`);
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    return new StreamableFile(result.body);
  }

  @Get(":id") @RequirePermissions("support.ticket.view")
  @ApiUuidParam("id", "Conversation") @ApiCoreQuery("ConversationMessageQuery") @ApiCoreResponse("ConversationDetail")
  get(@Param("id") id: string, @Query() query: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) { return this.conversations.get(parse(z.uuid(), id), { actorId, organizationId }, parse(conversationMessageQuerySchema, query).beforeSequence); }

  @Post(":id/messages") @RequirePermissions("support.ticket.create")
  @ApiUuidParam("id", "Conversation") @ApiCoreBody("ConversationMessageInput") @ApiCoreResponse("ConversationResult", 201)
  send(@Param("id") id: string, @Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) { return this.conversations.send(parse(z.uuid(), id), parse(conversationMessageInputSchema, body), { actorId, organizationId }); }

  @Post(":id/read") @RequirePermissions("support.ticket.view")
  @ApiUuidParam("id", "Conversation") @ApiCoreBody("ConversationRead") @ApiCoreResponse("ConversationReadResult", 201)
  read(@Param("id") id: string, @Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) { return this.conversations.read(parse(z.uuid(), id), parse(conversationReadSchema, body).throughSequence, { actorId, organizationId }); }

  @Post(":id/resolve") @RequirePermissions("support.ticket.create")
  @ApiUuidParam("id", "Conversation") @ApiCoreBody("ConversationResolve") @ApiCoreResponse("ConversationResult", 201)
  resolve(@Param("id") id: string, @Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) { return this.conversations.resolve(parse(z.uuid(), id), parse(conversationResolveSchema, body).expectedVersion, { actorId, organizationId }); }

  @Post(":id/escalate") @RequirePermissions("support.ticket.create")
  @ApiUuidParam("id", "Conversation") @ApiCoreBody("ConversationEscalation") @ApiCoreResponse("ConversationEscalationResult", 201)
  escalate(@Param("id") id: string, @Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) { return this.conversations.escalate(parse(z.uuid(), id), parse(conversationEscalationSchema, body), { actorId, organizationId }); }
}
