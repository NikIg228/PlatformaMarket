import { Module } from "@nestjs/common";
import { DocumentRendererService } from "./document-renderer.service";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";
import { SignatureAdapterRegistry } from "./signature-adapter-registry.service";
import { OrderDocumentsController } from "./order-documents.controller";
import { OrderInvoiceController } from "./order-invoice.controller";
import { OrderInvoiceService } from "./order-invoice.service";
import { InvoiceRendererService } from "./invoice-renderer.service";
import { ShipmentWaybillController } from "./shipment-waybill.controller";
import { ShipmentWaybillService } from "./shipment-waybill.service";
import { WaybillRendererService } from "./waybill-renderer.service";

@Module({ controllers: [DocumentsController, OrderDocumentsController, OrderInvoiceController, ShipmentWaybillController], providers: [DocumentsService, DocumentRendererService, SignatureAdapterRegistry, OrderInvoiceService, InvoiceRendererService, ShipmentWaybillService, WaybillRendererService], exports: [DocumentsService, OrderInvoiceService] })
export class DocumentsModule {}
