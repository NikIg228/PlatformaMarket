import { readFileSync, readdirSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import contract from "./component-contract.json";

const root = fileURLToPath(new URL("../../../", import.meta.url));
function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith(".") || ["node_modules", "dist", "generated", "test-results", "playwright-report"].includes(entry.name)) return [];
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? sources(path) : /\.(css|tsx?)$/.test(path) && !/\.(test|spec)\./.test(path) ? [path] : [];
  });
}

describe("Market component contract", () => {
  it("keeps geometry adapters synchronized with the versioned contract", () => {
    const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
    for (const [name, value] of Object.entries(contract.tokens)) expect(css, name).toContain(`${name}: ${value};`);
  });

  it("resolves every Market CSS token used by app and shared UI sources", () => {
    const files = [...sources(resolve(root, "apps")), ...sources(resolve(root, "packages/ui/src"))];
    const texts = files.map(path => ({ path, text: readFileSync(path, "utf8") }));
    const defined = new Set(texts.flatMap(({ text }) => [...text.matchAll(/(--dm-[\w-]+)\s*:/g)].map(match => match[1])));
    const missing = texts.flatMap(({ path, text }) => [...text.matchAll(/var\(\s*(--dm-[\w-]+)/g)]
      .filter(match => !defined.has(match[1])).map(match => `${relative(root, path)}: ${match[1]}`));
    expect([...new Set(missing)]).toEqual([]);
  });
});
