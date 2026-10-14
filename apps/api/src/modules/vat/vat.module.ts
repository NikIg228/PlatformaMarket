import { Module } from "@nestjs/common";
import { AccessControlModule } from "../access-control/access-control.module";
import { SupplierVatController } from "./supplier-vat.controller";
import { SupplierVatService } from "./supplier-vat.service";
@Module({ imports: [AccessControlModule], controllers: [SupplierVatController], providers: [SupplierVatService] })
export class VatModule {}
