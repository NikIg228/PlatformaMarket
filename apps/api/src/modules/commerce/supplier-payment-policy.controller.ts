import { BadRequestException, Body, Controller, Get, Headers, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { saveSupplierPaymentPolicySchema } from "@marketplace/schemas";
import { ApiCoreBody, ApiCoreErrors, ApiCoreProtected, ApiCoreResponse } from "../../platform/openapi/core-openapi";
import { SupplierPaymentPolicyService } from "./supplier-payment-policy.service";

@ApiTags("commerce")
@ApiCoreProtected()
@ApiCoreErrors()
@Controller("suppliers/current/payment-review-policy")
export class SupplierPaymentPolicyController {
  constructor(private readonly policies: SupplierPaymentPolicyService) {}
  @Get()
  @ApiCoreResponse("SupplierPaymentPolicyResponse")
  get(@Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    return this.policies.get({ actorId, organizationId });
  }
  @Post()
  @ApiCoreBody("SaveSupplierPaymentPolicy")
  @ApiCoreResponse("SupplierPaymentPolicyResponse", 201)
  save(@Body() body: unknown, @Headers("x-user-id") actorId: string, @Headers("x-organization-id") organizationId: string) {
    const parsed = saveSupplierPaymentPolicySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.policies.save(parsed.data, { actorId, organizationId });
  }
}
