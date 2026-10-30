import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { SupplierIdentity } from "./supplier-identity";
it("uses a keyboard accessible public catalog link for comparison and search suppliers", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  for (const supplier of [{ organizationId: id, name: "Поставщик" }, { id, name: "Поставщик" }]) {
    const html = renderToStaticMarkup(<SupplierIdentity supplier={supplier} />);
    expect(html).toContain(`href="/catalog/suppliers/${id}"`);
    expect(html).toContain("Витрина поставщика Поставщик");
    expect(html).not.toContain('href="/supplier/');
  }
});
