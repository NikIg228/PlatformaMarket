import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionRequired, sessionLoginUrl } from "./session-required";
vi.mock("@fluentui/react-components", () => ({ Button: "button", Spinner: "span", Field: "label", Input: "input", Checkbox: "input", Textarea: "textarea", Select: "select", Tooltip: "span" }));

afterEach(() => vi.unstubAllGlobals());
describe("protected session boundary", () => {
  it.each([undefined, "expired", "identity-changed"] as const)("renders no error while redirecting %s", termination => {
    const html = renderToStaticMarkup(<SessionRequired error={termination ? "Old error" : null} termination={termination} retry={() => {}} />);
    expect(html).toContain("Переходим ко входу");
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain("Old error");
  });
  it("keeps access denial and transient recovery separate from logout", () => {
    const denied = renderToStaticMarkup(<SessionRequired error="Denied" termination="access-denied" retry={() => {}} />);
    const offline = renderToStaticMarkup(<SessionRequired error="Network" retry={() => {}} locale="kk" />);
    expect(denied).toContain("Выбрать организацию");
    expect(offline).toContain("Қайталау");
    expect(offline).not.toContain("Кіру бетіне өтудеміз");
  });
  it("prevents silent resume and preserves locale/return path without accepting protocol-relative destinations", () => {
    vi.stubGlobal("window", { location: { origin: "http://localhost:3000" } });
    const result = new URL(sessionLoginUrl("/login", "/supplier/orders?lang=kk", "kk"));
    expect(result.searchParams.get("signedOut")).toBe("1");
    expect(result.searchParams.get("lang")).toBe("kk");
    expect(result.searchParams.get("returnTo")).toBe("/supplier/orders?lang=kk");
    expect(new URL(sessionLoginUrl("/login", "//elsewhere.invalid", "ru", true)).searchParams.has("returnTo")).toBe(false);
  });
});
