import { BadRequestException, Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { discrepancyUploadSchema, orderDiscrepancyCommandSchema } from "@marketplace/schemas";
import { ApiCoreBody, ApiCoreErrors, ApiCoreProtected, ApiCoreResponse, ApiUuidParam } from "../../platform/openapi/core-openapi";
import { OrderDiscrepancyService } from "./order-discrepancy.service";

@ApiTags("commerce")
@ApiCoreProtected()
@ApiCoreErrors()
@Controller("supplier-orders/:orderId/discrepancies")
export class OrderDiscrepancyController {
  constructor(private readonly service: OrderDiscrepancyService) {}
  @Get()
  @ApiUuidParam("orderId", "Supplier order identifier")
  @ApiCoreResponse("OrderDiscrepanciesResponse")
  list(@Param("orderId", ParseUUIDPipe) id: string, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    return this.service.list(id, { actorId, organizationId });
  }
  @Post()
  @ApiUuidParam("orderId", "Supplier order identifier")
  @ApiCoreBody("OrderDiscrepancyCommand")
  @ApiCoreResponse("OrderDiscrepancyResult", 201)
  execute(@Param("orderId", ParseUUIDPipe) id: string, @Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const parsed = orderDiscrepancyCommandSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.execute(id, parsed.data, { actorId, organizationId });
  }
  @Post("attachments")
  @ApiUuidParam("orderId", "Supplier order identifier")
  @ApiCoreBody("DiscrepancyUpload")
  @ApiCoreResponse("DiscrepancyAttachment", 201)
  upload(@Param("orderId", ParseUUIDPipe) id: string, @Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const parsed = discrepancyUploadSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.upload(id, parsed.data, { actorId, organizationId });
  }
  @Get(":discrepancyId/attachments/:assetId")
  @ApiUuidParam("orderId", "Supplier order identifier")
  @ApiUuidParam("discrepancyId", "Discrepancy identifier")
  @ApiUuidParam("assetId", "Attachment identifier")
  @ApiCoreResponse("DiscrepancyDownload")
  download(@Param("orderId", ParseUUIDPipe) id: string, @Param("discrepancyId", ParseUUIDPipe) discrepancyId: string,
    @Param("assetId", ParseUUIDPipe) assetId: string, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    return this.service.download(id, discrepancyId, assetId, { actorId, organizationId });
  }
}
