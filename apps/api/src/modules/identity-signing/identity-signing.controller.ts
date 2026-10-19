import { Body, Controller, Get, Header, Headers, HttpCode, Param, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { submitPilotCmsSchema } from "@marketplace/schemas";
import { ApiCoreBody, ApiCoreErrors, ApiCoreProtected, ApiCoreResponse, ApiUuidParam } from "../../platform/openapi/core-openapi";
import { IdentitySigningService } from "./identity-signing.service";
import { identityError } from "./identity-signing.store";

@Controller() @ApiCoreProtected() @ApiCoreErrors()
@Throttle({ ip: { limit: 60, ttl: 60000 }, user: { limit: 40, ttl: 60000 }, tenant: { limit: 300, ttl: 60000 } })
export class IdentitySigningController {
  constructor(private readonly signing: IdentitySigningService) {}
  @Get("identity/signing-binding") @Header("Cache-Control", "no-store") @ApiCoreResponse("SigningIdentity")
  current(@Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string, @Headers("x-session-id") sessionId: string) {
    return this.signing.current({ actorId, organizationId, sessionId });
  }
  @Post("identity/signing-binding/challenges") @Header("Cache-Control", "no-store")
  @ApiCoreBody("SigningIdentityChallengeRequest") @ApiCoreResponse("IdentitySigningSession", 201)
  @Throttle({ user: { limit: 6, ttl: 60000 } })
  create(@Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string, @Headers("x-session-id") sessionId: string) {
    return this.signing.create({ actorId, organizationId, sessionId }, body);
  }
  @Get("signing/sessions/:id") @Header("Cache-Control", "no-store") @ApiUuidParam("id") @ApiCoreResponse("IdentitySigningSession")
  get(@Param("id") id: string, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string, @Headers("x-session-id") sessionId: string) {
    return this.signing.get({ actorId, organizationId, sessionId }, id);
  }
  @Post("signing/sessions/cms") @HttpCode(202) @Header("Cache-Control", "no-store")
  @ApiCoreBody("IdentitySigningCmsRequest") @ApiCoreResponse("IdentitySigningSession", 202)
  @Throttle({ user: { limit: 10, ttl: 60000 } })
  submit(@Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string, @Headers("x-session-id") sessionId: string) {
    const parsed = submitPilotCmsSchema.safeParse(body);
    if (!parsed.success) identityError("BAD_REQUEST");
    return this.signing.submit({ actorId, organizationId, sessionId }, parsed.data.sessionId, parsed.data);
  }
  @Post("signing/sessions/:id/cancel") @HttpCode(200) @Header("Cache-Control", "no-store") @ApiUuidParam("id")
  @ApiCoreBody("IdentitySigningTransitionRequest") @ApiCoreResponse("IdentitySigningSession")
  cancel(@Param("id") id: string, @Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string, @Headers("x-session-id") sessionId: string) {
    return this.signing.transition({ actorId, organizationId, sessionId }, id, body, "cancel");
  }
  @Post("signing/sessions/:id/retry") @HttpCode(202) @Header("Cache-Control", "no-store") @ApiUuidParam("id")
  @ApiCoreBody("IdentitySigningTransitionRequest") @ApiCoreResponse("IdentitySigningSession", 202)
  @Throttle({ user: { limit: 6, ttl: 60000 } })
  retry(@Param("id") id: string, @Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string, @Headers("x-session-id") sessionId: string) {
    return this.signing.transition({ actorId, organizationId, sessionId }, id, body, "retry");
  }
}
