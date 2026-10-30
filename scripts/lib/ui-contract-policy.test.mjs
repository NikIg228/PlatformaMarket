import { test } from "node:test";
import assert from "node:assert/strict";
import { declarationIssues, inlineIssues, targetsBoxedControl, controlDeclarationIssue, isSharedStylesheet } from "./ui-contract-policy.mjs";

test("extracted contract modules retain ownership without exempting page or arbitrary package CSS", () => {
  for (const file of ["packages/ui/src/styles.css", "packages/ui/src/styles/controls.css", "packages/ui/src/styles/tokens-base.css"])
    assert.equal(isSharedStylesheet(file), true, file);
  for (const file of ["apps/web/styles.css", "apps/web/styles/controls.css", "packages/ui/src/styles/custom.css", "packages/ui/src/styles/../custom.css"])
    assert.equal(isSharedStylesheet(file), false, file);
  const focus = { prop: "outline", value: "1px solid var(--dm-focus-ring)", selector: ".dm-button:focus-visible" };
  assert.deepEqual(declarationIssues({ ...focus, shared: isSharedStylesheet("packages/ui/src/styles/controls.css") }), []);
  assert.ok(declarationIssues({ ...focus, shared: isSharedStylesheet("apps/web/styles/controls.css") }).length);
  assert.ok(declarationIssues({ prop: "color", value: "#ff0000", shared: true }).length);
});

test("local control geometry is blocked even with valid tokens; descendant layout is allowed", () => {
  const classes = new Set(["save"]);
  for (const selector of [".save:hover", ".toolbar > .save", ".panel :global(.fui-Input)"])
    assert.equal(targetsBoxedControl(selector, classes), true, selector);
  for (const selector of [".save svg", ".save > span", ".toolbar", ".panel:has(.save)"])
    assert.equal(targetsBoxedControl(selector, classes), false, selector);
  assert.equal(controlDeclarationIssue("border-radius"), true);
  assert.equal(controlDeclarationIssue("min-height"), true);
  assert.equal(controlDeclarationIssue("width"), false);
  assert.equal(controlDeclarationIssue("margin-left"), false);
});

test("rejects off-contract typography, geometry and colours", () => {
  for (const [prop, value] of [["border-radius", "7px"], ["font-size", "13px"], ["font-weight", "650"], ["gap", "11px"], ["padding", "0 10px"], ["background", "#ffffff"], ["color", "rgb(0 0 0)"], ["color", "var(--colorPaletteRedForeground1)"]])
    assert.ok(declarationIssues({ prop, value }).length, `${prop}: ${value}`);
  assert.ok(inlineIssues("fontSize", 13).length);
  assert.ok(inlineIssues("borderRadius", 8).length);
});

test("preserves intentional layout, semantic tokens and hidden geometry", () => {
  for (const [prop, value] of [["border-radius", "0"], ["border-radius", "inherit"], ["font-size", "clamp(var(--dm-font-size-page), 3vw, var(--dm-font-size-display))"], ["margin", "0 auto"], ["margin", "-1px"], ["gap", "var(--dm-space-3)"], ["background", "color-mix(in srgb, var(--dm-surface) 90%, transparent)"], ["width", "640px"], ["box-shadow", "inset 3px 0 var(--dm-brand-primary)"]])
    assert.deepEqual(declarationIssues({ prop, value }), [], `${prop}: ${value}`);
  assert.deepEqual(inlineIssues("padding", 0), []);
});

test("focus is owned by the shared layer while state borders stay available", () => {
  assert.ok(declarationIssues({ prop: "outline", value: "1px solid var(--dm-focus-ring)", selector: ".button:focus-visible" }).length);
  assert.deepEqual(declarationIssues({ prop: "outline", value: "1px solid var(--dm-focus-ring)", selector: ".button:focus-visible", shared: true }), []);
  assert.deepEqual(declarationIssues({ prop: "border-color", value: "var(--dm-danger-text)", selector: ".field:focus-within" }), []);
});
