import { mkdir, readdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "apps/web");
const assets = new Map();
async function collect(dir, relative = "") {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const name = path.join(relative, entry.name), source = path.join(dir, entry.name);
    if (entry.isDirectory()) { await collect(source, name); continue; }
    if (!entry.isFile()) throw new Error(`Unsupported public asset: ${name}`);
    if (assets.has(name) && !(await readFile(assets.get(name))).equals(await readFile(source))) throw new Error(`Conflicting public asset: ${name}`);
    assets.set(name, source);
  }
}
await collect(path.join(root, "apps/buyer-web/public"));
await collect(path.join(root, "apps/landing-web/public"));
for (const [name, source] of assets) {
  const destination = path.join(target, "public", name);
  await mkdir(path.dirname(destination), { recursive: true }); await copyFile(source, destination);
}
// Use Next's existing CSS parser, not a second styling library. Scope legacy
// global auth styles so navigating to a workspace cannot leak body/link rules.
const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve("next/package.json"));
const postcss = nextRequire("postcss");
const css = postcss.parse(await readFile(path.join(root, "apps/landing-web/app/styles.css"), "utf8"));
css.walkRules(rule => {
  if (rule.parent.type === "atrule" && /keyframes$/.test(rule.parent.name)) return;
  rule.selectors = rule.selectors.map(selector => {
    if ([":root", "html", "body"].includes(selector)) return ":where(.unified-auth)";
    if (selector.startsWith("html[")) return selector.replace(/^(html\[[^\]]+\])\s*/, "$1 :where(.unified-auth) ");
    return `:where(.unified-auth) ${selector}`;
  });
});
await mkdir(path.join(target, "generated"), { recursive: true });
await writeFile(path.join(target, "generated/auth.css"), css.toString());
console.log(`Unified assets prepared: ${assets.size}; auth CSS scoped.`);
