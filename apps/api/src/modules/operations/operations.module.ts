import { Module } from "@nestjs/common";
import { AccessControlModule } from "../access-control/access-control.module";
import { OperationsController } from "./operations.controller";
import { OperationsService } from "./operations.service";
import { OperationWorkflowService } from "./operation-workflow.service";
import { OperatorDashboardController } from "./operator-dashboard.controller";
import { OperatorDashboardService } from "./operator-dashboard.service";
import { OperatorOrganizationsController } from "./operator-organizations.controller";
import { OperatorOrganizationsService } from "./operator-organizations.service";

@Module({ imports: [AccessControlModule], controllers: [OperationsController, OperatorDashboardController, OperatorOrganizationsController], providers: [OperationsService, OperationWorkflowService, OperatorDashboardService, OperatorOrganizationsService] })
export class OperationsModule {}
