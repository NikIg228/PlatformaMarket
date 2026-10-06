export function workspacePageTitle(pathname: string) {
  const page = pathname.replace(/^\/(clinic|supplier)\/?/, "").replace(/\/$/, "");
  const titles: Record<string, string> = {
    cart: "Корзина", products: "Товары", orders: "Заказы", documents: "Документы",
    settings: "Настройки организации", profile: "Мой профиль", notifications: "Уведомления", messages: "Сообщения", support: "Поддержка",
    "products/proposals": "Заявки на новые товары", "products/corrections": "Исправления карточек",
    "products/new": "Добавить товар", "products/import": "Загрузить из файла",
    "products/inventory": "Остатки", "products/promotions": "Акции поставщика", "settings/sources": "Источники товаров",
  };
  if (page === "analytics") return pathname.startsWith("/clinic") ? "Аналитика закупок" : "Аналитика продаж";
  if (page.startsWith("orders/")) return "Заказ";
  return titles[page] ?? "Главная";
}

/** Product navigation follows the section hierarchy, never the browser's previous origin. */
export function workspaceNavigation(pathname: string, search = "") {
  const title = workspacePageTitle(pathname);
  if (!pathname.startsWith("/supplier/products/")) return [{ title, href: pathname }];
  const query = new URLSearchParams(search);
  const items = [{ title: "Товары", href: "/supplier/products" }];
  if (pathname === "/supplier/products/new" && query.get("request") === "1") {
    items.push({ title: "Заявки на новые товары", href: "/supplier/products/proposals" });
    items.push({ title: "Новая заявка", href: pathname + "?request=1" });
  } else {
    items.push({ title: title === "Акции поставщика" ? "Акции" : title, href: pathname });
    if (query.get("mode") === "new" && pathname.endsWith("/promotions")) items.push({ title: "Создать акцию", href: pathname + "?mode=new" });
    if (query.get("mode") === "new" && pathname.endsWith("/corrections")) items.push({ title: "Предложить исправление", href: pathname + "?mode=new" });
  }
  return items;
}
