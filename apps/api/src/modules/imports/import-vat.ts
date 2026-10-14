import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { grossFromNetMinor, importVatSelection, vatLegacyFields, type SupplierColumnMappingInput, type VatPriceSnapshot } from "@marketplace/schemas";
import { resolvePriceVat } from "../vat/vat-rules";

export async function resolveImportPrice(db: Prisma.TransactionClient, supplierId: string, actorId: string,
  row: Record<string, unknown>, mapping: SupplierColumnMappingInput, amountMinor: string,
  previous: { taxSnapshot?: unknown; includesVat?: boolean; vatRate?: unknown } | null,
  frozenDefault?: VatPriceSnapshot | null) {
  let selection;
  try { selection = importVatSelection(row, mapping); }
  catch { throw new BadRequestException("Проверьте режим, ставку и основание НДС в строке импорта"); }
  const declarationInput = (value: NonNullable<typeof selection>) => {
    if (!mapping.taxAcknowledged || !mapping.expectedRequisitesVersion)
      throw new BadRequestException("Подтвердите налоговые условия импорта и актуальные реквизиты");
    return { selection: value, expectedRequisitesVersion: mapping.expectedRequisitesVersion, acknowledged: true as const };
  };
  const tax = await resolvePriceVat(db, supplierId, actorId, previous,
    selection ? declarationInput(selection) : undefined,
    mapping.defaultVat ? declarationInput(mapping.defaultVat) : undefined, frozenDefault);
  if (mapping.priceIncludesVat === false && !tax)
    throw new BadRequestException("Для цены без НДС требуется подтверждённый налоговый режим");
  return {
    amountMinor: mapping.priceIncludesVat === false ? grossFromNetMinor(amountMinor, tax!.selection) : amountMinor,
    ...(tax ? vatLegacyFields(tax.selection) : { includesVat: previous?.includesVat ?? true, vatRate: previous?.vatRate == null ? null : String(previous.vatRate) }),
    taxSnapshot: tax ? tax as unknown as Prisma.InputJsonValue : Prisma.DbNull,
    declaration: tax,
  };
}
