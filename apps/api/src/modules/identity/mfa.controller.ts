import { BadRequestException, Body, Controller, Get, Headers, Post } from "@nestjs/common";
import { mfaCodeSchema } from "@marketplace/schemas";
import { ApiTags } from "@nestjs/swagger";
import { MfaService } from "./mfa.service";
import { AuthSessionsService } from "./auth-sessions.service";
import { ApiCoreBody, ApiCoreErrors, ApiCoreProtected, ApiCoreResponse } from "../../platform/openapi/core-openapi";

@ApiTags("identity-mfa")
@ApiCoreProtected()
@ApiCoreErrors()
@ApiCoreResponse("ErrorResponse", 429)
@Controller("identity/mfa")
export class MfaController {
  constructor(private readonly mfa: MfaService, private readonly sessions: AuthSessionsService) {}
  private context(actorId: string, organizationId: string) { return { actorId, organizationId }; }

  @Get()
  @ApiCoreResponse("MfaStatus")
  status(@Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) { return this.mfa.status(this.context(actorId, organizationId)); }

  @Post("totp/enroll")
  @ApiCoreResponse("MfaEnrollment", 201)
  enroll(@Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) { return this.mfa.enroll(this.context(actorId, organizationId)); }

  @Post("totp/verify")
  @ApiCoreBody("MfaCode") @ApiCoreResponse("MfaVerificationResult", 201)
  async verify(@Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string, @Headers("x-session-id") sessionId: string) {
    const parsed = mfaCodeSchema.safeParse(body); if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const factor = await this.mfa.verifyEnrollment(parsed.data, this.context(actorId, organizationId));
    return sessionId ? { factor, ...(await this.sessions.elevateMfa(sessionId, actorId, organizationId)) } : factor;
  }

  @Post("challenge")
  @ApiCoreBody("MfaCode") @ApiCoreResponse("MfaChallengeResult", 201)
  async challenge(@Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string, @Headers("x-session-id") sessionId: string) {
    const parsed = mfaCodeSchema.safeParse(body); if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const factor = await this.mfa.challenge(parsed.data, this.context(actorId, organizationId));
    return sessionId ? { factor, ...(await this.sessions.elevateMfa(sessionId, actorId, organizationId)) } : factor;
  }

  @Post("disable")
  @ApiCoreBody("MfaCode") @ApiCoreResponse("MfaDisabled", 201)
  disable(@Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const parsed = mfaCodeSchema.safeParse(body); if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.mfa.disable(parsed.data, this.context(actorId, organizationId));
  }
}
