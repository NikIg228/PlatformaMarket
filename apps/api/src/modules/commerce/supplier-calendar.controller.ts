import { BadRequestException, Body, Controller, Get, Header, Headers, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { saveSupplierCalendarSchema } from "@marketplace/schemas";
import { ApiCoreBody, ApiCoreErrors, ApiCoreProtected, ApiCoreResponse } from "../../platform/openapi/core-openapi";
import { SupplierCalendarService } from "./supplier-calendar.service";

@ApiTags("commerce")
@ApiCoreProtected()
@ApiCoreErrors()
@Controller("suppliers/current/working-calendar")
export class SupplierCalendarController {
  constructor(private readonly calendars: SupplierCalendarService) {}
  @Get() @Header("Cache-Control", "no-store") @ApiCoreResponse("SupplierCalendarResponse")
  get(@Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    return this.calendars.get({ actorId, organizationId });
  }
  @Post() @Header("Cache-Control", "no-store") @ApiCoreBody("SaveSupplierCalendar") @ApiCoreResponse("SupplierCalendarResponse", 201)
  save(@Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const parsed = saveSupplierCalendarSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.calendars.save(parsed.data, { actorId, organizationId });
  }
}
