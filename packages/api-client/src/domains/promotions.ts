import type { ClientTransport } from "../transport-contract";
import type { PromotionListQuery, PromotionPage, PublicPromotionPage, CreateOfferPromotion, OfferPromotion, ReviseOfferPromotion, OfferPromotionCommand } from "@marketplace/schemas";

export function listPromotions(transport: ClientTransport, query: Partial<PromotionListQuery> = {}) { return transport.get<PromotionPage>(`/promotions?${new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]))}`); }

export function listPublicPromotions(transport: ClientTransport, query: Partial<PromotionListQuery> = {}) { return transport.get<PublicPromotionPage>(`/promotions/storefront?${new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]))}`); }

export function createOfferPromotion(transport: ClientTransport, input: CreateOfferPromotion) { return transport.post<OfferPromotion>("/promotions", input); }

export function reviseOfferPromotion(transport: ClientTransport, id: string, input: ReviseOfferPromotion) { return transport.patch<OfferPromotion>(`/promotions/${encodeURIComponent(id)}/terms`, input); }

export function commandOfferPromotion(transport: ClientTransport, id: string, input: OfferPromotionCommand) { return transport.post<OfferPromotion>(`/promotions/${encodeURIComponent(id)}/commands`, input); }
