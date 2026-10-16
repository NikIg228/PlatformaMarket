import { ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma, type Document } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { resupplyDocumentSnapshotSchema, type PrepareResupplyDocumentInput, type ResupplyDocumentView, type ResupplyDocumentsResponse } from "@marketplace/schemas";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { ObjectStorageService } from "../../platform/storage/object-storage.service";
import { AccessControlService } from "../access-control/access-control.service";
import type { SupplierActorContext } from "../suppliers/supplier-access.service";
import { DocumentRendererService } from "./document-renderer.service";
import { RESUPPLY_PREVIEW, resupplyDocumentConflict, resupplyDocumentInclude, resupplyDocumentIssues, resupplyDocumentSnapshot, resupplyDocumentText, resupplyPreviewCurrent, type ResupplyDocumentClaim } from "./resupply-document.rules";

const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
@Injectable()
export class ResupplyDocumentService {
  private readonly logger = new Logger(ResupplyDocumentService.name);
  constructor(private readonly prisma: PrismaService, private readonly access: AccessControlService,
    private readonly renderer: DocumentRendererService, private readonly storage: ObjectStorageService) {}

  private async visible(orderId: string, context: SupplierActorContext, write = false) {
    if (!context.actorId || !context.organizationId || !await this.access.hasAll(context.actorId, context.organizationId, [write ? "document.issue" : "document.view"]))
      throw new ForbiddenException("Недостаточно прав для документов заказа");
    const order = await this.prisma.supplierOrder.findFirst({ where: { id: orderId,
      OR: [{ supplierOrganizationId: context.organizationId }, { buyerOrganizationId: context.organizationId }] } });
    if (!order) throw new NotFoundException("Заказ не найден");
    const party = order.supplierOrganizationId === context.organizationId ? "SUPPLIER" as const : "BUYER" as const;
    if (write && party !== "SUPPLIER") throw new ForbiddenException("Черновики подготавливает поставщик");
    return { party, canWrite: party === "SUPPLIER" && await this.access.hasAll(context.actorId, context.organizationId, ["document.issue"]) };
  }

  private async claim(tx: Prisma.TransactionClient, orderId: string, claimId: string, organizationId: string) {
    const claim = await tx.orderDiscrepancy.findFirst({ where: { id: claimId, supplierOrderId: orderId, status: { not: "DRAFT" },
      supplierOrder: { OR: [{ supplierOrganizationId: organizationId }, { buyerOrganizationId: organizationId }] } }, include: resupplyDocumentInclude });
    if (!claim) throw new NotFoundException("Заявление не найдено");
    return claim;
  }
  private where(claim: ResupplyDocumentClaim): Prisma.DocumentWhereInput {
    return { supplierOrderId: claim.supplierOrderId, shipmentId: claim.shipmentId,
      ownerOrganizationId: claim.supplierOrder.supplierOrganizationId, kind: "OTHER",
      externalId: { startsWith: `${RESUPPLY_PREVIEW}${claim.id}:` } };
  }
  private view(document: Document, claim: ResupplyDocumentClaim): ResupplyDocumentView {
    const snapshot = resupplyDocumentSnapshotSchema.parse(document.dataSnapshot);
    return { documentId: document.id, version: document.version, checksum: document.checksumSha256!,
      status: resupplyPreviewCurrent(snapshot, claim) ? "PREVIEW" : "STALE", snapshot };
  }
  async list(orderId: string, claimId: string, context: SupplierActorContext): Promise<ResupplyDocumentsResponse> {
    const access = await this.visible(orderId, context);
    return this.prisma.$transaction(async tx => {
      const claim = await this.claim(tx, orderId, claimId, context.organizationId), facts = resupplyDocumentIssues(claim);
      const repeatedClaim = facts.replacement && await tx.orderDiscrepancy.count({ where: { shipmentId: facts.replacement.id, status: { not: "DRAFT" } } });
      const settlementIssues = [...facts.settlementIssues, ...(repeatedClaim ? ["По допоставке есть отдельное заявление. Требуется его урегулирование."] : [])];
      const documents = await tx.document.findMany({ where: this.where(claim), orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
      return { orderId, discrepancyId: claimId, party: access.party, orderVersion: claim.supplierOrder.version, shipmentVersion: claim.shipment.version,
        exceptionVersion: claim.version, resupplyVersion: facts.replacement?.version ?? null,
        canPrepare: access.canWrite && !facts.issues.length, canPrepareSettlement: access.canWrite && !facts.issues.length && !settlementIssues.length,
        issues: facts.issues, settlementIssues, documents: documents.map(document => this.view(document, claim)) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async prepare(orderId: string, claimId: string, input: PrepareResupplyDocumentInput, context: SupplierActorContext): Promise<ResupplyDocumentView> {
    await this.visible(orderId, context, true);
    const requestHash = hash(JSON.stringify({ ...input, ...context }));
    const externalId = `${RESUPPLY_PREVIEW}${claimId}:${hash(input.idempotencyKey)}`;
    let writtenKey: string | null = null;
    try {
      return await this.prisma.$transaction(async tx => {
        // All shipment/claim writers serialize on this same order lock.
        await tx.$queryRaw`SELECT id FROM "SupplierOrder" WHERE id = ${orderId}::uuid FOR UPDATE`;
        const claim = await this.claim(tx, orderId, claimId, context.organizationId);
        const replay = await tx.document.findFirst({ where: { ...this.where(claim), externalId } });
        if (replay) {
          if ((replay.metadata as { requestHash?: string } | null)?.requestHash !== requestHash) throw resupplyDocumentConflict("Ключ повтора принадлежит другому запросу");
          return this.view(replay, claim);
        }
        const extra = claim.shipment.resupplyShipment;
        if (claim.supplierOrder.version !== input.expectedOrderVersion || claim.shipment.version !== input.expectedShipmentVersion ||
            claim.version !== input.expectedExceptionVersion || extra?.version !== input.expectedResupplyVersion)
          throw resupplyDocumentConflict("Данные изменились. Сверьте партии и заявление перед повторной подготовкой");
        if (input.kind === "SETTLEMENT" && extra && await tx.orderDiscrepancy.count({ where: { shipmentId: extra.id, status: { not: "DRAFT" } } }))
          throw resupplyDocumentConflict("По допоставке есть отдельное заявление. Требуется его урегулирование");
        const number = `RD-${claim.id}-${input.kind}`;
        const previous = await tx.document.findFirst({ where: { ...this.where(claim), documentNumber: number }, orderBy: { version: "desc" } });
        const actor = await tx.user.findUniqueOrThrow({ where: { id: context.actorId }, select: { displayName: true } });
        const snapshot = resupplyDocumentSnapshot(claim, input.kind, (previous?.version ?? 0) + 1, { id: context.actorId, name: actor.displayName });
        if (snapshot.sourceDocumentId && !await tx.document.findFirst({ where: { id: snapshot.sourceDocumentId, supplierOrderId: orderId, shipmentId: claim.shipmentId,
          version: snapshot.sourceDocumentVersion!, checksumSha256: snapshot.sourceDocumentChecksum, immutableAt: { not: null } } }))
          throw resupplyDocumentConflict("Исходная накладная недоступна или её версия изменилась");
        const title = input.kind === "TRANSFER" ? "Рабочий черновик документа допоставки" : "Рабочий черновик урегулирования недостачи";
        const body = await this.renderer.render("PDF", title, "{{body}}", { body: resupplyDocumentText(snapshot) });
        const checksum = hash(body), id = randomUUID(), key = `documents/${context.organizationId}/${id}/draft-${checksum}.pdf`;
        await this.storage.put(key, body, "application/pdf"); writtenKey = key;
        const document = await tx.document.create({ data: { id, ownerOrganizationId: context.organizationId, supplierOrderId: orderId,
          checkoutId: claim.supplierOrder.checkoutId, shipmentId: claim.shipmentId, kind: "OTHER", category: "SHIPMENT", format: "PDF", source: "GENERATED", status: "DRAFT",
          title, documentNumber: number, version: snapshot.version, previousVersionId: previous?.id, requiredSignatureCount: 2,
          dataSnapshot: snapshot as unknown as Prisma.InputJsonValue, templateSnapshot: { code: snapshot.templateVersion },
          externalId, metadata: { purpose: "RESUPPLY_DOCUMENT_PREVIEW", discrepancyId: claim.id, requestHash },
          storageKey: key, fileName: `${number}-R${snapshot.version}-draft.pdf`, contentType: "application/pdf", byteSize: body.length, checksumSha256: checksum, generatedAt: new Date(),
          participants: { create: [{ organizationId: context.organizationId, role: "OWNER" }, { organizationId: claim.supplierOrder.buyerOrganizationId, role: "RECIPIENT" }] } } });
        await tx.auditLog.create({ data: { ...context, action: "resupply.document.prepared", entityType: "Document", entityId: id,
          after: { orderId, discrepancyId: claim.id, kind: input.kind, version: snapshot.version } } });
        await tx.outboxEvent.create({ data: { aggregateType: "Document", aggregateId: id, eventType: "ResupplyDocumentDraftPrepared",
          payload: { documentId: id, orderId, discrepancyId: claim.id, buyerOrganizationId: claim.supplierOrder.buyerOrganizationId, supplierOrganizationId: context.organizationId } } });
        return this.view(document, claim);
      }, { timeout: 20000 });
    } catch (error) {
      if (writtenKey) {
        // Never remove a file if the commit outcome is uncertain and its document exists.
        try { if (!await this.prisma.document.findFirst({ where: { storageKey: writtenKey }, select: { id: true } })) await this.storage.delete(writtenKey); }
        catch { this.logger.warn("Не удалось проверить или удалить файл незавершённого черновика допоставки"); }
      }
      throw error;
    }
  }

  async download(orderId: string, claimId: string, documentId: string, context: SupplierActorContext) {
    await this.visible(orderId, context);
    const claim = await this.claim(this.prisma, orderId, claimId, context.organizationId);
    const document = await this.prisma.document.findFirst({ where: { ...this.where(claim), id: documentId } });
    if (!document?.storageKey || !document.fileName) throw new NotFoundException("Черновик не найден");
    const body = await this.storage.get(document.storageKey);
    if (hash(body) !== document.checksumSha256) throw resupplyDocumentConflict("Проверка целостности черновика не пройдена");
    return { fileName: document.fileName, mimeType: "application/pdf", contentBase64: body.toString("base64") };
  }
}
