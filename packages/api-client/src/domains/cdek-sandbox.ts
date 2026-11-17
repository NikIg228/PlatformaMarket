import type { CdekCities, CdekSandboxQuote, CdekSandboxQuoteInput, CdekSandboxStatus } from "@marketplace/schemas";
import type { ClientTransport } from "../transport-contract";
const path = (orderId: string) => `/supplier-orders/${encodeURIComponent(orderId)}/cdek-sandbox`;
export const cdekSandboxStatus = (transport: ClientTransport, orderId: string) => transport.get<CdekSandboxStatus>(path(orderId));
export const cdekSandboxCities = (transport: ClientTransport, orderId: string, city: string) => transport.get<CdekCities>(`${path(orderId)}/cities?${new URLSearchParams({ city })}`);
export const cdekSandboxQuote = (transport: ClientTransport, orderId: string, input: CdekSandboxQuoteInput) => transport.post<CdekSandboxQuote>(`${path(orderId)}/quotes`, input);
