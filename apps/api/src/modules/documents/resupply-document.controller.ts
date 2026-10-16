import { BadRequestException, Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { prepareResupplyDocumentSchema } from "@marketplace/schemas";
import { ApiCoreBody, ApiCoreErrors, ApiCoreProtected, ApiCoreResponse, ApiUuidParam } from "../../platform/openapi/core-openapi";
import { ResupplyDocumentService } from "./resupply-document.service";

@ApiTags("documents")
@ApiCoreProtected()
@ApiCoreErrors()
@ApiUuidParam("orderId", "Supplier order identifier")
@ApiUuidParam("discrepancyId", "Discrepancy identifier")
@Controller("supplier-orders/:orderId/discrepancies/:discrepancyId/documents")
export class ResupplyDocumentController {
  constructor(private readonly service: ResupplyDocumentService) {}
  @Get()
  @ApiCoreResponse("ResupplyDocumentsResponse")
  list(@Param("orderId", ParseUUIDPipe) orderId: string, @Param("discrepancyId", ParseUUIDPipe) claimId: string,
    @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    return this.service.list(orderId, claimId, { actorId, organizationId });
  }
  @Post("prepare")
  @ApiCoreBody("PrepareResupplyDocumentRequest")
  @ApiCoreResponse("ResupplyDocumentView", 201)
  prepare(@Param("orderId", ParseUUIDPipe) orderId: string, @Param("discrepancyId", ParseUUIDPipe) claimId: string,
    @Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const parsed = prepareResupplyDocumentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.prepare(orderId, claimId, parsed.data, { actorId, organizationId });
  }
  @Get(":documentId/download")
  @ApiUuidParam("documentId", "Working draft identifier")
  @ApiCoreResponse("DiscrepancyDownload")
  download(@Param("orderId", ParseUUIDPipe) orderId: string, @Param("discrepancyId", ParseUUIDPipe) claimId: string,
    @Param("documentId", ParseUUIDPipe) documentId: string, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    return this.service.download(orderId, claimId, documentId, { actorId, organizationId });
  }
}
