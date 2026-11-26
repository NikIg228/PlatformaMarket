import { BadRequestException, Controller, Get, Headers, NotFoundException, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { janaPostLocalQuerySchema, type JanaPostLocalCity, type JanaPostLocalResult } from "@marketplace/schemas";
import { isLimitedTestStand } from "../../platform/config/limited-stand";
import { ApiCoreErrors, ApiCoreProtected, ApiCoreQuery, ApiCoreResponse, ApiUuidParam } from "../../platform/openapi/core-openapi";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { PermissionsGuard } from "../access-control/permissions.guard";
import { RequirePermissions } from "../access-control/require-permissions.decorator";

const points: Record<JanaPostLocalCity, JanaPostLocalResult["points"]> = {
  almaty: [{ code: "DEMO-ALA-01", name: "Алматы · ПВЗ 1" }, { code: "DEMO-ALA-02", name: "Алматы · ПВЗ 2" }],
  astana: [{ code: "DEMO-AST-01", name: "Астана · ПВЗ 1" }],
  shymkent: [],
};

@ApiTags("logistics")
@ApiCoreProtected()
@ApiCoreErrors()
@UseGuards(PermissionsGuard)
@RequirePermissions("delivery.view")
@Controller("supplier-orders/:orderId/janapost-local")
export class JanaPostLocalController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiUuidParam("orderId", "Supplier order identifier")
  @ApiCoreQuery("JanaPostLocalQuery")
  @ApiCoreResponse("JanaPostLocalResult")
  async lookup(
    @Param("orderId", ParseUUIDPipe) orderId: string,
    @Headers("x-organization-id") organizationId: string,
    @Query() query: unknown,
  ): Promise<JanaPostLocalResult> {
    if (process.env.JANAPOST_LOCAL_FIXTURES !== "true" || process.env.NODE_ENV === "production"
      || isLimitedTestStand() || !organizationId) throw new NotFoundException();
    const order = await this.prisma.supplierOrder.findFirst({
      where: { id: orderId, supplierOrganizationId: organizationId },
      select: { id: true },
    });
    if (!order) throw new NotFoundException();

    const parsed = janaPostLocalQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException("Выберите тестовый город.");
    return {
      points: points[parsed.data.city],
      tracking: { number: "DEMO-JP-001", status: "arrival_branch" },
    };
  }
}
