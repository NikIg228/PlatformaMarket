import { Module } from "@nestjs/common";
import { AccessControlModule } from "../access-control/access-control.module";
import { SuppliersModule } from "../suppliers/suppliers.module";
import { OffersController } from "./offers.controller";
import { OffersService } from "./offers.service";
import { ComplianceModule } from "../compliance/compliance.module";
import { MarketplaceAgreementsModule } from "../agreements/marketplace-agreements.module";
import { SearchModule } from "../search/search.module";
import { InventoryModule } from "../inventory/inventory.module";
import { OfferCommercialService } from "./offer-commercial.service";

@Module({ imports: [AccessControlModule, SuppliersModule, ComplianceModule, MarketplaceAgreementsModule, SearchModule, InventoryModule], controllers: [OffersController], providers: [OffersService, OfferCommercialService] })
export class OffersModule {}
