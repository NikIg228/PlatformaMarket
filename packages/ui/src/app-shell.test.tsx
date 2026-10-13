import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppShell, type AppShellProps } from "./app-shell";

// Node tests exercise the legacy contract; real Fluent focus/portals run in Playwright.
vi.mock("@fluentui/react-components", () => ({ Avatar: "span", Button: "button" }));

const props: AppShellProps = {
  productName: "PlatformaMarket", productMark: "PM", workspaceLabel: "Кабинет клиники",
  userName: "Сотрудник клиники", userMeta: "Клиника", activeNavigation: "documents",
  navigation: [{ id: "documents", label: "Документы", icon: null }, { id: "orders", label: "Заказы", icon: null, href: "/orders" }],
  onNavigate: () => undefined, onLogout: () => undefined, children: "Реестр документов",
};

describe("AppShell opt-in compatibility", () => {
  it("preserves the default documents consumer and its existing actions", () => {
    const html = renderToStaticMarkup(createElement(AppShell, props));
    expect(html).toContain('class="mp-shell"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('href="/orders"');
    expect(html).toContain('aria-label="Выйти"');
    expect(html).toContain("Реестр документов");
    expect(html).not.toContain("mp-shell-workspace");
  });

  it("keeps the original pending logout contract for callers without a variant", () => {
    const html = renderToStaticMarkup(createElement(AppShell, { ...props, logoutPending: true }));
    expect(html).toContain('aria-label="Выходим…"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('disabled=""');
  });
});
