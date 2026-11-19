import { afterEach, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import type { OrderWorkflowResponse } from "@marketplace/schemas";
vi.mock("./actions", () => ({ DmButton: "button" }));
import { OrderDetailOverview } from "./order-detail-overview";
import { DmButton } from "./actions";

const data = { status: "PARTIALLY_CONFIRMED", paymentStatus: "UNPAID", claims: [], returns: [], events: [], order: { id: "order", items: [] } } as unknown as OrderWorkflowResponse;
function findButton(node: ReactNode): ReactElement<{ onClick: () => void }> | undefined {
  if (!node || typeof node !== "object" || !("props" in node)) return;
  const element = node as ReactElement<{ children?: ReactNode; onClick: () => void }>;
  if (element.type === DmButton) return element;
  for (const child of [element.props.children].flat(Infinity)) {
    const found = findButton(child as ReactNode);
    if (found) return found;
  }
}
afterEach(() => vi.unstubAllGlobals());
it("opens the composition before focusing it when returning from another tab", () => {
  const disclosure = { open: false };
  const focus = vi.fn(() => expect(disclosure.open).toBe(true));
  vi.stubGlobal("document", { getElementById: vi.fn(() => ({ closest: () => disclosure, focus })) });
  const onTab = vi.fn();
  const tree = OrderDetailOverview({ data, supplier: false, activeTab: "documents", onTab });
  findButton(tree)!.props.onClick();
  expect(focus).toHaveBeenCalledOnce();
  expect(onTab).not.toHaveBeenCalled();
});
it("does not add a duplicate jump action when the current step is already visible", () => {
  const tree = OrderDetailOverview({ data, supplier: false, activeTab: "payment", onTab: vi.fn() });
  expect(findButton(tree)).toBeUndefined();
});
