import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
// Use Fluent's real CJS export: Node's ESM loader cannot resolve the installed
// Tabster CJS named exports, although the browser bundler can.
vi.mock("@fluentui/react-components", async () => {
  const { createRequire } = await import("node:module");
  return { createLightTheme: createRequire(import.meta.url)("@fluentui/react-components").createLightTheme };
});
import { dentMarketLightTheme as theme } from "./light-theme";
import contract from "./semantic-light.json";

function luminance(hex: string) {
  const rgb = hex.slice(1).match(/../g)!.map(value => {
    const channel = parseInt(value, 16) / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  });
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}

describe("shared semantic light contract", () => {
  it("keeps Fluent primary and compound actions legible while states darken", () => {
    for (const colors of [
      [theme.colorBrandBackground, theme.colorBrandBackgroundHover, theme.colorBrandBackgroundPressed],
      [theme.colorCompoundBrandBackground, theme.colorCompoundBrandBackgroundHover, theme.colorCompoundBrandBackgroundPressed],
    ]) {
      expect(colors).toEqual(["#007A59", "#00664B", "#00543E"]);
      for (const background of colors) expect(contrast(background, theme.colorNeutralForegroundOnBrand)).toBeGreaterThanOrEqual(4.5);
      expect(luminance(colors[1])).toBeLessThan(luminance(colors[0]));
      expect(luminance(colors[2])).toBeLessThan(luminance(colors[1]));
    }
  });

  it("preserves AA text, semantic feedback and visible controls on their surfaces", () => {
    const t = contract.tokens;
    for (const key of ["text.primary", "text.secondary", "text.muted", "brand.content"] as const) {
      for (const surface of ["surface.default", "surface.canvas", "surface.subtle"] as const)
        expect(contrast(t[key], t[surface])).toBeGreaterThanOrEqual(4.5);
    }
    for (const role of ["success", "warning", "danger", "info", "ai"] as const)
      expect(contrast(t[`${role}.content`], t[`${role}.soft`])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t["border.control"], t["surface.default"])).toBeGreaterThanOrEqual(3);
    expect(contrast(t["focus.ring"], t["surface.canvas"])).toBeGreaterThanOrEqual(3);
  });

  it("keeps CSS adapters synchronized with every approved value", () => {
    const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
    for (const value of Object.values(contract.tokens)) expect(css).toContain(`: ${value};`);
    expect(css).toContain("--dm-brand-primary-hover: #00664B;");
    expect(css).toContain("--dm-brand-deep: #00543E;");
    expect(theme.colorNeutralBackgroundDisabled).toBe(contract.tokens["disabled.surface"]);
    expect(theme.colorNeutralForegroundDisabled).toBe(contract.tokens["disabled.content"]);
  });
});
