import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import type { OrderWorkflowResponse } from "@marketplace/schemas";

const harness = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, effects: [] as (() => (() => void))[], allowed: true }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const slot = harness.cursor++;
    if (!(slot in harness.slots)) harness.slots[slot] = initial;
    return [harness.slots[slot], (value: unknown) => { harness.slots[slot] = value; }];
  },
  useRef: (initial: unknown) => {
    const slot = harness.cursor++;
    if (!(slot in harness.slots)) harness.slots[slot] = { current: initial };
    return harness.slots[slot];
  },
  useId: () => "test",
  useCallback: (callback: unknown) => callback,
  useEffect: (callback: () => (() => void)) => { harness.effects.push(callback); },
}));
vi.mock("./permissions", () => ({ usePermissions: () => () => harness.allowed }));
vi.mock("@fluentui/react-components", () => ({ Tab: "tab" }));
vi.mock("./actions", () => ({ DmButton: "button" }));
vi.mock("./primitives", () => ({ DmFeedback: "feedback", LoadingState: "loading", Section: "section" }));
vi.mock("./controls", () => ({ DmTabList: "tabs" }));
vi.mock("./OrderWorkflowHistory", () => ({ OrderWorkflowHistory: "history" }));
vi.mock("./OrderCancellationForm", () => ({ OrderCancellationForm: "cancellation" }));
vi.mock("./OrderTransferUpload", () => ({ OrderTransferUpload: "upload" }));
vi.mock("./order-discrepancy-panel", () => ({ OrderDiscrepancyPanel: "discrepancy" }));
vi.mock("./order-shipment-receipt", () => ({ OrderShipmentReceipts: "receipts" }));
vi.mock("./order-supplier-contacts", () => ({ OrderSupplierContacts: "contacts" }));
vi.mock("./order-detail-overview", () => ({ OrderDetailOverview: "overview", OrderDetailItems: "items", OrderDetailDocuments: "documents" }));
vi.mock("./manual-payment-panels", () => ({ PaymentSummaryPanel: "summary", TransferReviewPanel: "review", PaymentReductionPanel: "reduction" }));
vi.mock("./order-invoice-panel", () => ({ useOrderInvoices: () => ({}), OrderInvoicePanel: "invoice", OrderInvoiceHistory: "invoices" }));
import { OrderWorkflowWorkspace } from "./order-workflow-workspace";
import { OrderWorkflowFeedback } from "./order-workflow-feedback";
import { OrderDetailItems } from "./order-detail-overview";
import { TransferReviewPanel } from "./manual-payment-panels";

type Element = ReactElement<Record<string, unknown>>;
function find(node: ReactNode, type: unknown): Element | undefined {
  if (!node || typeof node !== "object" || !("props" in node)) return;
  const element = node as Element;
  if (element.type === type) return element;
  for (const child of [element.props.children].flat(Infinity)) {
    const found = find(child as ReactNode, type);
    if (found) return found;
  }
}
let snapshot: OrderWorkflowResponse;
const api = { getOrderWorkflow: vi.fn(), executeOrderWorkflow: vi.fn(), uploadDocument: vi.fn() };
function render() {
  harness.cursor = 0;
  const wrapper = OrderWorkflowWorkspace({ orderId: "order", organizationId: "buyer", api, onDownload: vi.fn() });
  return (wrapper.type as (props: typeof wrapper.props) => ReactElement)(wrapper.props);
}
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
const feedback = () => find(render(), OrderWorkflowFeedback)!.props;
let cleanup: (() => void) | undefined;
beforeEach(async () => {
  vi.useFakeTimers();
  harness.slots = []; harness.effects = []; harness.allowed = true;
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubGlobal("document", { hidden: false });
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  snapshot = { version: 3, status: "PARTIALLY_CONFIRMED", paymentStatus: "UNPAID", claims: [], returns: [], events: [], order: { id: "order", orderNumber: "TEST", buyerOrganizationId: "buyer", supplierOrganizationId: "supplier", subtotalAmountMinor: "100", currency: "KZT", items: [] } } as unknown as OrderWorkflowResponse;
  api.getOrderWorkflow.mockReset().mockImplementation(async () => snapshot);
  api.executeOrderWorkflow.mockReset();
  render(); cleanup = harness.effects[0](); await flush();
});
afterEach(() => { cleanup?.(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it("recovers through the visible control after polling removes the committed action, then permits the next command", async () => {
  api.executeOrderWorkflow.mockImplementationOnce(async () => {
    snapshot = { ...snapshot, version: 4, status: "CONFIRMED" };
    throw new TypeError("response lost after commit");
  });
  const action = find(render(), OrderDetailItems)!.props.action as Element;
  (action.props.onClick as () => void)(); await flush();
  const sent = api.executeOrderWorkflow.mock.calls[0][1];
  await vi.advanceTimersByTimeAsync(5000);
  expect(find(render(), OrderDetailItems)!.props.action).toBeUndefined();
  expect(feedback()).toMatchObject({ recovery: true, notice: "", busy: false });
  let resolve!: (value: object) => void;
  api.executeOrderWorkflow.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const retry = feedback().retry as () => void;
  retry(); retry();
  expect(api.executeOrderWorkflow).toHaveBeenCalledTimes(2);
  expect(api.executeOrderWorkflow.mock.calls[1][1]).toBe(sent);
  expect(feedback().busy).toBe(true);
  resolve({ orderId: "order", version: 4 }); await flush();
  expect(feedback()).toMatchObject({ recovery: false, busy: false, notice: expect.stringContaining("сохранено") });
  api.executeOrderWorkflow.mockResolvedValueOnce({ orderId: "order", version: 5 });
  await (find(render(), TransferReviewPanel)!.props.perform as (action: object) => Promise<void>)({ action: "CANCEL", reason: "Передумали", transferNotMade: true });
  expect(api.executeOrderWorkflow.mock.calls[2][1]).toMatchObject({ action: "CANCEL", expectedVersion: 4 });
  expect(api.executeOrderWorkflow.mock.calls[2][1].idempotencyKey).not.toBe(sent.idempotencyKey);
});

it("retains recovery through another failure, respects lost permission, and clears on definitive rejection", async () => {
  api.executeOrderWorkflow.mockRejectedValueOnce(new TypeError("offline")).mockRejectedValueOnce({ status: 503 }).mockRejectedValueOnce({ status: 409 });
  const action = find(render(), OrderDetailItems)!.props.action as Element;
  (action.props.onClick as () => void)(); await flush();
  (feedback().retry as () => void)(); await flush();
  expect(feedback()).toMatchObject({ recovery: true, notice: "" });
  harness.allowed = false;
  expect(feedback().canRecover).toBe(false);
  (feedback().retry as () => void)(); await flush();
  expect(api.executeOrderWorkflow).toHaveBeenCalledTimes(2);
  harness.allowed = true;
  (feedback().retry as () => void)(); await flush();
  expect(feedback()).toMatchObject({ recovery: false, notice: "", busy: false });
});

it("offers replay instead of a GET-only recovery and disables it while busy or unauthorized", () => {
  const retry = vi.fn(); const refresh = vi.fn();
  const props = { error: "offline", notice: "", recovery: true, busy: false, canRecover: true, retry, refresh };
  const tree = OrderWorkflowFeedback(props);
  const button = find(tree, "feedback")!.props.action as Element;
  expect(button.props.children).toBe("Восстановить результат");
  (button.props.onClick as () => void)();
  expect(retry).toHaveBeenCalledOnce(); expect(refresh).not.toHaveBeenCalled();
  for (const state of [{ busy: true }, { canRecover: false }]) {
    const action = find(OrderWorkflowFeedback({ ...props, ...state }), "feedback")!.props.action as Element;
    expect(action.props.disabled).toBe(true);
  }
});
