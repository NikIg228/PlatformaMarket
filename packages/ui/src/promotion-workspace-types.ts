import type { CreateOfferPromotion, OfferPromotion, OfferPromotionCommand, PromotionListQuery, PromotionPage, ReviseOfferPromotion, WorkspaceOfferPage } from "@marketplace/schemas";

export interface PromotionWorkspaceApi {
  listPromotions(query?: Partial<PromotionListQuery>): Promise<PromotionPage>;
  createOfferPromotion(input: CreateOfferPromotion): Promise<OfferPromotion>;
  reviseOfferPromotion(id: string, input: ReviseOfferPromotion): Promise<OfferPromotion>;
  commandOfferPromotion(id: string, input: OfferPromotionCommand): Promise<OfferPromotion>;
  workspaceOffers(query?: { q?: string; limit?: number; cursor?: string }): Promise<WorkspaceOfferPage>;
}
export const promotionLabels: Record<string, string> = {
  DRAFT: "Черновик", PENDING: "На проверке", CHANGES_REQUESTED: "Нужны изменения", REJECTED: "Отклонена", APPROVED: "Согласована",
  LEGACY_UNREVIEWED: "Не проверена", SCHEDULED: "Запланирована", ACTIVE: "Действует", PAUSED: "Приостановлена", ENDED: "Завершена",
  CREATED: "Создана", REVISED: "Условия изменены", SUBMIT: "Подана на проверку", APPROVE: "Согласована", REQUEST_CHANGES: "Возвращена поставщику", REJECT: "Отклонена",
  PAUSE: "Приостановлена", RESUME: "Возобновлена", ARCHIVE: "В архиве", SAVE_TEMPLATE: "Сохранена как шаблон", PLACE: "Изменено размещение", CREATED_FROM_TEMPLATE: "Создана из шаблона",
};
export function promotionLocalDate(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
