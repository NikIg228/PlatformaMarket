import { BadRequestException, Body, Controller, Get, Header, Headers, Post, Query, UseGuards } from "@nestjs/common";
import { confirmOrganizationRequisitesSchema, organizationRequisitesHistoryQuerySchema, saveOrganizationRequisitesSchema } from "@marketplace/schemas";
import { ApiCoreBody, ApiCoreErrors, ApiCoreProtected, ApiCoreQuery, ApiCoreResponse } from "../../platform/openapi/core-openapi";
import { PermissionsGuard } from "../access-control/permissions.guard";
import { RequirePermissions } from "../access-control/require-permissions.decorator";
import { OrganizationRequisitesService } from "./organization-requisites.service";

@Controller("organizations/current/requisites")
@UseGuards(PermissionsGuard)
@ApiCoreProtected() @ApiCoreErrors()
export class OrganizationRequisitesController {
  constructor(private readonly requisites: OrganizationRequisitesService) {}

  @Get() @Header("Cache-Control", "no-store") @RequirePermissions("organization.view")
  @ApiCoreResponse("OrganizationRequisitesResponse")
  current(@Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    return this.requisites.current({ actorId, organizationId });
  }

  @Get("history") @Header("Cache-Control", "no-store") @RequirePermissions("organization.view")
  @ApiCoreQuery("OrganizationRequisitesHistoryQuery") @ApiCoreResponse("OrganizationRequisitesHistory")
  history(@Query() query: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const parsed = organizationRequisitesHistoryQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException("Неверные параметры истории реквизитов");
    return this.requisites.history(parsed.data, { actorId, organizationId });
  }

  @Post() @Header("Cache-Control", "no-store") @RequirePermissions("organization.members.manage")
  @ApiCoreBody("SaveOrganizationRequisitesRequest")
  @ApiCoreResponse("OrganizationRequisitesMutation", 201, "Own organization only. Appends an unconfirmed snapshot; version, audit, outbox and idempotency are atomic. A concurrent write returns 409; retry the same key after checking the current state.")
  save(@Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const parsed = saveOrganizationRequisitesSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ code: "INVALID_ORGANIZATION_REQUISITES", message: "Проверьте реквизиты", details: parsed.error.flatten() });
    return this.requisites.save(parsed.data, { actorId, organizationId });
  }

  @Post("confirm") @Header("Cache-Control", "no-store") @RequirePermissions("organization.members.manage")
  @ApiCoreBody("ConfirmOrganizationRequisitesRequest")
  @ApiCoreResponse("OrganizationRequisitesMutation", 201, "Confirms only the current complete revision against current organization data. Representative acknowledgement is not external verification or an electronic signature. Immutable payload; atomic audit/outbox/replay. Incomplete or stale data returns 409.")
  confirm(@Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const parsed = confirmOrganizationRequisitesSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ code: "INVALID_ORGANIZATION_REQUISITES", message: "Подтвердите достоверность выбранной версии", details: parsed.error.flatten() });
    return this.requisites.confirm(parsed.data, { actorId, organizationId });
  }
}
