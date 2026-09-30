import { describe, expect, it } from "vitest";
import { workspaceReturnPath, withWorkspaceReturn } from "./product-navigation";
describe("new workspace return pages", () => {
  it.each(["/clinic/cart", "/clinic/orders", "/clinic/settings"])(
    "preserves clinic destination %s only for the buyer",
    (path) => {
      expect(workspaceReturnPath(path, "BUYER")).toBe(path);
      expect(workspaceReturnPath(path, "SUPPLIER")).toBeUndefined();
    },
  );
  it.each(["/supplier/products", "/supplier/orders", "/supplier/settings"])(
    "preserves supplier destination %s only for the supplier",
    (path) => {
      expect(workspaceReturnPath(path, "SUPPLIER")).toBe(path);
      expect(workspaceReturnPath(path, "BUYER")).toBeUndefined();
    },
  );
  it("never treats action URLs or unknown query parameters as a destination", () => {
    for (const path of [
      "/supplier/products/delete",
      "/clinic/cart/checkout",
      "/supplier/settings?organizationId=other",
      "//evil.test/clinic/cart",
      "/clinic/cart?checkout=true",
    ])
      expect(workspaceReturnPath(path)).toBeUndefined();
    expect(withWorkspaceReturn("/login", "/clinic/cart")).toBe(
      "/login?returnTo=%2Fclinic%2Fcart",
    );
  });
});
