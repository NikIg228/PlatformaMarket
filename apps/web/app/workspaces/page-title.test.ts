import { describe, expect, it } from "vitest";
import { workspacePageTitle, workspaceNavigation } from "./page-title";
describe("workspace page titles", () => {
  it.each(["clinic", "supplier"])("keeps home and nested sections distinct for %s", role => {
    expect(workspacePageTitle(`/${role}`)).toBe("Главная");
    expect(workspacePageTitle(`/${role}/messages`)).toBe("Сообщения");
    expect(workspacePageTitle(`/${role}/orders/123`)).toBe("Заказ");
    expect(workspacePageTitle(`/${role}/documents/`)).toBe("Документы");
  });
  it("names supplier subpages and analytics", () => {
    expect(workspacePageTitle("/supplier/products/new")).toBe("Добавить товар");
    expect(workspacePageTitle("/supplier/products/import")).toBe("Загрузить из файла");
    expect(workspacePageTitle("/supplier/products/proposals")).toBe("Заявки на новые товары");
    expect(workspacePageTitle("/supplier/settings/sources")).toBe("Источники товаров");
    expect(workspacePageTitle("/clinic/analytics")).toBe("Аналитика закупок");
    expect(workspacePageTitle("/supplier/analytics")).toBe("Аналитика продаж");
  });
});
describe("supplier product navigation", () => {
  it("keeps parent destinations within the supplier workspace", () => {
    expect(workspaceNavigation("/supplier/products/new")).toEqual([
      { title: "Товары", href: "/supplier/products" }, { title: "Добавить товар", href: "/supplier/products/new" },
    ]);
    expect(workspaceNavigation("/supplier/products/promotions", "mode=new&offer=abc").map(item => item.title)).toEqual(["Товары", "Акции", "Создать акцию"]);
    expect(workspaceNavigation("/supplier/products/new", "request=1").at(-2)?.href).toBe("/supplier/products/proposals");
    expect(workspaceNavigation("/supplier/products")).toHaveLength(1);
    expect(workspaceNavigation("/clinic/orders/123")).toHaveLength(1);
  });
});
