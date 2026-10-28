import type { IntegrationConnection, Prisma } from "@prisma/client";
import type { PrismaService } from "../../platform/prisma/prisma.service";
import { PermanentIntegrationError } from "./adapters/integration-adapter";

export async function reservationJobScope(
  prisma: Pick<PrismaService, "externalReservation">,
  connection: Pick<IntegrationConnection, "id" | "supplierOrganizationId">,
  payload: Record<string, unknown>,
): Promise<Prisma.ExternalReservationWhereUniqueInput | null> {
  const recordId = payload.externalReservationRecordId;
  if (recordId === undefined) return null;
  if (typeof recordId !== "string" || !recordId.trim())
    throw new PermanentIntegrationError("External reservation record ID must be a non-empty string");
  if (typeof connection?.id !== "string" || !connection.id.trim() ||
      typeof connection.supplierOrganizationId !== "string" || !connection.supplierOrganizationId.trim())
    throw new PermanentIntegrationError("External reservation job requires connection and supplier context");
  const inventoryReservationId = payload.inventoryReservationId;
  if (inventoryReservationId !== undefined && (typeof inventoryReservationId !== "string" || !inventoryReservationId.trim()))
    throw new PermanentIntegrationError("Inventory reservation ID must be a non-empty string");
  const where: Prisma.ExternalReservationWhereUniqueInput = {
    id: recordId,
    connectionId: connection.id,
    inventoryReservation: { supplierOrganizationId: connection.supplierOrganizationId },
    ...(inventoryReservationId === undefined ? {} : { inventoryReservationId }),
  };
  const record = await prisma.externalReservation.findFirst({ where, select: { id: true } });
  if (!record) throw new PermanentIntegrationError("External reservation does not match integration connection");
  return where;
}
