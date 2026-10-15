import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { orderInvoiceSnapshotSchema, type OrderInvoiceView, type OrderInvoicesResponse, type PrepareOrderInvoiceInput } from "@marketplace/schemas";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { ObjectStorageService } from "../../platform/storage/object-storage.service";
import { AccessControlService } from "../access-control/access-control.service";
import type { SupplierActorContext } from "../suppliers/supplier-access.service";
import { requisitesDate } from "../organizations/organization-requisites.rules";
import { invoiceConflict, invoiceLifecycleIssue, invoiceLines, invoiceOrderInclude, invoiceRequisites, invoiceSnapshot, type InvoiceOrder } from "./order-invoice.rules";
import { InvoiceRendererService } from "./invoice-renderer.service";

type Prepared = Prisma.OrderInvoicePreparationGetPayload<{ include: { document: true } }>;
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

@Injectable()
export class OrderInvoiceService {
  constructor(private readonly prisma: PrismaService, private readonly access: AccessControlService,
    private readonly renderer: InvoiceRendererService, private readonly storage: ObjectStorageService) {}

  private async visible(orderId: string, context: SupplierActorContext, write: boolean) {
    if (!context.actorId || !context.organizationId) throw new ForbiddenException("Войдите в организацию");
    const permissions = write ? ["order.confirm", "document.issue"] : ["order.confirm"];
    if (!await this.access.hasAll(context.actorId, context.organizationId, permissions)
      && (write || !await this.access.hasAll(context.actorId, context.organizationId, ["order.create"]))) throw new ForbiddenException("Недостаточно прав для работы со счётом");
    const order = await this.prisma.supplierOrder.findFirst({ where: { id: orderId,
      ...(write ? { supplierOrganizationId: context.organizationId } : { OR: [{ supplierOrganizationId: context.organizationId }, { buyerOrganizationId: context.organizationId }] }) }, select: { id: true } });
    if (!order) throw new NotFoundException("Заказ не найден");
  }

  private view(row: Prepared): OrderInvoiceView {
    return { documentId: row.documentId, number: row.number, version: row.version,
      status: row.confirmedAt ? row.document.status === "SUPERSEDED" ? "SUPERSEDED" : "CONFIRMED"
        : row.document.status === "FAILED" ? "FAILED" : row.document.status === "GENERATING" ? "GENERATING" : "PREVIEW",
      checksum: row.document.checksumSha256, snapshot: orderInvoiceSnapshotSchema.parse(row.document.dataSnapshot),
      confirmedAt: row.confirmedAt?.toISOString() ?? null, confirmedByName: row.confirmedByName };
  }

  private async inputs(db: Prisma.TransactionClient, order: InvoiceOrder) {
    const supplier = await invoiceRequisites(db, order.supplierOrganizationId, "SUPPLIER");
    const buyer = await invoiceRequisites(db, order.buyerOrganizationId, "BUYER");
    const lifecycle = invoiceLifecycleIssue(order);
    const issues = [...supplier.issues, ...buyer.issues, ...invoiceLines(order).issues,
      ...(lifecycle ? [{ party: "ORDER" as const, code: "LIFECYCLE", message: lifecycle }] : [])];
    return { supplier: supplier.current, buyer: buyer.current, issues };
  }

  async list(orderId: string, context: SupplierActorContext): Promise<OrderInvoicesResponse> {
    await this.visible(orderId, context, false);
    return this.prisma.$transaction(async tx => {
      const order = await tx.supplierOrder.findUniqueOrThrow({ where: { id: orderId }, include: invoiceOrderInclude });
      const supplier = order.supplierOrganizationId === context.organizationId;
      const canPrepare = supplier && await this.access.hasAll(context.actorId, context.organizationId, ["order.confirm", "document.issue"]);
      const issues = canPrepare ? (await this.inputs(tx, order)).issues : [];
      const rows = await tx.orderInvoicePreparation.findMany({ where: { supplierOrderId: orderId, ...(supplier ? {} : { confirmedAt: { not: null } }) },
        include: { document: true }, orderBy: { version: "desc" } });
      return { orderId, orderVersion: order.version, currentDocumentId: order.manualInvoiceDocumentId, canPrepare: canPrepare && issues.length === 0, issues, invoices: rows.map(row => this.view(row)) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  private async lockRequisites(tx: Prisma.TransactionClient, order: Pick<InvoiceOrder, "supplierOrganizationId" | "buyerOrganizationId">) {
    const ids = [order.supplierOrganizationId, order.buyerOrganizationId].sort();
    // Profile writers increment Organization.version; requisites writers update the head.
    for (const id of ids) {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${id}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT "organizationId" FROM "OrganizationRequisites" WHERE "organizationId" = ${id}::uuid FOR UPDATE`;
    }
  }

  async prepare(orderId: string, input: PrepareOrderInvoiceInput, context: SupplierActorContext): Promise<OrderInvoiceView> {
    await this.visible(orderId, context, true);
    const requestHash = hash(JSON.stringify({ ...input, actorId: context.actorId, organizationId: context.organizationId }));
    const documentId = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "SupplierOrder" WHERE id = ${orderId}::uuid FOR UPDATE`;
      const replay = await tx.orderInvoicePreparation.findUnique({ where: { supplierOrderId_idempotencyKey: { supplierOrderId: orderId, idempotencyKey: input.idempotencyKey } } });
      if (replay) {
        if (replay.requestHash !== requestHash || replay.actorId !== context.actorId) throw invoiceConflict("Ключ повтора принадлежит другому запросу");
        return replay.documentId;
      }
      const order = await tx.supplierOrder.findUniqueOrThrow({ where: { id: orderId }, include: invoiceOrderInclude });
      if (order.version !== input.expectedVersion) throw invoiceConflict("Заказ изменился. Проверьте состав перед формированием счёта");
      await this.lockRequisites(tx, order);
      const data = await this.inputs(tx, order);
      if (data.issues.length || !data.supplier || !data.buyer) throw invoiceConflict("Для счёта нужны подтверждённые реквизиты и согласованный заказ", data.issues);
      const latest = await tx.orderInvoicePreparation.findFirst({ where: { supplierOrderId: orderId }, orderBy: { version: "desc" } });
      let number = latest?.number;
      if (!number) {
        const year = Number(requisitesDate().slice(0, 4));
        const counter = await tx.invoiceNumberCounter.upsert({ where: { year }, create: { year, value: 1n }, update: { value: { increment: 1n } } });
        number = `PM-INV-${year}-${counter.value.toString().padStart(8, "0")}`;
      }
      const version = (latest?.version ?? 0) + 1;
      const snapshot = invoiceSnapshot(order, data.supplier, data.buyer, number, version, input.bankAccountId);
      const document = await tx.document.create({ data: {
        ownerOrganizationId: context.organizationId, supplierOrderId: orderId, checkoutId: order.checkoutId,
        kind: "INVOICE", category: "PAYMENT", source: "GENERATED", format: "PDF", status: "GENERATING",
        accountingStatus: "PENDING_REVIEW", title: `Счёт на оплату ${number}`, documentNumber: number, version,
        previousVersionId: latest?.documentId, amountMinor: order.subtotalAmountMinor, currency: order.currency,
        dataSnapshot: snapshot as unknown as Prisma.InputJsonValue, templateSnapshot: { code: snapshot.templateVersion },
        metadata: { purpose: "ORDER_INVOICE_PREVIEW" }, requiredSignatureCount: 0,
        participants: { create: [{ organizationId: order.supplierOrganizationId, role: "OWNER" }, { organizationId: order.buyerOrganizationId, role: "RECIPIENT" }] },
      } });
      await tx.orderInvoicePreparation.create({ data: { documentId: document.id, supplierOrderId: orderId, idempotencyKey: input.idempotencyKey, requestHash, actorId: context.actorId, number, version } });
      await tx.auditLog.create({ data: { ...context, action: "order.invoice.prepared", entityType: "Document", entityId: document.id, after: { orderId, number, version } } });
      return document.id;
    }, { timeout: 15000 });
    // Reservation survives a failed renderer/upload. Retry resumes this exact version.
    try {
      return await this.prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "Document" WHERE id = ${documentId}::uuid FOR UPDATE`;
        const row = await tx.orderInvoicePreparation.findUniqueOrThrow({ where: { documentId }, include: { document: true } });
        if (row.confirmedAt || row.document.status === "DRAFT") return this.view(row);
        const snapshot = orderInvoiceSnapshotSchema.parse(row.document.dataSnapshot);
        const body = await this.renderer.render(snapshot);
        const checksum = hash(body), key = `documents/${context.organizationId}/${documentId}/preview-${checksum}.pdf`;
        await this.storage.put(key, body, "application/pdf");
        const document = await tx.document.update({ where: { id: documentId }, data: { status: "DRAFT", storageKey: key, fileName: `${row.number}-R${row.version}-preview.pdf`,
          contentType: "application/pdf", byteSize: body.length, checksumSha256: checksum, generatedAt: new Date(), failureReason: null } });
        return this.view({ ...row, document });
      }, { timeout: 15000 });
    } catch (error) {
      await this.prisma.document.updateMany({ where: { id: documentId, status: { in: ["GENERATING", "FAILED"] }, immutableAt: null }, data: { status: "FAILED", failureReason: "Не удалось сформировать файл. Повторите запрос." } });
      throw error;
    }
  }

  /** Called under the workflow's order lock; file commit and workflow event share one transaction. */
  async confirm(tx: Prisma.TransactionClient, orderId: string, documentId: string, previewChecksum: string | undefined, context: SupplierActorContext) {
    if (!await this.access.hasAll(context.actorId, context.organizationId, ["order.confirm", "document.issue"])) throw new ForbiddenException("Недостаточно прав для выставления счёта");
    const order = await tx.supplierOrder.findUniqueOrThrow({ where: { id: orderId }, include: invoiceOrderInclude });
    if (order.supplierOrganizationId !== context.organizationId) throw new ForbiddenException("Подтверждение доступно только поставщику заказа");
    await tx.$queryRaw`SELECT id FROM "Document" WHERE id = ${documentId}::uuid FOR UPDATE`;
    const row = await tx.orderInvoicePreparation.findFirst({ where: { documentId, supplierOrderId: orderId }, include: { document: true } });
    if (!row || row.confirmedAt || row.document.status !== "DRAFT" || row.document.ownerOrganizationId !== context.organizationId
      || !previewChecksum || row.document.checksumSha256 !== previewChecksum) throw invoiceConflict("Откройте актуальный предпросмотр перед подтверждением");
    await this.lockRequisites(tx, order);
    const data = await this.inputs(tx, order);
    if (data.issues.length || !data.supplier || !data.buyer) throw invoiceConflict("Данные счёта требуют проверки", data.issues);
    const saved = orderInvoiceSnapshotSchema.parse(row.document.dataSnapshot);
    const current = invoiceSnapshot(order, data.supplier, data.buyer, row.number, row.version, saved.bankAccount.id);
    if (JSON.stringify(saved) !== JSON.stringify(current)) throw invoiceConflict("Заказ или реквизиты изменились. Сформируйте новый предпросмотр");
    const preview = await this.storage.get(row.document.storageKey!);
    if (hash(preview) !== previewChecksum) throw invoiceConflict("Файл предпросмотра повреждён. Сформируйте новую версию");
    const actor = await tx.user.findUniqueOrThrow({ where: { id: context.actorId }, select: { displayName: true } });
    const now = new Date(), body = await this.renderer.render(saved, { name: actor.displayName, at: now });
    const checksum = hash(body), key = `documents/${context.organizationId}/${documentId}/confirmed-${checksum}.pdf`;
    await this.storage.put(key, body, "application/pdf");
    await tx.orderInvoicePreparation.update({ where: { documentId }, data: { confirmedAt: now, confirmedById: context.actorId, confirmedByName: actor.displayName } });
    const document = await tx.document.update({ where: { id: documentId }, data: { status: "GENERATED", storageKey: key, fileName: `${row.number}-R${row.version}.pdf`,
      checksumSha256: checksum, byteSize: body.length, immutableAt: now, generatedAt: now, metadata: { purpose: "ORDER_INVOICE_CONFIRMED", previewChecksum, confirmedAt: now.toISOString(), confirmedById: context.actorId } } });
    if (order.manualInvoiceDocumentId && order.manualInvoiceDocumentId !== documentId) {
      await tx.document.updateMany({ where: { id: order.manualInvoiceDocumentId, supplierOrderId: orderId, kind: "INVOICE", ownerOrganizationId: context.organizationId }, data: { status: "SUPERSEDED" } });
    }
    return document;
  }
}
