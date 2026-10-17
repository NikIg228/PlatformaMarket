import { Module } from "@nestjs/common";
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

@Module({ imports: [AccessControlModule, CommerceModule], controllers: [OperatorDocumentExceptionsController, OperatorOrdersController, OperationsController, OperatorDashboardController, OperatorOrganizationsController], providers: [OperatorDocumentExceptionsService, OperatorOrdersService, OperationsService, OperationQueueService, OperationWorkflowService, OperatorDashboardService, OperatorOrganizationsService] })
export class OperationsModule {}
