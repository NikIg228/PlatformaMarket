import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("@marketplace/ui", () => ({
  formatMoney: (amount: string) => amount,
  DmFeedback: ({ title, description }: { title: string; description: string }) => createElement("aside", null, title, description),
}));
import { OrderDecisionDetails } from "./order-decision-details";

const order = { status: "PARTIALLY_CONFIRMED", subtotalAmountMinor: "120000", currency: "KZT", items: [{ id: "item", quantity: "5", acceptedQuantity: "3", decisionReason: "Остаток ограничен", status: "PARTIALLY_CONFIRMED", offer: { productVariant: { product: { canonicalName: "Товар" } } } }] };
it("retains the changed quantities, reasons and total beside the shared warning", () => {
  const html = renderToStaticMarkup(<OrderDecisionDetails order={order} />);
  expect(html).toContain("Состав заказа изменён"); expect(html).toContain("Остаток ограничен");
  expect(html).toContain("3"); expect(html).toContain("120000");
});
it("does not invent a warning for an unchanged order", () => {
  expect(renderToStaticMarkup(<OrderDecisionDetails order={{ ...order, status: "CONFIRMED", items: order.items.map(item => ({ ...item, acceptedQuantity: "5" })) }} />)).toBe("");
});
