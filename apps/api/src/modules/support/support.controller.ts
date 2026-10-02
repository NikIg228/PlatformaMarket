import { BadRequestException, Body, Controller, Get, Headers, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { addSupportMessageSchema, createSupportTicketSchema, startImpersonationSchema, updateSupportTicketSchema } from "@marketplace/schemas";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { PermissionsGuard } from "../access-control/permissions.guard";
import { RequirePermissions } from "../access-control/require-permissions.decorator";
import { SupportService } from "./support.service";
import { supportMessageQuerySchema, supportTicketQuerySchema } from "@marketplace/schemas";
import { ApiCoreBody, ApiCoreErrors, ApiCoreProtected, ApiCoreQuery, ApiCoreResponse, ApiUuidParam } from "../../platform/openapi/core-openapi";

@ApiTags("support")
@ApiCoreProtected()
@ApiCoreErrors()
@UseGuards(PermissionsGuard)
@Controller("support")
export class SupportController {
  constructor(private readonly support: SupportService) {}
  private ticketId(value: string) { const parsed = z.uuid().safeParse(value); if (!parsed.success) throw new BadRequestException("Invalid ticket identifier"); return parsed.data; }
  private context(actorId: string, organizationId: string) { return { actorId, organizationId }; }

  @Post("tickets") @RequirePermissions("support.ticket.create")
  @ApiCoreBody("CreateSupportTicket") @ApiCoreResponse("SupportTicketSummary", 201)
  create(@Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) { const parsed = createSupportTicketSchema.safeParse(body); if (!parsed.success) throw new BadRequestException(parsed.error.flatten()); return this.support.create(parsed.data, this.context(actorId, organizationId)); }

  @Get("tickets") @RequirePermissions("support.ticket.view")
  @ApiCoreQuery("SupportTicketQuery") @ApiCoreResponse("SupportTicketList")
  list(@Query() query: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) { const parsed = supportTicketQuerySchema.safeParse(query); if (!parsed.success) throw new BadRequestException(parsed.error.flatten()); return this.support.list(this.context(actorId, organizationId), parsed.data.status, parsed.data.offset); }

  @Get("tickets/:ticketId") @RequirePermissions("support.ticket.view")
  @ApiUuidParam("ticketId", "Support ticket") @ApiCoreQuery("SupportMessageQuery") @ApiCoreResponse("SupportTicketDetail")
  get(@Param("ticketId") ticketId: string, @Query() query: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) { const parsed = supportMessageQuerySchema.safeParse(query); if (!parsed.success || !z.uuid().safeParse(ticketId).success) throw new BadRequestException("Invalid message query"); return this.support.get(ticketId, this.context(actorId, organizationId), parsed.data.beforeMessageId); }

  @Get("tickets/:ticketId/history") @RequirePermissions("support.ticket.manage")
  @ApiUuidParam("ticketId", "Support ticket") @ApiCoreResponse("OperationHistory")
  history(@Param("ticketId") ticketId: string, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) { if (!z.uuid().safeParse(ticketId).success) throw new BadRequestException("Invalid ticket"); return this.support.history(ticketId, this.context(actorId, organizationId)); }

  @Post("tickets/:ticketId/messages") @RequirePermissions("support.ticket.create")
  @ApiUuidParam("ticketId", "Support ticket") @ApiCoreBody("AddSupportMessage") @ApiCoreResponse("SupportMessage", 201)
  message(@Param("ticketId") ticketId: string, @Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) { const parsed = addSupportMessageSchema.safeParse(body); if (!parsed.success) throw new BadRequestException(parsed.error.flatten()); return this.support.addMessage(this.ticketId(ticketId), parsed.data, this.context(actorId, organizationId)); }

  @Patch("tickets/:ticketId") @RequirePermissions("support.ticket.manage")
  @ApiUuidParam("ticketId", "Support ticket") @ApiCoreBody("UpdateSupportTicket") @ApiCoreResponse("SupportTicketSummary")
  update(@Param("ticketId") ticketId: string, @Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) { const parsed = updateSupportTicketSchema.safeParse(body); if (!parsed.success) throw new BadRequestException(parsed.error.flatten()); return this.support.update(this.ticketId(ticketId), parsed.data, this.context(actorId, organizationId)); }

  @Post("impersonation") @RequirePermissions("support.impersonate")
  impersonate(@Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) { const parsed = startImpersonationSchema.safeParse(body); if (!parsed.success) throw new BadRequestException(parsed.error.flatten()); return this.support.startImpersonation(parsed.data, this.context(actorId, organizationId)); }

  @Post("impersonation/:sessionId/end") @RequirePermissions("support.impersonate")
  end(@Param("sessionId") sessionId: string, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) { return this.support.endImpersonation(sessionId, this.context(actorId, organizationId)); }

  @Get("knowledge") @RequirePermissions("support.ticket.view")
  knowledge(@Query("audience") audience?: string, @Query("q") query?: string) { return this.support.knowledge(audience, query); }
}
