import { Module } from "@nestjs/common";
import { MarketplaceAgreementsModule } from "../agreements/marketplace-agreements.module";
import { SupplierStorefrontService } from "./supplier-storefront.service";
import { SupplierStorefrontController, PublicSupplierStorefrontController } from "./supplier-storefront.controller";
import { AccessControlModule } from "../access-control/access-control.module";
import { SupplierAccessService } from "./supplier-access.service";
import { SuppliersController } from "./suppliers.controller";
import { SuppliersService } from "./suppliers.service";
import { IntegrationCryptoService } from "../integrations/integration-crypto.service";

@Module({
  imports: [AccessControlModule, MarketplaceAgreementsModule],
  controllers: [SuppliersController, SupplierStorefrontController, PublicSupplierStorefrontController],
  providers: [SupplierAccessService, SuppliersService, IntegrationCryptoService, SupplierStorefrontService],
  exports: [SupplierAccessService, SupplierStorefrontService],
})
export class SuppliersModule {}
