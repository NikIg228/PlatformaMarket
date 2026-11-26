import type { JanaPostLocalCity, JanaPostLocalResult } from "@marketplace/schemas";
import type { ClientTransport } from "../transport-contract";

export function lookupJanaPostLocal(transport: ClientTransport, orderId: string, city: JanaPostLocalCity) {
  const query = new URLSearchParams({ city });
  return transport.get<JanaPostLocalResult>(
    `/supplier-orders/${encodeURIComponent(orderId)}/janapost-local?${query}`,
  );
}
