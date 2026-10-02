import { BadRequestException, Controller, Get, Headers, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { commerceAnalyticsQuerySchema } from "@marketplace/schemas";
import { ApiCoreErrors, ApiCoreProtected, ApiCoreQuery, ApiCoreResponse } from "../../platform/openapi/core-openapi";
import { CommerceAnalyticsService } from "./commerce-analytics.service";

@ApiTags("commerce")
@ApiCoreProtected()
@ApiCoreErrors()
@Controller("commerce-analytics")
export class CommerceAnalyticsController {
  constructor(private readonly analytics: CommerceAnalyticsService) {}
  @Get()
  @ApiCoreQuery("CommerceAnalyticsQuery")
  @ApiCoreResponse("CommerceAnalyticsResponse")
  report(@Query() query: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const parsed = commerceAnalyticsQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.analytics.report(parsed.data, { actorId, organizationId });
  }
}
