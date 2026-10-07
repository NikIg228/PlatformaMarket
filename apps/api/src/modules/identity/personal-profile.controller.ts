import { BadRequestException, Body, Controller, Get, Header, Headers, Post } from "@nestjs/common";
import { updatePersonalProfileSchema, requestProfileEmailSchema, uploadProfileAvatarSchema } from "@marketplace/schemas";
import { ApiCoreBody, ApiCoreErrors, ApiCoreProtected, ApiCoreResponse } from "../../platform/openapi/core-openapi";
import { PersonalProfileService } from "./personal-profile.service";
import { Throttle } from "@nestjs/throttler";

@Controller("auth/profile") @ApiCoreProtected() @ApiCoreErrors()
export class PersonalProfileController {
  constructor(private readonly profiles: PersonalProfileService) {}
  @Get() @Header("Cache-Control", "no-store") @ApiCoreResponse("PersonalProfile")
  current(@Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string, @Headers("x-session-id") sessionId: string) {
    return this.profiles.current({ actorId, organizationId, sessionId });
  }
  @Post() @ApiCoreBody("UpdatePersonalProfile") @ApiCoreResponse("PersonalProfile", 201)
  save(@Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string, @Headers("x-session-id") sessionId: string) {
    const parsed = updatePersonalProfileSchema.safeParse(body); if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.profiles.save(parsed.data, { actorId, organizationId, sessionId });
  }
  @Post("email") @ApiCoreBody("RequestProfileEmail") @ApiCoreResponse("ProfileEmailRequested", 201)
  @Throttle({ ip: { limit: 10, ttl: 60_000 }, user: { limit: 5, ttl: 60_000 }, tenant: { limit: 30, ttl: 60_000 } })
  email(@Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string, @Headers("x-session-id") sessionId: string) {
    const parsed = requestProfileEmailSchema.safeParse(body); if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.profiles.requestEmail(parsed.data, { actorId, organizationId, sessionId });
  }
  @Post("avatar") @ApiCoreBody("UploadProfileAvatar") @ApiCoreResponse("PersonalProfile", 201)
  @Throttle({ ip: { limit: 20, ttl: 60_000 }, user: { limit: 10, ttl: 60_000 }, tenant: { limit: 60, ttl: 60_000 } })
  upload(@Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string, @Headers("x-session-id") sessionId: string) {
    const parsed = uploadProfileAvatarSchema.safeParse(body); if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.profiles.uploadAvatar(parsed.data, { actorId, organizationId, sessionId });
  }
  @Get("avatar") @Header("Cache-Control", "no-store") @ApiCoreResponse("ProfileAvatar")
  avatar(@Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string, @Headers("x-session-id") sessionId: string) {
    return this.profiles.avatar({ actorId, organizationId, sessionId });
  }
}
