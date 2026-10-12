import type { PromotionListQuery } from "@marketplace/schemas";

export type PromotionPreview = {
  id: string; title: string; benefit: string; subtitle: string; supplier: string;
  supplierId: string; categoryId: string; endsAt: string; image: string;
  kind: "PERCENTAGE" | "BUY_X_GET_Y"; tone: "mint" | "peach" | "blue" | "cream" | "dark";
  conditions: string;
};
export const previewPromotionSuppliers = [
  { id: "d1000000-0000-4000-8000-000000000001", name: "Dent Supply" },
  { id: "d1000000-0000-4000-8000-000000000002", name: "MedDent" },
  { id: "d1000000-0000-4000-8000-000000000003", name: "Dental Pro" },
];
export const previewPromotionCategories = [
  { id: "c1000000-0000-4000-8000-000000000001", name: "Материалы" },
  { id: "c1000000-0000-4000-8000-000000000002", name: "Расходные материалы" },
  { id: "c1000000-0000-4000-8000-000000000003", name: "Инструменты" },
];
const rows = [
  ["restoration", "Материалы для реставрации", "до −25%", "На выбранные композиты", 0, 0, "PERCENTAGE", "mint", "Скидка на выбранные реставрационные материалы. Условия зависят от позиции и фасовки."],
  ["gloves", "Перчатки для вашей команды", "3 + 1 в подарок", "При покупке трёх упаковок", 1, 1, "BUY_X_GET_Y", "peach", "При покупке трёх упаковок нитриловых перчаток четвёртая упаковка — в подарок. Размеры можно комбинировать."],
  ["instruments", "Точность в каждом движении", "−15%", "На наборы стоматологических боров", 2, 2, "PERCENTAGE", "blue", "Скидка 15% на выбранные наборы стоматологических боров."],
  ["sterilization", "Чистая выгода", "−20%", "На материалы для стерилизации", 1, 1, "PERCENTAGE", "cream", "Скидка 20% на выбранные упаковки стерилизационных пакетов."],
  ["impressions", "Точность в каждой детали", "−15%", "Оттискные материалы", 0, 0, "PERCENTAGE", "mint", "Скидка 15% на выбранные оттискные материалы и расходные принадлежности."],
  ["consumables", "Больше материалов — больше выгоды", "5 + 1 в подарок", "Пополните запас для ежедневной работы", 2, 1, "BUY_X_GET_Y", "dark", "При покупке пяти упаковок расходных материалов шестая упаковка той же позиции — в подарок."],
  ["sterilization", "Расходники для ежедневной работы", "до −10%", "Всё необходимое под рукой", 1, 1, "PERCENTAGE", "mint", "Скидка до 10% на выбранные расходные материалы для ежедневной работы."],
  ["restoration", "Материалы для вашей практики", "2 + 1 в подарок", "Выгодное пополнение запасов", 0, 0, "BUY_X_GET_Y", "peach", "При покупке двух упаковок выбранного материала третья упаковка той же позиции — в подарок."],
] as const;

/** Explicitly authorized visual fixtures. Never enabled by query, auth or feature flags. */
export function localPromotionPreviews(query: Partial<PromotionListQuery> = {}, environment = process.env.NODE_ENV, now = Date.now()): PromotionPreview[] {
  if (environment !== "development") return [];
  const items: PromotionPreview[] = rows.map(([image, title, benefit, subtitle, supplier, category, kind, tone, conditions], index) => ({
    id: `local-campaign-${index}`, title, benefit, subtitle, supplier: previewPromotionSuppliers[supplier].name,
    supplierId: previewPromotionSuppliers[supplier].id, categoryId: previewPromotionCategories[category].id,
    kind, tone, conditions, endsAt: "2026-10-31T18:59:59.000Z", image: `/images/promotion-previews/${image}.webp`,
  }));
  const text = query.q?.trim().toLocaleLowerCase("ru");
  return items.filter(item => Date.parse(item.endsAt) > now && (!query.kind || item.kind === query.kind) &&
    (!query.supplierOrganizationId || item.supplierId === query.supplierOrganizationId) &&
    (!query.categoryId || item.categoryId === query.categoryId) &&
    (!text || `${item.title} ${item.subtitle} ${item.supplier}`.toLocaleLowerCase("ru").includes(text)));
}
