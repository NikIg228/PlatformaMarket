import { Module } from "@nestjs/common";
import { SuppliersModule } from "../suppliers/suppliers.module";
import { PublicCatalogController, SearchController } from "./search.controller";
import { SearchProjectionService } from "./search-projection.service";
import { SearchService } from "./search.service";
import { SearchAnalyticsService } from "./search-analytics.service";
import { MarketplaceAgreementsModule } from "../agreements/marketplace-agreements.module";

@Module({ imports: [MarketplaceAgreementsModule, SuppliersModule], controllers: [SearchController, PublicCatalogController], providers: [SearchService, SearchProjectionService, SearchAnalyticsService], exports: [SearchProjectionService, SearchAnalyticsService] })
export class SearchModule {}
