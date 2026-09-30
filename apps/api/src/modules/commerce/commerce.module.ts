import { SupplierAuxiliaryReadsService } from "./supplier-auxiliary-reads.service";
import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { SuppliersModule } from "../suppliers/suppliers.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { ComplianceModule } from "../compliance/compliance.module";
import { CommerceController } from "./commerce.controller";
import { CommerceService } from "./commerce.service";
import { MarketplaceAgreementsModule } from "../agreements/marketplace-agreements.module";
import { OrderWorkflowController } from "./order-workflow.controller";
import { OrderWorkflowService } from "./order-workflow.service";
import { WorkspaceReadsController } from "./workspace-reads.controller";
import { WorkspaceReadsService } from "./workspace-reads.service";

@Module({ imports: [InventoryModule, SuppliersModule, IntegrationsModule, ComplianceModule, MarketplaceAgreementsModule], controllers: [CommerceController, OrderWorkflowController, WorkspaceReadsController], providers: [SupplierAuxiliaryReadsService, CommerceService, OrderWorkflowService, WorkspaceReadsService], exports: [CommerceService] })
export class CommerceModule {}
