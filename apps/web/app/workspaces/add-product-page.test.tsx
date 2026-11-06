import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ query: "", allowed: true, required: [] as string[], api: {} }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(state.query) }));
vi.mock("./workspace", () => ({ useWorkspace: () => ({ api: state.api, organizationId: "supplier-a", locale: "ru" }) }));
vi.mock("@marketplace/ui/permissions", () => ({
  usePermissions: () => (...required: string[]) => { state.required = required; return state.allowed; },
  PermissionFields: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("../../../supplier-web/app/features/supplier-workspace/add-offer-wizard", () => ({
  AddOfferWizard: ({ api, supplierId }: { api: unknown; supplierId: string }) => <p>{api === state.api ? "wizard" : "wrong api"}:{supplierId}</p>,
}));
vi.mock("../../../supplier-web/app/features/supplier-workspace/product-proposal-form", () => ({
  ProductProposalForm: ({ api }: { api: unknown }) => <p>{api === state.api ? "proposal" : "wrong api"}</p>,
}));

import Page from "../supplier/products/new/page";

describe("product creation route", () => {
  beforeEach(() => { state.query = ""; state.allowed = true; state.required = []; });

  it("opens the offer wizard with the current organization and API", () => {
    const html = renderToStaticMarkup(<Page />);
    expect(html).toContain('aria-label="Добавить товар"');
    expect(html).toContain("wizard:supplier-a");
    expect(state.required).toEqual(["catalog.offer.edit", "catalog.product.view"]);
  });

  it("opens the candidate form only for request=1", () => {
    state.query = "request=1";
    expect(renderToStaticMarkup(<Page />)).toContain("proposal");
    state.query = "request=0";
    expect(renderToStaticMarkup(<Page />)).toContain("wizard:supplier-a");
  });

  it("does not render either form without the required permission", () => {
    state.allowed = false;
    const html = renderToStaticMarkup(<Page />);
    expect(html).toContain('role="status"');
    expect(html).not.toContain("wizard");
    expect(html).not.toContain("proposal");
  });
});
