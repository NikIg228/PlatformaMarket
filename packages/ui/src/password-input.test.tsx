import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { DmInput } from "./controls";

vi.mock("@fluentui/react-components", async () => {
  const { createRequire } = await import("node:module");
  return createRequire(import.meta.url)("@fluentui/react-components");
});

it("masks passwords initially and never submits the form from the reveal action", () => {
  const html = renderToStaticMarkup(<DmInput type="password" required autoComplete="new-password" maxLength={128} />);
  expect(html).toContain('type="password"');
  expect(html).toContain('type="button"');
  expect(html).toContain('aria-label="Показать пароль"');
  expect(html).toContain('aria-pressed="false"');
  expect(html).toContain('autoComplete="new-password"');
  expect(html).toContain('maxLength="128"');
});

it("disables the reveal action together with the field", () => {
  const html = renderToStaticMarkup(<DmInput type="password" disabled />);
  expect(html.match(/disabled=""/g)).toHaveLength(2);
});

it("keeps ordinary inputs free of password actions", () => {
  const html = renderToStaticMarkup(<DmInput type="email" />);
  expect(html).toContain('type="email"');
  expect(html).not.toContain("Показать пароль");
});
