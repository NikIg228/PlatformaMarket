import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SupplierOffers, type SupplierOffer } from "./supplier-offers";

vi.mock("../../workspace-session", () => ({ useVerifiedSession: () => ({ session: null, ready: true }), sessionApiContext: {} }));

describe("public supplier contacts", () => {
  it("renders only the official contact and keeps older offers without contact readable", () => {
    const official = { contactName: "Официальный представитель", phone: "+7 (700) 000-00-00", email: "office@example.invalid" };
    const offer: SupplierOffer = { id: "offer", supplier: { name: "Поставщик", publicContact: official }, priceMinor: "10000", currency: "KZT", available: true };
    const html = renderToStaticMarkup(<SupplierOffers offers={[offer]} loginHref="/login" />);
    expect(html).toContain("Официальный представитель");
    expect(html).toContain('href="tel:+77000000000"');
    expect(html).toContain('href="mailto:office@example.invalid"');
    const legacy = renderToStaticMarkup(<SupplierOffers offers={[{ ...offer, supplier: { name: "Поставщик" } }]} loginHref="/login" />);
    expect(legacy).toContain("Поставщик");
    expect(legacy).not.toContain('href="tel:');
  });
});
