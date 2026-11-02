import { workspaceOrderStatusSchema } from "../../../packages/schemas/src/workspace-reads";
import { copy, statusLabel } from "./i18n";

it.each(["ru", "kk"] as const)("covers every authoritative known order status and keeps unknown values safe in %s", locale => {
  for (const status of workspaceOrderStatusSchema.options) {
    const label = statusLabel(status, locale);
    expect(label.trim().length).toBeGreaterThan(0);
    expect(label).not.toBe(status);
    expect(label).not.toBe(copy[locale].unknownStatus);
  }
  for (const status of ["SYNTHETIC_FUTURE_ORDER", "", "__proto__", "constructor", "toString"]) {
    expect(statusLabel(status, locale)).toBe(copy[locale].unknownStatus);
  }
});
