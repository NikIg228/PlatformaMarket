import { describe, expect, it } from "vitest";
import { workspacePageTitle } from "./page-title";
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
