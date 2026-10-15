import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type Document } from "@prisma/client";
import { createHash } from "node:crypto";
import { shipmentWaybillSnapshotSchema, type PrepareShipmentWaybillInput, type ShipmentWaybillSnapshot, type ShipmentWaybillView, type ShipmentWaybillsResponse } from "@marketplace/schemas";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { ObjectStorageService } from "../../platform/storage/object-storage.service";
import { AccessControlService } from "../access-control/access-control.service";
import type { SupplierActorContext } from "../suppliers/supplier-access.service";
import { invoiceRequisites } from "./order-invoice.rules";
import { WAYBILL_PREVIEW, waybillConflict, waybillIssues, waybillLines, waybillShipmentInclude, waybillSnapshot, type WaybillShipment } from "./shipment-waybill.rules";
import { WaybillRendererService } from "./waybill-renderer.service";

const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
@Injectable()
export class ShipmentWaybillService {
  constructor(private readonly prisma: PrismaService, private readonly access: AccessControlService,
    private readonly renderer: WaybillRendererService, private readonly storage: ObjectStorageService) {}

  private async visible(orderId: string, shipmentId: string, context: SupplierActorContext) {
    if (!context.actorId || !context.organizationId || !await this.access.hasAll(context.actorId, context.organizationId, ["shipment.manage", "document.issue"])) throw new ForbiddenException("Недостаточно прав для подготовки накладной");
    const shipment = await this.prisma.shipment.findFirst({ where: { id: shipmentId, supplierOrderId: orderId, supplierOrder: { supplierOrganizationId: context.organizationId } }, select: { id: true } });
    if (!shipment) throw new NotFoundException("Партия не найдена");
  }

  private async inputs(tx: Prisma.TransactionClient, shipment: WaybillShipment) {
    const order = shipment.supplierOrder;
    const supplier = await invoiceRequisites(tx, order.supplierOrganizationId, "SUPPLIER");
    const buyer = await invoiceRequisites(tx, order.buyerOrganizationId, "BUYER");
    // Bank details are a payment prerequisite, not a prerequisite for a goods waybill.
    const issues = [...supplier.issues, ...buyer.issues].filter(issue => issue.code !== "BANK_ACCOUNT_REQUIRED").map(issue => issue.message);
    issues.push(...waybillIssues(shipment));
    try { waybillLines(shipment); } catch (error) { if (error instanceof Error) issues.push(error.message); else throw error; }
    return { supplier: supplier.current, buyer: buyer.current, issues };
  }

  private async lock(tx: Prisma.TransactionClient, orderId: string, shipmentId: string, context: SupplierActorContext) {
    // Same first lock as logistics transitions, so quantities/status cannot change during preparation.
    await tx.$queryRaw`SELECT id FROM "SupplierOrder" WHERE id = ${orderId}::uuid FOR UPDATE`;
    const shipment = await tx.shipment.findFirst({ where: { id: shipmentId, supplierOrderId: orderId, supplierOrder: { supplierOrganizationId: context.organizationId } }, include: waybillShipmentInclude });
    if (!shipment) throw new NotFoundException("Партия не найдена");
    for (const id of [shipment.supplierOrder.supplierOrganizationId, shipment.supplierOrder.buyerOrganizationId].sort()) {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${id}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT "organizationId" FROM "OrganizationRequisites" WHERE "organizationId" = ${id}::uuid FOR UPDATE`;
    }
    return shipment;
  }

  private matches(saved: ShipmentWaybillSnapshot, shipment: WaybillShipment, data: Awaited<ReturnType<ShipmentWaybillService["inputs"]>>) {
    if (data.issues.length || !data.supplier || !data.buyer) return false;
    return JSON.stringify(saved) === JSON.stringify(waybillSnapshot(shipment, data.supplier, data.buyer, saved.version, saved.preparedBy, saved.date));
  }

  private view(document: Document, current: boolean): ShipmentWaybillView {
    return { documentId: document.id, number: document.documentNumber, version: document.version,
      status: !current ? "STALE" : document.status === "FAILED" ? "FAILED" : document.status === "GENERATING" ? "GENERATING" : "PREVIEW",
      checksum: document.checksumSha256, snapshot: shipmentWaybillSnapshotSchema.parse(document.dataSnapshot) };
  }

  async list(orderId: string, shipmentId: string, context: SupplierActorContext): Promise<ShipmentWaybillsResponse> {
    await this.visible(orderId, shipmentId, context);
    return this.prisma.$transaction(async tx => {
      const shipment = await tx.shipment.findFirstOrThrow({ where: { id: shipmentId, supplierOrderId: orderId, supplierOrder: { supplierOrganizationId: context.organizationId } }, include: waybillShipmentInclude });
      const data = await this.inputs(tx, shipment);
      const documents = await tx.document.findMany({ where: { shipmentId, supplierOrderId: orderId, ownerOrganizationId: context.organizationId, kind: "WAYBILL", externalId: { startsWith: WAYBILL_PREVIEW } }, orderBy: { version: "desc" } });
      const deliveryDocuments = await tx.document.findMany({ where: { shipmentId, supplierOrderId: orderId, checkoutId: shipment.supplierOrder.checkoutId,
        ownerOrganizationId: context.organizationId, kind: "ACCOMPANYING_DOCUMENT", status: { notIn: ["FAILED", "SUPERSEDED", "ARCHIVED"] } }, select: { id: true, title: true, status: true } });
      return { orderId, shipmentId, orderVersion: shipment.supplierOrder.version, shipmentVersion: shipment.version,
        canPrepare: data.issues.length === 0, issues: data.issues, deliveryDocuments,
        waybills: documents.map(document => this.view(document, this.matches(shipmentWaybillSnapshotSchema.parse(document.dataSnapshot), shipment, data))) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async prepare(orderId: string, shipmentId: string, input: PrepareShipmentWaybillInput, context: SupplierActorContext): Promise<ShipmentWaybillView> {
    await this.visible(orderId, shipmentId, context);
    const requestHash = hash(JSON.stringify({ ...input, ...context }));
    const externalId = WAYBILL_PREVIEW + hash(input.idempotencyKey);
    const documentId = await this.prisma.$transaction(async tx => {
      const shipment = await this.lock(tx, orderId, shipmentId, context);
      const replay = await tx.document.findFirst({ where: { shipmentId, ownerOrganizationId: context.organizationId, externalId } });
      if (replay) {
        if ((replay.metadata as { requestHash?: string } | null)?.requestHash !== requestHash) throw waybillConflict("Ключ повтора принадлежит другому запросу");
        return replay.id;
      }
      if (shipment.version !== input.expectedShipmentVersion || shipment.supplierOrder.version !== input.expectedOrderVersion) throw waybillConflict("Заказ или партия изменились. Обновите данные и проверьте состав");
      const data = await this.inputs(tx, shipment);
      if (data.issues.length || !data.supplier || !data.buyer) throw waybillConflict(data.issues.join(". "));
      const number = `WB-${shipment.shipmentNumber}`;
      const previous = await tx.document.findFirst({ where: { ownerOrganizationId: context.organizationId, documentNumber: number }, orderBy: { version: "desc" } });
      if (previous && (previous.shipmentId !== shipmentId || previous.supplierOrderId !== orderId || previous.kind !== "WAYBILL")) throw waybillConflict("Номер документа уже связан с другой партией");
      if (previous?.immutableAt || previous && !previous.externalId?.startsWith(WAYBILL_PREVIEW)) throw waybillConflict("Для выпущенной накладной требуется отдельный процесс исправления");
      const actor = await tx.user.findUniqueOrThrow({ where: { id: context.actorId }, select: { displayName: true } });
      const snapshot = waybillSnapshot(shipment, data.supplier, data.buyer, (previous?.version ?? 0) + 1, { id: context.actorId, name: actor.displayName });
      const document = await tx.document.create({ data: { ownerOrganizationId: context.organizationId, supplierOrderId: orderId,
        checkoutId: shipment.supplierOrder.checkoutId, shipmentId, kind: "WAYBILL", category: "SHIPMENT", source: "GENERATED", format: "PDF", status: "GENERATING",
        title: `Предпросмотр накладной ${number}`, documentNumber: number, version: snapshot.version, previousVersionId: previous?.id,
        amountMinor: snapshot.totalMinor, currency: snapshot.currency, requiredSignatureCount: 2,
        dataSnapshot: snapshot as unknown as Prisma.InputJsonValue, templateSnapshot: { code: snapshot.templateVersion }, externalId,
        metadata: { purpose: "SHIPMENT_WAYBILL_PREVIEW", requestHash },
        participants: { create: [{ organizationId: context.organizationId, role: "OWNER" }] } } });
      await tx.auditLog.create({ data: { ...context, action: "shipment.waybill.prepared", entityType: "Document", entityId: document.id, after: { orderId, shipmentId, version: snapshot.version } } });
      return document.id;
    }, { timeout: 15000 });
    try {
      return await this.prisma.$transaction(async tx => {
        const shipment = await this.lock(tx, orderId, shipmentId, context);
        await tx.$queryRaw`SELECT id FROM "Document" WHERE id = ${documentId}::uuid FOR UPDATE`;
        const document = await tx.document.findUniqueOrThrow({ where: { id: documentId } });
        const saved = shipmentWaybillSnapshotSchema.parse(document.dataSnapshot), data = await this.inputs(tx, shipment);
        if (!this.matches(saved, shipment, data)) throw waybillConflict("Данные накладной устарели. Сформируйте новую версию по актуальной партии");
        if (document.status === "DRAFT") return this.view(document, true);
        const body = await this.renderer.render(saved), checksum = hash(body);
        const key = `documents/${context.organizationId}/${documentId}/preview-${checksum}.pdf`;
        await this.storage.put(key, body, "application/pdf");
        const updated = await tx.document.update({ where: { id: documentId }, data: { status: "DRAFT", storageKey: key,
          fileName: `${saved.number}-R${saved.version}-preview.pdf`, contentType: "application/pdf", byteSize: body.length,
          checksumSha256: checksum, generatedAt: new Date(), failureReason: null } });
        return this.view(updated, true);
      }, { timeout: 15000 });
    } catch (error) {
      await this.prisma.document.updateMany({ where: { id: documentId, status: { in: ["GENERATING", "FAILED"] }, immutableAt: null }, data: { status: "FAILED", failureReason: "Не удалось сформировать предпросмотр. Проверьте актуальность партии и повторите запрос." } });
      throw error;
    }
  }
}
