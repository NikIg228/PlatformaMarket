import { Module } from "@nestjs/common";
import { SuppliersModule } from "../suppliers/suppliers.module";
import { LogisticsController } from "./logistics.controller";
import { LogisticsService } from "./logistics.service";
import { CdekSandboxAdapter } from "./cdek-sandbox.adapter";
import { CdekSandboxController } from "./cdek-sandbox.controller";

@Module({ imports: [SuppliersModule], controllers: [LogisticsController, CdekSandboxController], providers: [LogisticsService, CdekSandboxAdapter], exports: [LogisticsService] })
export class LogisticsModule {}
