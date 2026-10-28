import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

export function isCatalogSerializationConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" ||
    (error.code === "P2010" && ["40001", "40P01"].includes(String(error.meta?.code))));
}

export async function lockCatalogVariantForAdoption(
  tx: Prisma.TransactionClient,
  variantId: string,
) {
  try {
  const parent = await tx.productVariant.findUnique({ where: { id: variantId }, select: { productId: true } });
  if (!parent) throw new NotFoundException("Product variant not found");
  const productId = parent.productId;
  // Match import rollback's parent row lock without changing logical versions.
  // The no-op write also conflicts with a competing Serializable snapshot.
  await tx.$executeRaw`UPDATE "Product" SET "version" = "version" WHERE "id" = ${productId}::uuid`;
  const variant = await tx.productVariant.findFirst({
    where: { id: variantId, productId },
    include: { product: { select: { status: true } } },
  });
  if (!variant) throw new NotFoundException("Product variant not found");
  if (variant.status === "ARCHIVED" || variant.product.status === "ARCHIVED")
    throw new ConflictException("Catalog product was archived; select a current variant");
  } catch (error) {
    if (isCatalogSerializationConflict(error)) throw new ConflictException("Catalog changed concurrently; retry with current data");
    throw error;
  }
}
