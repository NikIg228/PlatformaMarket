import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { cabinetLoadingLabel, LoadingState } from "./loading-state";
import { DmButton } from "./controls";

vi.mock("@fluentui/react-components", async () => {
  const { createRequire } = await import("node:module");
  return createRequire(import.meta.url)("@fluentui/react-components");
});

describe("loading state accessibility and embedding", () => {
  it.each(["block", "inline"] as const)("announces the subject once in %s mode without a focusable control", presentation => {
    const html = renderToStaticMarkup(<LoadingState presentation={presentation} label="Загружаем остатки…" />);
    expect(html.match(/role="status"/g)).toHaveLength(1);
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-labelledby=');
    expect(html).toContain("Загружаем остатки…");
    expect(html).not.toMatch(/<(button|input)|tabindex=/i);
  });
  it("uses phrasing content inside a button", () => {
    const html = renderToStaticMarkup(<DmButton disabled><LoadingState presentation="inline" label="Загружаем товары…" /></DmButton>);
    expect(html).not.toContain("<div");
    expect(html).toContain("fui-Spinner");
  });
  it("keeps cabinet preparation terminology stable in both locales", () => {
    expect(cabinetLoadingLabel("ru")).toBe("Загружаем кабинет…");
    expect(cabinetLoadingLabel("kk")).toBe("Кабинет жүктелуде…");
  });
});
