import { BadRequestException, Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { prepareShipmentWaybillSchema } from "@marketplace/schemas";
import { ApiCoreBody, ApiCoreErrors, ApiCoreProtected, ApiCoreResponse, ApiUuidParam } from "../../platform/openapi/core-openapi";
import { ShipmentWaybillService } from "./shipment-waybill.service";

@ApiTags("shipment-waybills")
@ApiCoreProtected()
@ApiCoreErrors()
@Controller("supplier-orders/:orderId/shipments/:shipmentId/waybills")
export class ShipmentWaybillController {
  constructor(private readonly waybills: ShipmentWaybillService) {}
  @Get()
  @ApiUuidParam("orderId", "Supplier order identifier")
  @ApiUuidParam("shipmentId", "Shipment identifier")
  @ApiCoreResponse("ShipmentWaybillsResponse")
  list(@Param("orderId", ParseUUIDPipe) orderId: string, @Param("shipmentId", ParseUUIDPipe) shipmentId: string,
    @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    return this.waybills.list(orderId, shipmentId, { actorId, organizationId });
  }
  @Post("prepare")
  @ApiUuidParam("orderId", "Supplier order identifier")
  @ApiUuidParam("shipmentId", "Shipment identifier")
  @ApiCoreBody("PrepareShipmentWaybillRequest")
  @ApiCoreResponse("ShipmentWaybillView", 201)
  prepare(@Param("orderId", ParseUUIDPipe) orderId: string, @Param("shipmentId", ParseUUIDPipe) shipmentId: string,
    @Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const parsed = prepareShipmentWaybillSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ code: "INVALID_SHIPMENT_WAYBILL", message: "Проверьте параметры подготовки накладной", details: parsed.error.flatten() });
    return this.waybills.prepare(orderId, shipmentId, parsed.data, { actorId, organizationId });
  }
}
