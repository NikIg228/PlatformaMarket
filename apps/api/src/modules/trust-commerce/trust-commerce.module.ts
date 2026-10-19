import { Module } from "@nestjs/common";
import { TrustCommerceController } from "./trust-commerce.controller";
import { TrustCommerceService } from "./trust-commerce.service";
import { AccessControlModule } from "../access-control/access-control.module";
import { OperatorTrustController } from "./operator-trust.controller";
import { OperatorTrustService } from "./operator-trust.service";

@Module({
  imports: [AccessControlModule],
  controllers: [TrustCommerceController, OperatorTrustController],
  providers: [TrustCommerceService, OperatorTrustService],
  exports: [TrustCommerceService],
})
export class TrustCommerceModule {}
