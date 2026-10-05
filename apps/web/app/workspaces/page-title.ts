export function workspacePageTitle(pathname: string) {
  const page = pathname.replace(/^\/(clinic|supplier)\/?/, "").replace(/\/$/, "");
  const titles: Record<string, string> = {
    cart: "Корзина", products: "Товары", orders: "Заказы", documents: "Документы",
    settings: "Настройки организации", notifications: "Уведомления", messages: "Сообщения", support: "Поддержка",
    "products/proposals": "Заявки на новые товары", "products/corrections": "Исправления карточек",
    "products/new": "Добавить товар", "products/import": "Загрузить из файла",
    "products/inventory": "Партии и резервы", "products/promotions": "Акции поставщика", "settings/sources": "Источники товаров",
  };
  if (page === "analytics") return pathname.startsWith("/clinic") ? "Аналитика закупок" : "Аналитика продаж";
  if (page.startsWith("orders/")) return "Заказ";
  return titles[page] ?? "Главная";
}
