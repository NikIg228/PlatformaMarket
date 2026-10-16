import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { discrepancySourceSchema, discrepancyStatementSchema, orderDiscrepanciesResponseSchema,
  type DiscrepancySource, type DiscrepancyStatement, type OrderDiscrepancyCommand, type OrderDiscrepancyResult } from "@marketplace/schemas";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { FileUploadPolicyService } from "../../platform/security/file-upload-policy.service";
import { ObjectStorageService } from "../../platform/storage/object-storage.service";
import { AccessControlService } from "../access-control/access-control.service";
import type { SupplierActorContext } from "../suppliers/supplier-access.service";
import { discrepancyEligibleStatuses, discrepancyTransition, validateDiscrepancyStatement } from "./order-discrepancy.rules";
import { resupplyInclude, resupplyView } from "./order-resupply.rules";
import { dispatchResupply } from "./order-resupply";

const shipmentInclude = { ...resupplyInclude, items: { orderBy: { id: "asc" as const }, include: { supplierOrderItem: { include: {
  reservation: { include: { externalReservation: true } }, offer: { include: { packaging: true } }, productVariant: { include: { product: true, saleUnit: true } },
} } } } } satisfies Prisma.ShipmentInclude;
type Shipment = Prisma.ShipmentGetPayload<{ include: typeof shipmentInclude }>;
const json = (value: unknown) => value as Prisma.InputJsonValue;
const conflict = (message: string) => new ConflictException({ code: "ORDER_DISCREPANCY_CONFLICT", message });
const attachmentView = (asset: { id: string; originalName: string; detectedMime: string | null; sizeBytes: number }) => ({ id: asset.id, name: asset.originalName, mimeType: asset.detectedMime ?? "application/octet-stream", sizeBytes: asset.sizeBytes });
function sourceLines(shipment: Shipment): DiscrepancySource["lines"] {
  return shipment.items.map(line => ({ shipmentItemId: line.id, orderItemId: line.supplierOrderItemId,
    name: line.supplierOrderItem.productVariant.product.canonicalName, uom: line.supplierOrderItem.offer.packaging?.name ?? line.supplierOrderItem.productVariant.saleUnit?.nameRu ?? "",
    sentQuantity: line.quantity.toString(), recordedReceivedQuantity: line.deliveredQuantity.toString(),
    unitPriceMinor: line.supplierOrderItem.unitPriceMinor.toString(), taxSnapshot: line.supplierOrderItem.offerSnapshot,
    isGift: Boolean(line.supplierOrderItem.giftForItemId) }));
}

@Injectable()
export class OrderDiscrepancyService {
  constructor(private readonly prisma: PrismaService, private readonly access: AccessControlService,
    private readonly uploads: FileUploadPolicyService, private readonly storage: ObjectStorageService) {}

  private async visible(orderId: string, context: SupplierActorContext, write = false) {
    if (!context.actorId || !context.organizationId) throw new ForbiddenException("Требуется активная организация");
    if (!await this.access.hasAll(context.actorId, context.organizationId, ["order.create"]) &&
      !await this.access.hasAll(context.actorId, context.organizationId, ["order.confirm"])) throw new ForbiddenException("Недостаточно прав для просмотра заказа");
    const order = await this.prisma.supplierOrder.findFirst({ where: { id: orderId, OR: [{ buyerOrganizationId: context.organizationId }, { supplierOrganizationId: context.organizationId }] } });
    if (!order) throw new NotFoundException("Заказ не найден");
    const party = order.buyerOrganizationId === context.organizationId ? "BUYER" : "SUPPLIER";
    const canWrite = await this.access.hasAll(context.actorId, context.organizationId, [party === "BUYER" ? "order.approve" : "order.confirm"]);
    if (write && !canWrite) throw new ForbiddenException("Недостаточно прав для ответа по расхождению");
    return { order, party, canWrite } as const;
  }

  private documents(orderId: string, shipmentId: string, buyerId: string): Prisma.DocumentWhereInput {
    return { supplierOrderId: orderId, shipmentId, kind: "WAYBILL", immutableAt: { not: null },
      status: { in: ["GENERATED", "AWAITING_SIGNATURE", "PARTIALLY_SIGNED", "SIGNED"] },
      participants: { some: { organizationId: buyerId } } };
  }

  async list(orderId: string, context: SupplierActorContext) {
    const { party, canWrite } = await this.visible(orderId, context);
    return this.prisma.$transaction(async tx => {
      const order = await tx.supplierOrder.findUniqueOrThrow({ where: { id: orderId } });
      const shipments = await tx.shipment.findMany({ where: { supplierOrderId: orderId }, include: shipmentInclude, orderBy: { createdAt: "asc" } });
      const claims = await tx.orderDiscrepancy.findMany({ where: { supplierOrderId: orderId, ...(party === "SUPPLIER" ? { status: { not: "DRAFT" } } : {}) }, include: { events: { orderBy: { version: "asc" } } }, orderBy: { createdAt: "asc" } });
      const discrepancies = await Promise.all(claims.map(async claim => {
        const statement = discrepancyStatementSchema.parse(claim.statement);
        const assets = await tx.uploadAsset.findMany({ where: { id: { in: statement.attachmentIds }, organizationId: order.buyerOrganizationId, purpose: "ORDER_DISCREPANCY", status: "CLEAN", metadata: { path: ["orderId"], equals: orderId } } });
        return { id: claim.id, shipmentId: claim.shipmentId, version: claim.version, status: claim.status,
          previousDiscrepancyId: claim.previousDiscrepancyId, statement, source: claim.source, resolution: claim.resolution,
          createdAt: claim.createdAt.toISOString(), updatedAt: claim.updatedAt.toISOString(), attachments: assets.map(attachmentView),
          resupply: resupplyView(order, claim, shipments.find(shipment => shipment.id === claim.shipmentId)!),
          events: claim.events.filter(event => party === "BUYER" || !["CREATE", "SAVE"].includes(event.action)).map(event => ({
            id: event.id, version: event.version, action: event.action, actorId: event.actorId, organizationId: event.organizationId,
            createdAt: event.createdAt.toISOString(), details: event.details })) };
      }));
      return orderDiscrepanciesResponseSchema.parse({ orderId, orderVersion: order.version, party, canWrite, discrepancies,
        shipments: await Promise.all(shipments.map(async shipment => ({ id: shipment.id, version: shipment.version, number: shipment.shipmentNumber,
          eligible: discrepancyEligibleStatuses.includes(shipment.status), lines: sourceLines(shipment),
          documents: (await tx.document.findMany({ where: this.documents(orderId, shipment.id, order.buyerOrganizationId), orderBy: { version: "desc" } }))
            .map(doc => ({ id: doc.id, version: doc.version, checksum: doc.checksumSha256, title: doc.title })) }))) });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  private async assets(tx: Prisma.TransactionClient, orderId: string, buyerId: string, statement: DiscrepancyStatement) {
    const count = await tx.uploadAsset.count({ where: { id: { in: statement.attachmentIds }, organizationId: buyerId,
      purpose: "ORDER_DISCREPANCY", status: "CLEAN", metadata: { path: ["orderId"], equals: orderId } } });
    if (count !== statement.attachmentIds.length) throw conflict("Вложение недоступно или не прошло проверку");
  }

  async execute(orderId: string, input: OrderDiscrepancyCommand, context: SupplierActorContext): Promise<OrderDiscrepancyResult> {
    const { party } = await this.visible(orderId, context, true);
    if (["RESPOND", "DISPATCH_RESUPPLY"].includes(input.action) !== (party === "SUPPLIER")) throw new ForbiddenException("Действие недоступно этой стороне заказа");
    const requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "SupplierOrder" WHERE id = ${orderId}::uuid FOR UPDATE`;
      const order = await tx.supplierOrder.findUniqueOrThrow({ where: { id: orderId } });
      const replay = await tx.orderDiscrepancyEvent.findUnique({ where: { supplierOrderId_organizationId_idempotencyKey: { supplierOrderId: orderId, organizationId: context.organizationId, idempotencyKey: input.idempotencyKey } } });
      if (replay) {
        if (replay.actorId !== context.actorId || replay.requestHash !== requestHash) throw conflict("Ключ повтора уже использован для другого запроса");
        return replay.result as unknown as OrderDiscrepancyResult;
      }
      const current = input.action === "CREATE" ? null : await tx.orderDiscrepancy.findFirst({ where: { id: input.discrepancyId, supplierOrderId: orderId, ...(party === "SUPPLIER" ? { status: { not: "DRAFT" } } : {}) } });
      if (input.action !== "CREATE" && !current) throw new NotFoundException("Заявление не найдено");
      const shipment = await tx.shipment.findFirst({ where: { id: input.action === "CREATE" ? input.shipmentId : current!.shipmentId, supplierOrderId: orderId }, include: shipmentInclude });
      if (!shipment) throw new NotFoundException("Отправление не найдено");
      if (order.version !== input.expectedOrderVersion || shipment.version !== input.expectedShipmentVersion ||
        input.action !== "CREATE" && current!.version !== input.expectedExceptionVersion) throw conflict("Данные изменились. Обновите и сравните их перед повторной отправкой");
      let statement: DiscrepancyStatement, source: DiscrepancySource;
      if (input.action === "CREATE") {
        if (!discrepancyEligibleStatuses.includes(shipment.status)) throw conflict("Заявление доступно после отправки партии");
        if (input.previousDiscrepancyId && !await tx.orderDiscrepancy.findFirst({ where: { id: input.previousDiscrepancyId, supplierOrderId: orderId, shipmentId: shipment.id, status: "REJECTED" } })) throw conflict("Нет отклонённого заявления этой партии для новой редакции");
        if (input.sourceReceiptEventId) {
          const event = await tx.orderWorkflowEvent.findFirst({ where: { id: input.sourceReceiptEventId, supplierOrderId: orderId, action: "RECEIVE_SHIPMENT" } });
          if (!event || (event.details as { shipmentId?: string }).shipmentId !== shipment.id) throw conflict("Событие получения не относится к этой партии");
        }
        const doc = input.sourceDocumentId ? await tx.document.findFirst({ where: { ...this.documents(orderId, shipment.id, order.buyerOrganizationId), id: input.sourceDocumentId } }) : null;
        if (input.sourceDocumentId && (!doc || doc.version !== input.sourceDocumentVersion || doc.checksumSha256 !== input.sourceDocumentChecksum) ||
          !input.sourceDocumentId && (input.sourceDocumentVersion !== null || input.sourceDocumentChecksum !== null)) throw conflict("Версия исходной накладной недоступна или изменилась");
        source = discrepancySourceSchema.parse({ orderVersion: order.version, shipmentVersion: shipment.version, shipmentNumber: shipment.shipmentNumber,
          documentId: doc?.id ?? null, documentVersion: doc?.version ?? null, documentChecksum: doc?.checksumSha256 ?? null,
          documentSnapshot: doc?.dataSnapshot ?? null, lines: sourceLines(shipment), sourceReceiptEventId: input.sourceReceiptEventId });
        statement = input.statement;
      } else {
        source = discrepancySourceSchema.parse(current!.source);
        statement = input.action === "SAVE" ? input.statement : discrepancyStatementSchema.parse(current!.statement);
      }
      validateDiscrepancyStatement(statement, source);
      await this.assets(tx, orderId, order.buyerOrganizationId, statement);
      if (input.action === "SUBMIT") {
        if (source.shipmentVersion !== shipment.version || JSON.stringify(source.lines) !== JSON.stringify(sourceLines(shipment)))
          throw conflict("Исходная партия изменилась после создания черновика. Создайте заявление по актуальным данным");
        if (source.documentId && !await tx.document.findFirst({ where: { ...this.documents(orderId, shipment.id, order.buyerOrganizationId), id: source.documentId, version: source.documentVersion!, checksumSha256: source.documentChecksum } }))
          throw conflict("Исходная накладная изменилась. Создайте новый черновик");
      }
      const resupply = input.action === "DISPATCH_RESUPPLY" ? await dispatchResupply(tx, order, current!, shipment, input, context) : null;
      const transition = input.action === "CREATE" ? { status: "DRAFT" as const } : resupply ? { status: "AGREED" as const } : discrepancyTransition(current!.status, statement, input);
      const claim = input.action === "CREATE" ? await tx.orderDiscrepancy.create({ data: { supplierOrderId: orderId, shipmentId: shipment.id,
        previousDiscrepancyId: input.previousDiscrepancyId, statement: json(statement), source: json(source) } })
        : await tx.orderDiscrepancy.update({ where: { id: current!.id }, data: { statement: json(statement), ...transition, version: { increment: 1 } } });
      const result: OrderDiscrepancyResult = { orderId, discrepancyId: claim.id, version: claim.version, status: transition.status, eventId: randomUUID() };
      const details = resupply ?? (input.action === "SUBMIT" ? { statement, source } : input.action === "RESPOND" ? { decision: input.decision, reason: input.reason, resolution: input.resolution } : input.action === "DECIDE" ? { accepted: input.accepted, reason: input.reason } : { statement });
      await tx.orderDiscrepancyEvent.create({ data: { id: result.eventId, supplierOrderId: orderId, discrepancyId: claim.id, ...context,
        version: claim.version, action: input.action, idempotencyKey: input.idempotencyKey, requestHash, details: json(details), result: json(result) } });
      await tx.auditLog.create({ data: { ...context, action: `order.discrepancy.${input.action.toLowerCase()}`, entityType: "OrderDiscrepancy", entityId: claim.id, after: json(result) } });
      if (!["CREATE", "SAVE"].includes(input.action)) await tx.outboxEvent.create({ data: { aggregateType: "SupplierOrder", aggregateId: orderId,
        eventType: "OrderDiscrepancyChanged", payload: { ...result, action: input.action, buyerOrganizationId: order.buyerOrganizationId, supplierOrganizationId: order.supplierOrganizationId } } });
      return result;
    }, { timeout: 15000 });
  }

  async upload(orderId: string, input: { fileName: string; contentBase64: string }, context: SupplierActorContext) {
    const { party } = await this.visible(orderId, context, true);
    if (party !== "BUYER") throw new ForbiddenException("Доказательства заявления загружает клиника");
    const asset = await this.uploads.quarantine({ ...context, purpose: "ORDER_DISCREPANCY", fileName: input.fileName,
      body: this.uploads.decodeBase64(input.contentBase64, 5 * 1024 * 1024), allowedKinds: ["PDF", "PNG", "JPEG"], maxBytes: 5 * 1024 * 1024 });
    try {
      await this.prisma.uploadAsset.update({ where: { id: asset.id }, data: { metadata: { orderId } } });
      return attachmentView(asset);
    } catch (error) { await this.uploads.release(asset.id); throw error; }
  }

  async download(orderId: string, discrepancyId: string, assetId: string, context: SupplierActorContext) {
    const { order, party } = await this.visible(orderId, context);
    const claim = await this.prisma.orderDiscrepancy.findFirst({ where: { id: discrepancyId, supplierOrderId: orderId, ...(party === "SUPPLIER" ? { status: { not: "DRAFT" } } : {}) } });
    if (!claim || !discrepancyStatementSchema.parse(claim.statement).attachmentIds.includes(assetId)) throw new NotFoundException("Вложение не найдено");
    const asset = await this.prisma.uploadAsset.findFirst({ where: { id: assetId, organizationId: order.buyerOrganizationId, purpose: "ORDER_DISCREPANCY", status: "CLEAN", metadata: { path: ["orderId"], equals: orderId } } });
    if (!asset) throw new NotFoundException("Вложение недоступно");
    const body = await this.storage.get(asset.storageKey);
    if (createHash("sha256").update(body).digest("hex") !== asset.checksumSha256) throw conflict("Проверка целостности вложения не пройдена");
    return { fileName: asset.originalName, mimeType: asset.detectedMime ?? "application/octet-stream", contentBase64: body.toString("base64") };
  }
}
