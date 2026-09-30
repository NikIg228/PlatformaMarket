import { BadRequestException, Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { orderWorkflowCommandSchema } from "@marketplace/schemas";
import { ApiCoreBody, ApiCoreErrors, ApiCoreProtected, ApiCoreResponse, ApiUuidParam } from "../../platform/openapi/core-openapi";
import { OrderWorkflowService } from "./order-workflow.service";

@ApiTags("commerce")
@ApiCoreProtected()
@ApiCoreErrors()
@Controller("supplier-orders/:orderId/workflow")
export class OrderWorkflowController {
  constructor(private readonly workflow: OrderWorkflowService) {}
  @Get()
  @ApiUuidParam("orderId", "Supplier order identifier")
  @ApiCoreResponse("OrderWorkflowResponse")
  get(@Param("orderId", ParseUUIDPipe) id: string, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    return this.workflow.get(id, { actorId, organizationId });
  }
  @Post()
  @ApiUuidParam("orderId", "Supplier order identifier")
  @ApiCoreBody("OrderWorkflowCommand")
  @ApiCoreResponse("OrderWorkflowResult", 201)
  execute(@Param("orderId", ParseUUIDPipe) id: string, @Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const parsed = orderWorkflowCommandSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.workflow.execute(id, parsed.data, { actorId, organizationId });
  }
}
