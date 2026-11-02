import { StrictMode } from "react";
import { jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import App from "../App";
import * as reads from "./read-controller";
import { workspaceOrderPageSchema } from "../../../packages/schemas/src/workspace-reads";
import { orderWorkflowResponseSchema } from "../../../packages/schemas/src/order-workflow";
import { orderCommentCreateCopy } from "./OrderCommentCreateCommandUi";
import { commentEditCopy } from "./OrderCommentEditCommandUi";
import { orderCommentsCopy } from "./OrderCommentsRead";
import type { OrderCommentCreateFixture } from "./order-comment-create-command";
import type { OrderCommentEditFixture } from "./order-comment-edit-command";
import { commentCreateScope as scope, commentCreateId as id, commentCreateAuthorization } from "./test-fixtures/order-comment-create-command";
import { commentEditAuthorization, commentEditRawRow, commentEditResult } from "./test-fixtures/order-comment-edit-command";
import { commentWorkflow } from "./test-fixtures/order-comments";
import { listDraftPayload } from "./test-fixtures/list-draft";
import { cartCommandError } from "./test-fixtures/cart-commands";
import { captureHardwareBack } from "./test-fixtures/hardware-back";
import { copy } from "./i18n";
import type { Locale } from "./format-wire";

const realCreateController = reads.createReadController;
const scenarios = (["ru", "kk"] as const).flatMap(locale => (["create", "edit"] as const).flatMap(preparation => ([401, 403] as const).flatMap(status => (["ready", "network"] as const).map(parent => ({ locale, preparation, status, parent })))));
afterEach(() => jest.restoreAllMocks());
function setup(status: 401 | 403) {
  const first = commentWorkflow(), second = orderWorkflowResponseSchema.parse({ ...first, orderId: id(99502), order: { ...first.order, id: id(99502), orderNumber: "SYNTHETIC-SECOND-002" } });
  const page = workspaceOrderPageSchema.parse(listDraftPayload("workspace-orders-page")), row = page.items[0]!;
  page.items = [first, second].map(workflow => ({ ...row, id: workflow.orderId, orderNumber: workflow.order.orderNumber }));
  const key = jest.fn(() => "SYNTHETIC-comment-authority-key"), send = jest.fn<OrderCommentCreateFixture["createOrderComment"]>(async () => { throw cartCommandError(status); });
  const edit = jest.fn<OrderCommentEditFixture["updateOrderComment"]>(async (_scope, _id, input) => commentEditResult(commentEditRawRow(), input));
  const commentRead = jest.fn(async (_scope: typeof scope, orderId: string): Promise<unknown> => [{ ...commentEditRawRow(), supplierOrderId: orderId, id: orderId === first.orderId ? commentEditRawRow().id : id(99503) }]);
  const client: reads.MobileReadClient = {
    searchCatalog: async () => listDraftPayload("catalog-null-price"), compareOffers: async () => listDraftPayload("comparison-exact-offer"), workspaceOrders: async () => page,
    getOrderWorkflow: async orderId => orderId === first.orderId ? first : second, orderCommentsFixture: commentRead,
    orderCommentCreateCommandFixture: { authorization: commentCreateAuthorization(), nextOrderCommentIdempotencyKey: key, createOrderComment: send },
    orderCommentEditCommandFixture: { authorization: commentEditAuthorization(), updateOrderComment: edit },
  };
  return { client, first, second, commentRead, key, send, edit };
}
async function openOrderComments(locale: Locale, orderNumber: string) {
  await fireEvent.press(screen.getByRole("tab", { name: copy[locale].orders }));
  await screen.findByRole("button", { name: `${copy[locale].open}: ${orderNumber}` }); await fireEvent.press(screen.getByRole("button", { name: `${copy[locale].open}: ${orderNumber}` }));
  await screen.findByRole("button", { name: orderCommentsCopy[locale].open }); await fireEvent.press(screen.getByRole("button", { name: orderCommentsCopy[locale].open }));
}

it.each(scenarios)("hidden $preparation preparation survives normal Back after another order HTTP$status in $locale/$parent", async ({ locale, preparation, status, parent }) => {
  const controllers: reads.ReadController[] = [];
  jest.spyOn(reads, "createReadController").mockImplementation(input => { const controller = realCreateController(input); controllers.push(controller); return controller; });
  const s = setup(status), hardware = captureHardwareBack(), t = orderCommentCreateCopy[locale], e = commentEditCopy[locale], c = copy[locale], raw = "  SYNTHETIC retained private draft\nСақталған пікір  ";
  const view = await render(<StrictMode><App session={{ client: s.client, scope, organizationName: "SYNTHETIC" }} locale={locale} /></StrictMode>);
  try {
    await screen.findByText("SYNTHETIC product"); await openOrderComments(locale, s.first.order.orderNumber); await screen.findByRole("button", { name: t.start });
    const action = preparation === "create" ? t : e;
    await fireEvent.press(screen.getByRole("button", { name: preparation === "create" ? t.start : `${e.start}: ${e.comment} 1` }));
    await screen.findByLabelText(action.body); await fireEvent.changeText(screen.getByLabelText(action.body), raw); await fireEvent.press(screen.getByRole("button", { name: action.preview })); await screen.findByText(action.reviewTitle);
    const rowId = commentEditRawRow().id;
    const active = controllers.filter(controller => (preparation === "create" ? controller.orderCommentCreateCommands.stateFor(s.first.orderId) : controller.orderCommentEditCommands.stateFor(rowId)).phase === "prepared");
    expect(active).toHaveLength(1); const controller = active[0]!;
    const retained = () => preparation === "create" ? controller.orderCommentCreateCommands.stateFor(s.first.orderId) : controller.orderCommentEditCommands.stateFor(rowId);
    const original = retained(); expect(original.phase).toBe("prepared");
    await openOrderComments(locale, s.second.order.orderNumber); await screen.findByRole("button", { name: t.start }); await fireEvent.press(screen.getByRole("button", { name: t.start }));
    await screen.findByLabelText(t.body); await fireEvent.changeText(screen.getByLabelText(t.body), "SYNTHETIC second order request"); await fireEvent.press(screen.getByRole("button", { name: t.preview })); await screen.findByRole("button", { name: t.confirm }); await fireEvent.press(screen.getByRole("button", { name: t.confirm })); await screen.findAllByText(status === 401 ? t.auth : t.denied);
    expect(controller.orderCommentCreateCommands.authorityIssue()).toBe(status === 401 ? "authentication" : "denied"); expect(controller.orderCommentEditCommands.authorityIssue()).toBe(status === 401 ? "authentication" : "denied");
    if (parent === "network") s.commentRead.mockRejectedValueOnce(Error("SYNTHETIC retained order read unavailable"));
    await openOrderComments(locale, s.first.order.orderNumber);
    if (parent === "network") await screen.findByRole("button", { name: c.retry }); else await screen.findAllByText(status === 401 ? t.auth : t.denied);
    expect(screen.queryByRole("button", { name: t.edit })).toBeNull(); expect(screen.queryByRole("button", { name: e.edit })).toBeNull(); expect(screen.queryByText(new RegExp("retained private draft"))).toBeNull();
    expect(retained()).toBe(original); const readsBefore = s.commentRead.mock.calls.length, keysBefore = s.key.mock.calls.length, sendsBefore = s.send.mock.calls.length;
    expect(await hardware.press()).toBe(true);
    expect(retained()).toBe(original); expect(retained().phase).toBe("prepared");
    await screen.findByRole("button", { name: orderCommentsCopy[locale].open }); expect(s.commentRead).toHaveBeenCalledTimes(readsBefore); expect(s.key).toHaveBeenCalledTimes(keysBefore); expect(s.send).toHaveBeenCalledTimes(sendsBefore); expect(s.send).toHaveBeenCalledTimes(1); expect(s.send.mock.calls[0]![1]).toBe(s.second.orderId); expect(s.edit).not.toHaveBeenCalled();
  } finally { await view.unmount(); const remaining = hardware.handlers.size; hardware.restore(); expect(remaining).toBe(0); }
});
