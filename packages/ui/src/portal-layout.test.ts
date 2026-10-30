import { readStyleSource } from "./read-style-source.test-helper";
import { expect, it } from "vitest";

it("keeps page geometry on the root provider, never on Fluent portal hosts", () => {
  const css = readStyleSource(new URL("./styles.css", import.meta.url));
  expect(css).toMatch(/\.mp-provider:not\(\[data-portal-node\]\)\s*\{[^}]*min-height:\s*100dvh;[^}]*background:/);
  expect(css).not.toMatch(/\.mp-provider\s*\{/);
  // Don't hide the symptom by disabling pointer events on dialogs/popovers.
  expect(css).not.toMatch(/\[data-portal-node\][^{]*\{[^}]*pointer-events:\s*none/);
});
