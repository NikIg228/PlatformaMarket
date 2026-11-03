import { describe, expect, it } from "vitest";
import { withWorkspaceLocale, workspaceLocale, workspaceText } from "./workspace-locale";
import { workspaceNavigation, workspacePageTitle } from "./page-title";
import { workspaceGreeting } from "./greeting";

describe("workspace locale navigation", () => {
  it("defaults to Russian and only accepts the supported Kazakh value", () => {
    for (const value of [null, "", "ru", "en", "KK"]) expect(workspaceLocale(value)).toBe("ru");
    expect(workspaceLocale("kk")).toBe("kk");
  });
  it("preserves query and fragment while carrying one locale parameter", () => {
    expect(withWorkspaceLocale("/supplier/settings?tab=calendar#week", "kk"))
      .toBe("/supplier/settings?tab=calendar&lang=kk#week");
    expect(withWorkspaceLocale("/supplier/settings?lang=ru&tab=calendar", "kk"))
      .toBe("/supplier/settings?lang=kk&tab=calendar");
    expect(withWorkspaceLocale("/clinic/orders?q=a%26b&lang=kk", "ru"))
      .toBe("/clinic/orders?q=a%26b");
    expect(withWorkspaceLocale("/supplier/settings", "ru")).toBe("/supplier/settings");
  });
  it("leaves external destinations and local fragments untouched", () => {
    for (const href of ["https://example.com/?lang=en", "//example.com/path", "#content", "mailto:support@example.com"])
      expect(withWorkspaceLocale(href, "kk")).toBe(href);
  });
  it("localizes page titles and carries language through hierarchical navigation", () => {
    expect(workspacePageTitle("/supplier/settings", "kk")).toBe("Ұйым баптаулары");
    expect(workspaceNavigation("/supplier/products/new", "request=1&lang=kk")).toEqual([
      { title: "Тауарлар", href: "/supplier/products?lang=kk" },
      { title: "Жаңа тауарларға өтінімдер", href: "/supplier/products/proposals?lang=kk" },
      { title: "Жаңа өтінім", href: "/supplier/products/new?request=1&lang=kk" },
    ]);
  });
  it("keeps user names and unknown content intact", () => {
    expect(workspaceGreeting(8, " Айгүл Сәрсен ", "kk")).toBe("Қайырлы таң, Айгүл");
    expect(workspaceGreeting(13, undefined, "kk")).toBe("Қайырлы күн");
    expect(workspaceText("kk", "ТОО Клиника №1")).toBe("ТОО Клиника №1");
    expect(workspaceText("ru", "Настройки организации")).toBe("Настройки организации");
  });
});
