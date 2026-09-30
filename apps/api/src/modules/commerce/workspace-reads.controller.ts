import { BadRequestException, Controller, Get, Headers, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { workspaceOrderQuerySchema, workspacePageQuerySchema } from "@marketplace/schemas";
import { z } from "zod";
import { PermissionsGuard } from "../access-control/permissions.guard";
import { RequirePermissions } from "../access-control/require-permissions.decorator";
import { ApiCoreErrors, ApiCoreProtected, ApiCoreQuery, ApiCoreResponse, ApiUuidParam } from "../../platform/openapi/core-openapi";
import { WorkspaceReadsService } from "./workspace-reads.service";

function parse<T extends z.ZodType>(schema: T, query: unknown): z.output<T> {
  const result = schema.safeParse(query);
  if (!result.success) throw new BadRequestException(result.error.flatten());
  return result.data;
}
@ApiTags("workspace-reads")
@ApiCoreProtected()
@ApiCoreErrors()
@UseGuards(PermissionsGuard)
@Controller("workspaces")
export class WorkspaceReadsController {
  constructor(private readonly reads: WorkspaceReadsService) {}
  @Get("buyer/orders")
  @RequirePermissions("order.create")
  @ApiCoreQuery("WorkspaceOrderQuery")
  @ApiCoreResponse("WorkspaceOrderPage")
  buyerOrders(@Headers("x-organization-id") id: string, @Query() query: unknown) { return this.reads.orders(id, "buyer", parse(workspaceOrderQuerySchema, query)); }
  @Get("supplier/orders")
  @RequirePermissions("order.confirm")
  @ApiCoreQuery("WorkspaceOrderQuery")
  @ApiCoreResponse("WorkspaceOrderPage")
  supplierOrders(@Headers("x-organization-id") id: string, @Query() query: unknown) { return this.reads.orders(id, "supplier", parse(workspaceOrderQuerySchema, query)); }
  @Get("supplier/offers")
  @RequirePermissions("catalog.product.view")
  @ApiCoreQuery("WorkspacePageQuery")
  @ApiCoreResponse("WorkspaceOfferPage")
  offers(@Headers("x-organization-id") id: string, @Query() query: unknown) { return this.reads.offers(id, parse(workspacePageQuerySchema, query)); }
  @Get("supplier/offers/:offerId")
  @RequirePermissions("catalog.product.view")
  @ApiUuidParam("offerId")
  @ApiCoreResponse("WorkspaceOffer")
  offer(@Headers("x-organization-id") id: string, @Param("offerId", ParseUUIDPipe) offerId: string) { return this.reads.offer(id, offerId); }
  @Get("buyer/carts")
  @RequirePermissions("order.create")
  @ApiCoreQuery("WorkspacePageQuery")
  @ApiCoreResponse("WorkspaceCartPage")
  carts(@Headers("x-organization-id") id: string, @Query() query: unknown) { return this.reads.carts(id, parse(workspacePageQuerySchema, query)); }
  @Get("buyer/carts/:cartId")
  @RequirePermissions("order.create")
  @ApiUuidParam("cartId")
  @ApiCoreResponse("CartResponse")
  cart(@Headers("x-organization-id") id: string, @Param("cartId", ParseUUIDPipe) cartId: string) { return this.reads.cart(id, cartId); }
  @Get("supplier/summary")
  @RequirePermissions("order.confirm", "catalog.product.view")
  @ApiCoreResponse("WorkspaceSummary")
  summary(@Headers("x-organization-id") id: string) { return this.reads.summary(id); }
}
