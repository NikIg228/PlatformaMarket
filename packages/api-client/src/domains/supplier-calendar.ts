import { saveSupplierCalendarSchema, supplierCalendarResponseSchema, type SaveSupplierCalendar } from "@marketplace/schemas";
import type { ClientTransport } from "../transport-contract";

export async function getSupplierCalendar(transport: ClientTransport) {
  return supplierCalendarResponseSchema.parse(await transport.get<unknown>("/suppliers/current/working-calendar"));
}

export async function saveSupplierCalendar(transport: ClientTransport, input: SaveSupplierCalendar) {
  return supplierCalendarResponseSchema.parse(await transport.post<unknown>("/suppliers/current/working-calendar", saveSupplierCalendarSchema.parse(input)));
}
