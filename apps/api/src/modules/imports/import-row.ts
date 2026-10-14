import { importPriceMinor, type SupplierColumnMappingInput } from "@marketplace/schemas";
import { normalizeCatalogText } from "./matching";

export type RawRow = Record<string, unknown>;

function value(row: RawRow, column?: string) {
  return column ? String(row[column] ?? "").trim() : "";
}

export function normalizeRow(row: RawRow, mapping: SupplierColumnMappingInput) {
  return {
    externalId: value(row, mapping.externalId),
    name: value(row, mapping.name),
    supplierSku: value(row, mapping.supplierSku) || null,
    gtin: value(row, mapping.gtin) || null,
    brand: value(row, mapping.brand) || null,
    manufacturer: value(row, mapping.manufacturer) || null,
    unit: value(row, mapping.unit) || null,
    priceMinor: value(row, mapping.priceMinor) ? importPriceMinor(value(row, mapping.priceMinor), mapping.priceUnit) ?? "INVALID_PRICE" : null,
    currency: value(row, mapping.currency).toUpperCase() || null,
    quantityOnHand: value(row, mapping.quantityOnHand) || null,
    lotNumber: value(row, mapping.lotNumber) || null,
    expirationDate: value(row, mapping.expirationDate) || null,
  };
}

export function mappingKey(row: ReturnType<typeof normalizeRow>) {
  if (row.supplierSku) return `SKU:${normalizeCatalogText(row.supplierSku)}`;
  if (row.gtin) return `GTIN:${normalizeCatalogText(row.gtin)}`;
  return `NAME:${normalizeCatalogText(row.name)}`;
}

export function lineComplianceStatus(
  row: ReturnType<typeof normalizeRow>,
  regulated = false,
) {
  const reasons: string[] = [];
  if (row.currency && row.currency !== "KZT")
    reasons.push("UNSUPPORTED_CURRENCY");
  if (
    row.expirationDate &&
    !Number.isNaN(Date.parse(row.expirationDate)) &&
    new Date(row.expirationDate) <= new Date()
  )
    reasons.push("EXPIRED_LOT");
  if (!row.priceMinor || !row.currency)
    reasons.push("PRICE_OR_CURRENCY_REQUIRED");
  if (regulated && !row.lotNumber) reasons.push("LOT_REQUIRED");
  if (reasons.includes("EXPIRED_LOT")) return { status: "EXPIRED", reasons };
  if (reasons.includes("UNSUPPORTED_CURRENCY"))
    return { status: "BLOCKED", reasons };
  if (reasons.length > 0)
    return {
      status: regulated ? "DOCUMENT_REQUIRED" : "REVIEW_REQUIRED",
      reasons,
    };
  return { status: "READY", reasons: [] };
}

export function rowFormatError(row: ReturnType<typeof normalizeRow>) {
  if (!row.externalId || !row.name)
    return {
      code: "REQUIRED_VALUE_MISSING",
      message: "External ID and name are required",
    };
  if (
    row.priceMinor &&
    (!/^[1-9]\d{0,19}$/.test(row.priceMinor) || BigInt(row.priceMinor) <= 0n)
  )
    return {
      code: "INVALID_PRICE_MINOR",
      message: "Price must be a positive integer in minor units",
    };
  if (
    row.quantityOnHand &&
    !/^\d+(?:\.\d{1,6})?$/.test(row.quantityOnHand)
  )
    return {
      code: "INVALID_QUANTITY",
      message: "Quantity must be a non-negative decimal with up to 6 fraction digits",
    };
  if (row.expirationDate && Number.isNaN(Date.parse(row.expirationDate)))
    return {
      code: "INVALID_EXPIRATION_DATE",
      message: "Expiration date must be a valid date",
    };
  return null;
}
