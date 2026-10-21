import { Body, Controller, Get, Header, Headers, HttpCode, Param, Post, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiQuery } from "@nestjs/swagger";
import { ApiCoreBody, ApiCoreErrors, ApiCoreProtected, ApiCoreResponse, ApiUuidParam } from "../../platform/openapi/core-openapi";
import { identityError } from "../identity-signing/identity-signing.store";
import { SigningAdmissionService } from "./signing-admission.service";

@Controller() @ApiCoreProtected() @ApiCoreErrors()
@Throttle({ ip: { limit: 60, ttl: 60000 }, user: { limit: 40, ttl: 60000 }, tenant: { limit: 300, ttl: 60000 } })
export class SigningAdmissionController {
  constructor(private readonly service: SigningAdmissionService) {}

  @Get("organizations/:organizationId/signing/admission") @Header("Cache-Control", "no-store")
  @ApiUuidParam("organizationId") @ApiCoreResponse("CurrentSigningAdmission")
  current(@Param("organizationId") target: string, @Headers("x-user-id") actorId: string,
    @Headers("x-organization-id") organizationId: string, @Headers("x-session-id") sessionId: string) {
    return this.service.current({ actorId, organizationId, sessionId }, target);
  }

  @Post("organizations/:organizationId/signing/admission") @Header("Cache-Control", "no-store")
  @ApiUuidParam("organizationId") @ApiCoreBody("SigningAdmissionRequest") @ApiCoreResponse("SigningAdmission", 201)
  @Throttle({ user: { limit: 6, ttl: 60000 } })
  submit(@Param("organizationId") target: string, @Body() body: unknown, @Headers("x-user-id") actorId: string,
    @Headers("x-organization-id") organizationId: string, @Headers("x-session-id") sessionId: string) {
    return this.service.submit({ actorId, organizationId, sessionId }, target, body);
  }

  @Get("operations/signing/admissions") @Header("Cache-Control", "no-store") @ApiCoreResponse("SigningAdmissionPage")
  @ApiQuery({ name: "offset", required: true, type: Number }) @ApiQuery({ name: "limit", required: true, type: Number })
  queue(@Query() query: Record<string, unknown>, @Headers("x-user-id") actorId: string,
    @Headers("x-organization-id") organizationId: string, @Headers("x-session-id") sessionId: string) {
    if (Object.keys(query).length !== 2 || ![query.offset, query.limit].every(value => typeof value === "string" && /^(0|[1-9]\d*)$/.test(value))) identityError("BAD_REQUEST");
    return this.service.queue({ actorId, organizationId, sessionId }, { offset: Number(query.offset), limit: Number(query.limit) });
  }

  @Get("operations/signing/admissions/:id") @Header("Cache-Control", "no-store")
  @ApiUuidParam("id") @ApiCoreResponse("SigningAdmission")
  detail(@Param("id") id: string, @Headers("x-user-id") actorId: string,
    @Headers("x-organization-id") organizationId: string, @Headers("x-session-id") sessionId: string) {
    return this.service.detail({ actorId, organizationId, sessionId }, id);
  }

  @Post("operations/signing/admissions/:id/review") @HttpCode(200) @Header("Cache-Control", "no-store")
  @ApiUuidParam("id") @ApiCoreBody("SigningAdmissionReviewRequest") @ApiCoreResponse("SigningAdmission")
  @Throttle({ user: { limit: 10, ttl: 60000 } })
  review(@Param("id") id: string, @Body() body: unknown, @Headers("x-user-id") actorId: string,
    @Headers("x-organization-id") organizationId: string, @Headers("x-session-id") sessionId: string) {
    return this.service.review({ actorId, organizationId, sessionId }, id, body);
  }
}
