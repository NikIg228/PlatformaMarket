import { Module } from "@nestjs/common";
import { OperatorAuditController } from "./operator-audit.controller";
import { OperatorAuditService } from "./operator-audit.service";
import { OperatorTechnicalController } from "./operator-technical.controller";
import { OperatorTechnicalService } from "./operator-technical.service";
import { OperatorDocumentExceptionsController } from "./operator-document-exceptions.controller";
import { OperatorDocumentExceptionsService } from "./operator-document-exceptions.service";
import { CommerceModule } from "../commerce/commerce.module";
import { OperatorOrdersController } from "./operator-orders.controller";
import { OperatorOrdersService } from "./operator-orders.service";
import { AccessControlModule } from "../access-control/access-control.module";
import { OperationsController } from "./operations.controller";
import { OperationsService } from "./operations.service";
import { OperationQueueService } from "./operation-queue.service";
import { OperationWorkflowService } from "./operation-workflow.service";
import { OperatorDashboardController } from "./operator-dashboard.controller";
import { OperatorDashboardService } from "./operator-dashboard.service";
import { OperatorOrganizationsController } from "./operator-organizations.controller";
import { OperatorOrganizationsService } from "./operator-organizations.service";

@Module({ imports: [AccessControlModule, CommerceModule], controllers: [OperatorTechnicalController, OperatorAuditController, OperatorDocumentExceptionsController, OperatorOrdersController, OperationsController, OperatorDashboardController, OperatorOrganizationsController], providers: [OperatorTechnicalService, OperatorAuditService, OperatorDocumentExceptionsService, OperatorOrdersService, OperationsService, OperationQueueService, OperationWorkflowService, OperatorDashboardService, OperatorOrganizationsService] })
export class OperationsModule {}
