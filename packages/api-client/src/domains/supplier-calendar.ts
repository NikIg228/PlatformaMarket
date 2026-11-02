import type { SaveSupplierCalendar } from "@marketplace/schemas";
import type { ClientTransport } from "../transport-contract";

export async function getSupplierCalendar(transport: ClientTransport) {
  const { supplierCalendarResponseSchema } = await import("@marketplace/schemas");
  return supplierCalendarResponseSchema.parse(await transport.get<unknown>("/suppliers/current/working-calendar"));
}

export async function saveSupplierCalendar(transport: ClientTransport, input: SaveSupplierCalendar) {
  const { saveSupplierCalendarSchema, supplierCalendarResponseSchema } = await import("@marketplace/schemas");
  return supplierCalendarResponseSchema.parse(await transport.post<unknown>("/suppliers/current/working-calendar", saveSupplierCalendarSchema.parse(input)));
}
