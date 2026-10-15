import { BadRequestException, Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { prepareOrderInvoiceSchema } from "@marketplace/schemas";
import { ApiCoreBody, ApiCoreErrors, ApiCoreProtected, ApiCoreResponse, ApiUuidParam } from "../../platform/openapi/core-openapi";
import { OrderInvoiceService } from "./order-invoice.service";

@ApiTags("order-invoices")
@ApiCoreProtected()
@ApiCoreErrors()
@Controller("supplier-orders/:orderId/invoices")
export class OrderInvoiceController {
  constructor(private readonly invoices: OrderInvoiceService) {}

  @Get()
  @ApiUuidParam("orderId", "Supplier order identifier")
  @ApiCoreResponse("OrderInvoicesResponse")
  list(@Param("orderId", ParseUUIDPipe) orderId: string, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    return this.invoices.list(orderId, { actorId, organizationId });
  }

  @Post("prepare")
  @ApiUuidParam("orderId", "Supplier order identifier")
  @ApiCoreBody("PrepareOrderInvoiceRequest")
  @ApiCoreResponse("OrderInvoiceView", 201)
  prepare(@Param("orderId", ParseUUIDPipe) orderId: string, @Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const parsed = prepareOrderInvoiceSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ code: "INVALID_ORDER_INVOICE", message: "Проверьте параметры формирования счёта", details: parsed.error.flatten() });
    return this.invoices.prepare(orderId, parsed.data, { actorId, organizationId });
  }
}
