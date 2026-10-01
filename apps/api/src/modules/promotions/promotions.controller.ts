import { BadRequestException, Body, Controller, Get, Headers, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { createOfferPromotionSchema, reviseOfferPromotionSchema, offerPromotionCommandSchema, promotionListQuerySchema } from "@marketplace/schemas";
import { ApiTags } from "@nestjs/swagger";
import { ApiCoreBody, ApiCoreProtected, ApiCoreResponse } from "../../platform/openapi/core-openapi";
import { PermissionsGuard } from "../access-control/permissions.guard";
import { RequirePermissions } from "../access-control/require-permissions.decorator";
import { PromotionsService } from "./promotions.service";

const parsed = <T>(schema: z.ZodType<T>, input: unknown): T => { const result = schema.safeParse(input); if (!result.success) throw new BadRequestException(result.error.flatten()); return result.data; };
@ApiTags("promotions")
@UseGuards(PermissionsGuard)
@Controller("promotions")
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @Get("storefront") @ApiCoreResponse("PublicPromotionPage")
  storefront(@Query() query: unknown) { return this.promotions.storefront(parsed(promotionListQuerySchema, query)); }

  @Get() @RequirePermissions("promotion.view") @ApiCoreProtected() @ApiCoreResponse("PromotionPage")
  list(@Query() query: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) { return this.promotions.list(parsed(promotionListQuerySchema, query), { actorId, organizationId }); }

  @Post() @RequirePermissions("promotion.manage") @ApiCoreProtected() @ApiCoreBody("CreateOfferPromotion") @ApiCoreResponse("OfferPromotion", 201)
  create(@Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) { return this.promotions.create(parsed(createOfferPromotionSchema, body), { actorId, organizationId }); }

  @Patch(":promotionId/terms") @RequirePermissions("promotion.manage") @ApiCoreProtected() @ApiCoreBody("ReviseOfferPromotion") @ApiCoreResponse("OfferPromotion")
  revise(@Param("promotionId") id: string, @Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) { return this.promotions.revise(parsed(z.uuid(), id), parsed(reviseOfferPromotionSchema, body), { actorId, organizationId }); }

  @Post(":promotionId/commands") @RequirePermissions("promotion.manage") @ApiCoreProtected() @ApiCoreBody("OfferPromotionCommand") @ApiCoreResponse("OfferPromotion", 201)
  command(@Param("promotionId") id: string, @Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) { return this.promotions.command(parsed(z.uuid(), id), parsed(offerPromotionCommandSchema, body), { actorId, organizationId }); }
}
