import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Res, StreamableFile, UseGuards } from "@nestjs/common";
import { ApiProduces, ApiResponse, ApiTags } from "@nestjs/swagger";
import { uploadSupportAttachmentSchema } from "@marketplace/schemas";
import type { Response } from "express";
import { z } from "zod";
import { PermissionsGuard } from "../access-control/permissions.guard";
import { RequirePermissions } from "../access-control/require-permissions.decorator";
import { ApiCoreBody, ApiCoreErrors, ApiCoreProtected, ApiCoreResponse, ApiUuidParam } from "../../platform/openapi/core-openapi";
import { SupportAttachmentsService } from "./support-attachments.service";

@ApiTags("support")
@ApiCoreProtected()
@ApiCoreErrors()
@UseGuards(PermissionsGuard)
@Controller("support")
export class SupportAttachmentsController {
  constructor(private readonly attachments: SupportAttachmentsService) {}

  @Post("attachments") @RequirePermissions("support.ticket.create")
  @ApiCoreBody("UploadSupportAttachment") @ApiCoreResponse("UploadedSupportAttachment", 201) @ApiCoreResponse("ErrorResponse", 413)
  upload(@Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const parsed = uploadSupportAttachmentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.attachments.upload(parsed.data, { actorId, organizationId });
  }

  @Get("tickets/:ticketId/messages/:messageId/attachments/:assetId") @RequirePermissions("support.ticket.view")
  @ApiUuidParam("ticketId", "Support ticket") @ApiUuidParam("messageId", "Support message") @ApiUuidParam("assetId", "Support attachment")
  @ApiProduces("application/octet-stream") @ApiResponse({ status: 200, schema: { type: "string", format: "binary" } })
  async download(@Param() params: { ticketId: string; messageId: string; assetId: string }, @Headers("x-user-id") actorId: string,
    @Headers("x-organization-id") organizationId: string, @Res({ passthrough: true }) response: Response) {
    if (!Object.values(params).every(id => z.uuid().safeParse(id).success)) throw new BadRequestException("Invalid attachment identifier");
    const result = await this.attachments.download(params.ticketId, params.messageId, params.assetId, { actorId, organizationId });
    response.setHeader("Content-Type", result.attachment.contentType);
    response.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(result.attachment.name)}`);
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    return new StreamableFile(result.body);
  }
}
