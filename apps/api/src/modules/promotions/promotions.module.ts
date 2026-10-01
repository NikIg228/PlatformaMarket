import { Module } from "@nestjs/common";
import { PromotionsController } from "./promotions.controller";
import { PromotionsService } from "./promotions.service";
import { MarketplaceAgreementsModule } from "../agreements/marketplace-agreements.module";

@Module({ imports: [MarketplaceAgreementsModule], controllers: [PromotionsController], providers: [PromotionsService], exports: [PromotionsService] })
export class PromotionsModule {}
