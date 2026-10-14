import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { integrationPriceTaxSchema, type IntegrationTaxBinding, type UpdateIntegrationTaxInput } from "@marketplace/schemas";
import { currentVatProfile, vatConflict } from "../vat/vat-rules";
import { resolveImportPrice } from "../imports/import-vat";
import type { SupplierActorContext } from "../suppliers/supplier-access.service";

type Binding = Prisma.IntegrationDataBindingGetPayload<{ include: { connection: true } }>;
export function taxBindingResponse(binding: Binding): IntegrationTaxBinding {
  const config = binding.configuration as Record<string, unknown> | null;
  const priceTax = integrationPriceTaxSchema.safeParse(config?.priceTax);
  return { id: binding.id, connectionId: binding.connectionId, connectionName: binding.connection.displayName, provider: binding.connection.provider,
    warehouseId: binding.warehouseId, offerId: binding.offerId, priority: binding.priority, updatedAt: binding.updatedAt.toISOString(), priceTax: priceTax.success ? priceTax.data : null };
}
export async function updateIntegrationTax(db: Prisma.TransactionClient, supplierId: string, connectionId: string, bindingId: string,
  input: UpdateIntegrationTaxInput, context: SupplierActorContext): Promise<IntegrationTaxBinding> {
  if (context.organizationId !== supplierId) throw new ForbiddenException("Налоговые условия подтверждает представитель поставщика");
  const scope = `integration-tax:${supplierId}:${bindingId}:${context.actorId}`;
  const requestHash = createHash("sha256").update(JSON.stringify({ connectionId, ...input })).digest("hex");
  const replay = await db.idempotencyRecord.findUnique({ where: { scope_key: { scope, key: input.idempotencyKey } } });
  if (replay) { if (replay.requestHash !== requestHash) throw vatConflict("Ключ повтора уже использован для других условий"); return replay.responseBody as unknown as IntegrationTaxBinding; }
  const binding = await db.integrationDataBinding.findFirst({ where: { id: bindingId, connectionId, dataType: "PRICE", connection: { supplierOrganizationId: supplierId } }, include: { connection: true } });
  if (!binding) throw new NotFoundException("Источник цен не найден");
  if (binding.updatedAt.toISOString() !== input.expectedUpdatedAt) throw vatConflict("Настройки источника изменились. Обновите данные");
  const profile = await currentVatProfile(db, supplierId);
  if (profile.version !== input.priceTax.expectedRequisitesVersion) throw vatConflict("Реквизиты изменились. Обновите налоговый профиль");
  const initial = await resolveImportPrice(db, supplierId, context.actorId, {}, { externalId: "externalId", name: "name", ...input.priceTax, priceIncludesVat: true }, "0", null);
  const configuration = { ...(binding.configuration as Record<string, unknown> ?? {}), priceTax: input.priceTax, vatContext: { actorId: context.actorId, defaultTax: initial.declaration } };
  const changed = await db.integrationDataBinding.updateMany({ where: { id: bindingId, updatedAt: new Date(input.expectedUpdatedAt) }, data: { configuration: configuration as Prisma.InputJsonValue } });
  if (changed.count !== 1) throw vatConflict("Настройки источника изменились параллельно");
  const updated = await db.integrationDataBinding.findUniqueOrThrow({ where: { id: bindingId }, include: { connection: true } });
  await db.auditLog.create({ data: { ...context, action: "integration.binding.tax_updated", entityType: "IntegrationDataBinding", entityId: bindingId, before: binding.configuration ?? Prisma.JsonNull, after: configuration as Prisma.InputJsonValue } });
  const response = taxBindingResponse(updated);
  await db.idempotencyRecord.create({ data: { scope, key: input.idempotencyKey, requestHash, responseCode: 200, responseBody: response as unknown as Prisma.InputJsonValue, expiresAt: new Date(Date.now() + 86_400_000) } });
  return response;
}
