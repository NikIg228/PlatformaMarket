import { BadRequestException, Body, Controller, Delete, Get, Header, Headers, HttpCode, Param, ParseUUIDPipe, Patch, Post, Res, UnauthorizedException } from "@nestjs/common";
import type { Response } from "express";
import { ApiTags } from "@nestjs/swagger";
import { personalCartAddSchema, personalCartCreateSchema, personalCartRepriceSchema, personalCartUpdateSchema, personalCartVersionSchema } from "@marketplace/schemas";
import { ApiCoreBody, ApiCoreErrors, ApiCoreProtected, ApiCoreResponse, ApiUuidParam } from "../../platform/openapi/core-openapi";
import { PersonalCartService } from "./personal-cart.service";
import type { z } from "zod";

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
  return parsed.data;
}
@ApiTags("personal-cart")
@ApiCoreProtected()
@ApiCoreErrors()
@Controller("personal/carts")
export class PersonalCartController {
  constructor(private readonly carts: PersonalCartService) {}
  private actor(actorId: string, sessionId: string) {
    // Middleware strips caller headers even in development for this route family.
    if (!actorId || !sessionId) throw new UnauthorizedException("Войдите в личный аккаунт.");
    return actorId;
  }
  @Get() @Header("Cache-Control", "no-store") @ApiCoreResponse("PersonalCartListResponse")
  list(@Headers("x-user-id") actor: string, @Headers("x-session-id") session: string) { return this.carts.list(this.actor(actor, session)); }
  @Get("current") @Header("Cache-Control", "no-store") @ApiCoreResponse("PersonalCartCurrentResponse")
  async current(@Headers("x-user-id") actor: string, @Headers("x-session-id") session: string, @Res() response: Response) {
    // Nest otherwise serializes a null result as an empty body, not JSON null.
    return response.json(await this.carts.current(this.actor(actor, session)));
  }
  @Post() @ApiCoreBody("PersonalCartCreateRequest") @ApiCoreResponse("PersonalCartResponse", 201)
  create(@Body() body: unknown, @Headers("x-user-id") actor: string, @Headers("x-session-id") session: string) {
    const owner = this.actor(actor, session); parse(personalCartCreateSchema, body ?? {}); return this.carts.create(owner);
  }
  @Get(":cartId") @Header("Cache-Control", "no-store") @ApiUuidParam("cartId", "Personal cart identifier") @ApiCoreResponse("PersonalCartResponse")
  get(@Param("cartId", ParseUUIDPipe) id: string, @Headers("x-user-id") actor: string, @Headers("x-session-id") session: string) { return this.carts.get(id, this.actor(actor, session)); }
  @Post(":cartId/items") @ApiUuidParam("cartId", "Personal cart identifier") @ApiCoreBody("PersonalCartAddRequest") @ApiCoreResponse("PersonalCartResponse", 201)
  add(@Param("cartId", ParseUUIDPipe) id: string, @Body() body: unknown, @Headers("x-user-id") actor: string, @Headers("x-session-id") session: string) {
    const owner = this.actor(actor, session); return this.carts.add(id, parse(personalCartAddSchema, body), owner);
  }
  @Patch(":cartId/items/:itemId") @ApiUuidParam("cartId", "Personal cart identifier") @ApiUuidParam("itemId", "Personal item identifier") @ApiCoreBody("PersonalCartUpdateRequest") @ApiCoreResponse("PersonalCartResponse")
  update(@Param("cartId", ParseUUIDPipe) id: string, @Param("itemId", ParseUUIDPipe) item: string, @Body() body: unknown, @Headers("x-user-id") actor: string, @Headers("x-session-id") session: string) {
    const owner = this.actor(actor, session); return this.carts.update(id, item, parse(personalCartUpdateSchema, body), owner);
  }
  @Delete(":cartId/items/:itemId") @ApiUuidParam("cartId", "Personal cart identifier") @ApiUuidParam("itemId", "Personal item identifier") @ApiCoreBody("PersonalCartVersionRequest") @ApiCoreResponse("PersonalCartResponse")
  remove(@Param("cartId", ParseUUIDPipe) id: string, @Param("itemId", ParseUUIDPipe) item: string, @Body() body: unknown, @Headers("x-user-id") actor: string, @Headers("x-session-id") session: string) {
    const owner = this.actor(actor, session); return this.carts.remove(id, item, parse(personalCartVersionSchema, body), owner);
  }
  @Post(":cartId/validate") @HttpCode(200) @Header("Cache-Control", "no-store") @ApiUuidParam("cartId", "Personal cart identifier") @ApiCoreResponse("PersonalCartValidationResponse")
  validate(@Param("cartId", ParseUUIDPipe) id: string, @Headers("x-user-id") actor: string, @Headers("x-session-id") session: string) { return this.carts.validate(id, this.actor(actor, session)); }
  @Post(":cartId/reprice") @ApiUuidParam("cartId", "Personal cart identifier") @ApiCoreBody("PersonalCartRepriceRequest") @ApiCoreResponse("PersonalCartResponse", 201)
  reprice(@Param("cartId", ParseUUIDPipe) id: string, @Body() body: unknown, @Headers("x-user-id") actor: string, @Headers("x-session-id") session: string) {
    const owner = this.actor(actor, session); return this.carts.reprice(id, parse(personalCartRepriceSchema, body), owner);
  }
}
