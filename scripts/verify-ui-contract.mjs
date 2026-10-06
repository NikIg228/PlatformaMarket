import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { controlStyleProperties, declarationIssues, inlineIssues, targetsBoxedControl, controlDeclarationIssue } from "./lib/ui-contract-policy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const postcss = createRequire(require.resolve("next/package.json"))("postcss");
const ignored = new Set(["node_modules", "generated", "dist", "test-results", "playwright-report", "coverage"]);
function filesIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith(".") || ignored.has(entry.name)) return [];
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(target) : /\.(?:css|tsx)$/.test(entry.name) && !/\.(?:test|spec)\./.test(entry.name) ? [target] : [];
  });
}
const files = [...filesIn(path.join(root, "apps")), ...filesIn(path.join(root, "packages/ui/src"))];
const sources = files.map(file => ({ file: path.relative(root, file).replaceAll("\\", "/"), text: readFileSync(file, "utf8") }));
const issues = [];
const add = (file, line, message) => issues.push(`${file}:${line}: ${message}`);
const definitions = new Set();
const controlClasses = new Map();
const globalClasses = new Set(["dm-button", "dm-control", "dm-input", "dm-select", "dm-textarea", "dm-dropdown", "dm-combobox", "dm-file-input", "dm-link-button"]);
for (const { file, text } of sources.filter(source => source.file.endsWith(".tsx"))) {
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const controls = new Set(), modules = new Map();
  for (const node of ast.statements) if (ts.isImportDeclaration(node)) {
    if (node.moduleSpecifier.text.endsWith(".css") && node.importClause?.name)
      modules.set(node.importClause.name.text, path.posix.join(path.posix.dirname(file), node.moduleSpecifier.text));
    const bindings = node.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const item of bindings.elements)
      if (/^Dm(?:Button|Input|Select|Textarea|Dropdown|FluentDropdown|Combobox|FileInput)$/.test((item.propertyName ?? item.name).text)) controls.add(item.name.text);
  }
  function visit(node) {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && controls.has(node.tagName.getText(ast))) {
      const value = node.attributes.properties.find(item => ts.isJsxAttribute(item) && item.name.text === "className")?.initializer;
      if (value) {
        if (ts.isStringLiteral(value)) for (const name of value.text.split(/\s+/)) globalClasses.add(name);
        function collect(item) {
          if (ts.isPropertyAccessExpression(item) && modules.has(item.expression.getText(ast))) {
            const css = modules.get(item.expression.getText(ast));
            if (!controlClasses.has(css)) controlClasses.set(css, new Set());
            controlClasses.get(css).add(item.name.text);
          }
          ts.forEachChild(item, collect);
        }
        collect(value);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}
for (const { text } of sources) for (const match of text.matchAll(/(--dm-[\w-]+)\s*:/g)) definitions.add(match[1]);
let declarations = 0, components = 0;
for (const { file, text } of sources) {
  for (const match of text.matchAll(/var\(\s*(--dm-[\w-]+)/g)) if (!definitions.has(match[1])) add(file, text.slice(0, match.index).split("\n").length, `Undefined token ${match[1]}`);
  if (file.endsWith(".css")) {
    const css = postcss.parse(text, { from: file });
    css.walkDecls(decl => {
      declarations++;
      for (const message of declarationIssues({ prop: decl.prop, value: decl.value, selector: decl.parent.selector, shared: file === "packages/ui/src/styles.css" })) add(file, decl.source.start.line, `${message} (${decl.prop})`);
      if (decl.prop.startsWith("--dm-") && file !== "packages/ui/src/styles.css") add(file, decl.source.start.line, "Define Market tokens in the shared contract only.");
      if (file !== "packages/ui/src/styles.css" && targetsBoxedControl(decl.parent.selector ?? "", new Set([...globalClasses, ...(controlClasses.get(file) ?? [])])) && controlDeclarationIssue(decl.prop))
        add(file, decl.source.start.line, `Move ${decl.prop} into the shared control variant (${decl.parent.selector}).`);
    });
    continue;
  }
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const controls = new Set();
  for (const node of ast.statements) {
    if (!ts.isImportDeclaration(node) || !node.importClause?.namedBindings || !ts.isNamedImports(node.importClause.namedBindings)) continue;
    for (const item of node.importClause.namedBindings.elements) if (/^Dm(?:Button|Input|Select|Textarea|Dropdown|FluentDropdown|Combobox|FileInput)$/.test((item.propertyName ?? item.name).text)) controls.add(item.name.text);
  }
  function inspect(node) {
    const line = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      components++;
      if (controls.has(node.tagName.getText(ast))) {
        const style = node.attributes.properties.find(item => ts.isJsxAttribute(item) && item.name.text === "style")?.initializer;
        if (style && ts.isJsxExpression(style) && style.expression && ts.isObjectLiteralExpression(style.expression)) for (const property of style.expression.properties) if (ts.isPropertyAssignment(property) && controlStyleProperties.test(property.name.getText(ast))) add(file, line, `Move ${property.name.getText(ast)} into the shared control variant.`);
      }
    }
    if (ts.isPropertyAssignment(node)) {
      const name = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : "";
      const value = ts.isNumericLiteral(node.initializer) ? Number(node.initializer.text) : ts.isStringLiteral(node.initializer) ? node.initializer.text : null;
      if (value !== null) for (const message of inlineIssues(name, value)) add(file, line, `${message} (${name})`);
    }
    ts.forEachChild(node, inspect);
  }
  inspect(ast);
}
if (issues.length) {
  console.error(issues.slice(0, 60).join("\n"));
  console.error(`UI contract: ${issues.length} issue(s); ${sources.length} source files inspected.`);
  process.exitCode = 1;
} else console.log(`UI contract PASS: ${sources.length} CSS/TSX files, ${declarations} declarations, ${components} JSX controls/elements; no token/style drift.`);
