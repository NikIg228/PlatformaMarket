import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Headers,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiCreatedResponse, ApiTags } from "@nestjs/swagger";
import {
  acceptInvitationSchema,
  createInvitationSchema,
  invitationProofSchema,
} from "@marketplace/schemas";
import { ApiCoreBody, ApiCoreResponse } from "../../platform/openapi/core-openapi";
import { InvitationsService } from "./invitations.service";
import { PermissionsGuard } from "../access-control/permissions.guard";
import { RequirePermissions } from "../access-control/require-permissions.decorator";

@ApiTags("identity")
@Controller()
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post("organizations/:organizationId/invitations")
  @UseGuards(PermissionsGuard)
  @RequirePermissions("organization.members.manage")
  @ApiCoreBody("CreateInvitationRequest")
  @ApiCoreResponse("InvitationCreated", 201, "Token is returned only once to the authorized manager")
  create(
    @Param("organizationId") organizationId: string,
    @Headers("x-organization-id") activeOrganizationId: string,
    @Headers("x-user-id") actorId: string,
    @Body() body: unknown,
  ) {
    if (organizationId !== activeOrganizationId)
      throw new ForbiddenException(
        "Invitation must target the active organization",
      );
    const parsed = createInvitationSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.invitations.create(organizationId, actorId, parsed.data);
  }

  @Get("organizations/:organizationId/invitations")
  @UseGuards(PermissionsGuard)
  @RequirePermissions("organization.members.manage")
  @ApiCoreResponse("InvitationList", 200)
  list(@Param("organizationId") organizationId: string, @Headers("x-organization-id") activeOrganizationId: string) {
    this.assertOrganization(organizationId, activeOrganizationId);
    return this.invitations.list(organizationId);
  }

  @Post("organizations/:organizationId/invitations/:invitationId/deliver")
  @UseGuards(PermissionsGuard)
  @RequirePermissions("organization.members.manage")
  @ApiCoreResponse("InvitationDelivered", 201, "Rotates previous proof and requests mail delivery; not a delivery receipt")
  deliver(@Param("organizationId") organizationId: string, @Param("invitationId") invitationId: string, @Headers("x-organization-id") activeOrganizationId: string, @Headers("x-user-id") actorId: string) {
    this.assertOrganization(organizationId, activeOrganizationId);
    return this.invitations.deliver(organizationId, invitationId, actorId);
  }

  @Post("organizations/:organizationId/invitations/:invitationId/revoke")
  @UseGuards(PermissionsGuard)
  @RequirePermissions("organization.members.manage")
  @ApiCoreResponse("IdentityCommandResult", 201)
  revoke(@Param("organizationId") organizationId: string, @Param("invitationId") invitationId: string, @Headers("x-organization-id") activeOrganizationId: string, @Headers("x-user-id") actorId: string) {
    this.assertOrganization(organizationId, activeOrganizationId);
    return this.invitations.revoke(organizationId, invitationId, actorId);
  }

  @Post("invitations/details")
  @ApiCoreBody("InvitationProof")
  @ApiCoreResponse("InvitationDetails", 201)
  details(@Body() body: unknown) {
    const parsed = invitationProofSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.invitations.details(parsed.data.token);
  }

  @Post("invitations/accept")
  @ApiCoreBody("AcceptInvitationRequest")
  @ApiCoreResponse("InvitationAccepted", 201, "Single-use proof; existing accounts require password or authenticated matching identity")
  accept(@Body() body: unknown, @Headers("x-user-id") actorId?: string) {
    const parsed = acceptInvitationSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.invitations.accept(parsed.data, actorId);
  }

  private assertOrganization(organizationId: string, activeOrganizationId: string) {
    if (organizationId !== activeOrganizationId) throw new ForbiddenException("Invitation must target the active organization");
  }
}
