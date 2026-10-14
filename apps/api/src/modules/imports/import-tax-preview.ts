import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { importVatSelection, vatCalendarDate, type SupplierImportTaxPreview, type SupplierImportTaxPreviewInput } from "@marketplace/schemas";
import { normalizeRow, mappingKey, rowFormatError } from "./import-row";
import { isConfidentAutomaticMatch, rankVariants, scoreVariant } from "./matching";
import { resolveImportPrice } from "./import-vat";

export async function previewImportTax(db: Prisma.TransactionClient, supplierId: string, actorId: string, input: SupplierImportTaxPreviewInput): Promise<SupplierImportTaxPreview> {
  const variants = await db.productVariant.findMany({ include: { product: { include: { brand: true, manufacturer: true } } } });
  const memories = await db.supplierMappingMemory.findMany({ where: { supplierOrganizationId: supplierId, status: "ACTIVE" }, orderBy: { version: "desc" } });
  const items: SupplierImportTaxPreview["items"] = [];
  const declarations: unknown[] = [];
  for (const row of input.rows) {
    const normalized = normalizeRow(row.rawData, input.columnMapping);
    const item: SupplierImportTaxPreview["items"][number] = { rowNumber: row.rowNumber, kind: "UNKNOWN", amountMinor: normalized.priceMinor,
      selection: null, issue: null, offerId: null, offerVersion: null, priceId: null, variantId: null };
    try {
      const formatError = rowFormatError(normalized); if (formatError) throw new Error(formatError.message);
      const explicit = importVatSelection(row.rawData, input.columnMapping);
      const memory = memories.find(value => value.externalKey === mappingKey(normalized));
      const remembered = memory ? variants.find(variant => variant.id === memory.productVariantId) : undefined;
      const candidateInput = { name: normalized.name, normalizedName: normalized.name, supplierSku: normalized.supplierSku, gtin: normalized.gtin, brandText: normalized.brand, manufacturerText: normalized.manufacturer };
      const candidates = memory && remembered ? [{ variant: remembered, score: Number(memory.confidence), reasons: ["mapping_memory", ...scoreVariant(candidateInput, remembered).reasons] }] : rankVariants(candidateInput, variants);
      const best = isConfidentAutomaticMatch(candidates) ? candidates[0]?.variant : undefined;
      item.variantId = best?.id ?? null;
      const offer = best ? await db.supplierOffer.findFirst({ where: { supplierOrganizationId: supplierId, productVariantId: best.id, saleUnitId: best.saleUnitId ?? null },
        include: { prices: { where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: 1 } } }) : null;
      const previous = offer?.prices[0] ?? null;
      item.offerId = offer?.id ?? null; item.offerVersion = offer?.version ?? null; item.priceId = previous?.id ?? null;
      if (normalized.priceMinor) {
        const price = await resolveImportPrice(db, supplierId, actorId, row.rawData, input.columnMapping, normalized.priceMinor, previous);
        item.amountMinor = price.amountMinor; item.selection = price.declaration?.selection ?? null;
        item.kind = explicit ? "INDIVIDUAL" : previous ? "UNCHANGED" : price.declaration ? "INHERITED" : "UNKNOWN";
        declarations.push(price.declaration ? { profile: price.declaration.profile, ruleId: price.declaration.ruleId, defaultVersion: price.declaration.defaultVersion } : null);
      } else { item.kind = "UNCHANGED"; declarations.push(null); }
    } catch (error) {
      item.kind = "ERROR"; item.issue = error instanceof Error ? error.message : "Проверьте налоговые условия строки"; declarations.push(null);
    }
    items.push(item);
  }
  const targets = new Map<string, number[]>();
  for (const [index, row] of input.rows.entries()) {
    const key = items[index].variantId ? `variant:${items[index].variantId}` : `external:${normalizeRow(row.rawData, input.columnMapping).externalId}`;
    targets.set(key, [...(targets.get(key) ?? []), index]);
  }
  for (const indexes of targets.values()) if (indexes.length > 1) for (const index of indexes) {
    items[index].kind = "ERROR";
    items[index].issue = "Несколько строк обновляют одно предложение. Оставьте одну строку для каждого товара";
  }
  const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)])) : value;
  const previewHash = createHash("sha256").update(JSON.stringify(canonical({ supplierId, actorId, date: vatCalendarDate(), input, items, declarations }))).digest("hex");
  const count = (kind: SupplierImportTaxPreview["items"][number]["kind"]) => items.filter(item => item.kind === kind).length;
  return { previewHash, items, counts: { inherited: count("INHERITED"), individual: count("INDIVIDUAL"), unchanged: count("UNCHANGED"), errors: count("ERROR"), unknown: count("UNKNOWN") } };
}
