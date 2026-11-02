import { StrictMode } from "react";
import { jest } from "@jest/globals";
import { BackHandler } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import App from "../App";
import type { MobileReadClient } from "./read-controller";
import { savedListCreateCopy } from "./SavedListCreateCommandUi";
import { savedListItemCopy } from "./SavedListItemCommandUi";
import { savedListRemoveCopy } from "./SavedListRemoveCommandUi";
import { orderCommentCreateCopy } from "./OrderCommentCreateCommandUi";
import { commentEditCopy } from "./OrderCommentEditCommandUi";
import { orderCommentsCopy } from "./OrderCommentsRead";
import { savedListCreateScope as scope, savedListCreatePage, savedListCreateAuthorization, savedListCreateResult } from "./test-fixtures/saved-list-create-command";
import { commentCreateAuthorization, commentCreateResult } from "./test-fixtures/order-comment-create-command";
import { commentEditAuthorization, commentEditRawRow, commentEditResult } from "./test-fixtures/order-comment-edit-command";
import { commentWorkflow } from "./test-fixtures/order-comments";
import { listDraftPayload, listDraftComparison } from "./test-fixtures/list-draft";
import { savedListWriteAuthorization, savedListWriteResult } from "./test-fixtures/saved-list-item-command";
import { copy } from "./i18n";
import type { Locale } from "./format-wire";
import type { SavedListCreateFixture } from "./saved-list-create-command";
import type { OrderCommentCreateFixture } from "./order-comment-create-command";
import type { OrderCommentEditFixture } from "./order-comment-edit-command";
import type { SavedListItemCommandFixture } from "./saved-list-item-command";
import type { SavedListRemoveFixture } from "./saved-list-remove-command";
import { cartCommandError } from "./test-fixtures/cart-commands";

afterEach(() => jest.restoreAllMocks());
function setup() {
  const listRead = jest.fn(async () => savedListCreatePage().map(list => ({ ...list, createdById: scope.userId }))), commentRead = jest.fn(async () => [commentEditRawRow()]), createList = jest.fn<SavedListCreateFixture["createSavedList"]>(async (_scope, input) => savedListCreateResult(input)), createComment = jest.fn<OrderCommentCreateFixture["createOrderComment"]>(async (_scope, id, input) => commentCreateResult(id, input)), editComment = jest.fn<OrderCommentEditFixture["updateOrderComment"]>(async (_scope, _id, input) => commentEditResult(commentEditRawRow(), input)), key = jest.fn(() => "SYNTHETIC-inline-back-key");
  const upsertList = jest.fn<SavedListItemCommandFixture["upsertSavedListItem"]>(async (_scope, id, input) => savedListWriteResult(id, input)), removeList = jest.fn<SavedListRemoveFixture["removeSavedListItem"]>(async () => ({ deleted: true })), compare = jest.fn(async () => listDraftComparison());
  const client: MobileReadClient = {
    searchCatalog: async () => listDraftPayload("catalog-null-price"), compareOffers: compare, workspaceOrders: async () => listDraftPayload("workspace-orders-page"), getOrderWorkflow: async () => commentWorkflow(),
    savedListsFixture: listRead, savedListCreateCommandFixture: { authorization: savedListCreateAuthorization(), createSavedList: createList }, orderCommentsFixture: commentRead,
    orderCommentCreateCommandFixture: { authorization: commentCreateAuthorization(), nextOrderCommentIdempotencyKey: key, createOrderComment: createComment }, orderCommentEditCommandFixture: { authorization: commentEditAuthorization(), updateOrderComment: editComment },
    savedListItemCommandFixture: { authorization: savedListWriteAuthorization(), upsertSavedListItem: upsertList }, savedListRemoveCommandFixture: { authorization: savedListWriteAuthorization(), removeSavedListItem: removeList },
  };
  return { client, listRead, commentRead, createList, createComment, editComment, key, upsertList, removeList, compare };
}
function hardware() {
  type Handler = Parameters<typeof BackHandler.addEventListener>[1];
  const handlers = new Set<Handler>();
  jest.spyOn(BackHandler, "addEventListener").mockImplementation((_name, handler) => { handlers.add(handler); return { remove: () => { handlers.delete(handler); } }; });
  return { handlers, async press() { expect(handlers.size).toBe(1); let handled: boolean | undefined; await act(async () => { handled = [...handlers][0]!({ type: "hardwareBackPress", timeStamp: 0 }); }); return handled; } };
}
async function openComments(locale: Locale) {
  await fireEvent.press(screen.getByRole("tab", { name: copy[locale].orders })); await screen.findByRole("button", { name: `${copy[locale].open}: SYNTHETIC-READ-001` }); await fireEvent.press(screen.getByRole("button", { name: `${copy[locale].open}: SYNTHETIC-READ-001` })); await screen.findByRole("button", { name: orderCommentsCopy[locale].open }); await fireEvent.press(screen.getByRole("button", { name: orderCommentsCopy[locale].open })); await screen.findByRole("button", { name: orderCommentCreateCopy[locale].start });
}
function unsent(s: ReturnType<typeof setup>) { expect(s.createList).not.toHaveBeenCalled(); expect(s.createComment).not.toHaveBeenCalled(); expect(s.editComment).not.toHaveBeenCalled(); expect(s.key).not.toHaveBeenCalled(); expect(s.upsertList).not.toHaveBeenCalled(); expect(s.removeList).not.toHaveBeenCalled(); }

it.each(["ru", "kk"] as const)("root list form handles review/edit/pause Back in %s with exact raw/default/caret and no requests", async locale => {
  const s = setup(), h = hardware(), t = savedListCreateCopy[locale], view = await render(<StrictMode><App session={{ client: s.client, scope, organizationName: "SYNTHETIC" }} locale={locale} /></StrictMode>);
  try {
    await screen.findByText("SYNTHETIC product"); await fireEvent.press(screen.getByRole("tab", { name: copy[locale].savedLists })); await screen.findByRole("button", { name: t.start }); await fireEvent.press(screen.getByRole("button", { name: t.start })); const raw = "  SYNTHETIC бастапқы список  ", selection = { start: 2, end: 7 };
    await fireEvent.changeText(screen.getByLabelText(t.name), raw); await fireEvent(screen.getByLabelText(t.name), "selectionChange", { nativeEvent: { selection } }); await fireEvent(screen.getByRole("switch", { name: t.default }), "valueChange", true); await fireEvent.press(screen.getByRole("button", { name: t.preview })); await screen.findByText(t.reviewTitle);
    expect(await h.press()).toBe(true); expect(screen.getByLabelText(t.name)).toHaveDisplayValue(raw); expect(screen.getByLabelText(t.name)).toHaveProp("selection", selection); expect(screen.getByRole("switch", { name: t.default, checked: true })).toBeOnTheScreen();
    expect(await h.press()).toBe(true); expect(screen.queryByLabelText(t.name)).toBeNull(); await fireEvent.press(screen.getByRole("button", { name: t.resume })); expect(screen.getByLabelText(t.name)).toHaveDisplayValue(raw); expect(screen.getByLabelText(t.name)).toHaveProp("selection", selection);
    expect(await h.press()).toBe(true); expect(await h.press()).toBe(false); expect(s.listRead).toHaveBeenCalledTimes(1); unsent(s);
  } finally { await view.unmount(); expect(h.handlers.size).toBe(0); }
});
it.each(["ru", "kk"] as const)("comment create Back in %s first returns fields/pauses without leaving its current thread", async locale => {
  const s = setup(), h = hardware(), t = orderCommentCreateCopy[locale], view = await render(<StrictMode><App session={{ client: s.client, scope, organizationName: "SYNTHETIC" }} locale={locale} /></StrictMode>);
  try {
    await openComments(locale); await fireEvent.press(screen.getByRole("button", { name: t.start })); const raw = "  SYNTHETIC бастапқы пікір\nНовая строка  ", selection = { start: 3, end: 8 };
    await fireEvent.changeText(screen.getByLabelText(t.body), raw); await fireEvent(screen.getByLabelText(t.body), "selectionChange", { nativeEvent: { selection } }); await fireEvent.press(screen.getByRole("button", { name: t.preview })); await screen.findByText(t.reviewTitle);
    expect(await h.press()).toBe(true); expect(screen.getByLabelText(t.body)).toHaveDisplayValue(raw); expect(screen.getByLabelText(t.body)).toHaveProp("selection", selection); expect(await h.press()).toBe(true); expect(screen.queryByLabelText(t.body)).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: t.resume })); expect(screen.getByLabelText(t.body)).toHaveDisplayValue(raw); expect(screen.getByLabelText(t.body)).toHaveProp("selection", selection); expect(await h.press()).toBe(true); expect(s.commentRead).toHaveBeenCalledTimes(1); unsent(s);
    expect(await h.press()).toBe(true); await screen.findByRole("button", { name: orderCommentsCopy[locale].open }); expect(s.commentRead).toHaveBeenCalledTimes(1);
  } finally { await view.unmount(); expect(h.handlers.size).toBe(0); }
});
it.each(["ru", "kk"] as const)("own comment edit Back in %s retains source version/raw/caret and never creates or sends", async locale => {
  const s = setup(), h = hardware(), t = commentEditCopy[locale], view = await render(<StrictMode><App session={{ client: s.client, scope, organizationName: "SYNTHETIC" }} locale={locale} /></StrictMode>);
  try {
    await openComments(locale); await fireEvent.press(screen.getByRole("button", { name: `${t.start}: ${t.comment} 1` })); const raw = "  SYNTHETIC түзетілген пікір\nНовая строка  ", selection = { start: 2, end: 9 };
    await fireEvent.changeText(screen.getByLabelText(t.body), raw); await fireEvent(screen.getByLabelText(t.body), "selectionChange", { nativeEvent: { selection } }); await fireEvent.press(screen.getByRole("button", { name: t.preview })); await screen.findByText(t.reviewTitle);
    expect(await h.press()).toBe(true); expect(screen.getByLabelText(t.body)).toHaveDisplayValue(raw); expect(screen.getByLabelText(t.body)).toHaveProp("selection", selection); expect(await h.press()).toBe(true); expect(screen.queryByLabelText(t.body)).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: `${t.resume}: ${t.comment} 1` })); expect(screen.getByLabelText(t.body)).toHaveDisplayValue(raw); expect(screen.getByLabelText(t.body)).toHaveProp("selection", selection); expect(await h.press()).toBe(true); expect(s.commentRead).toHaveBeenCalledTimes(1); unsent(s);
  } finally { await view.unmount(); expect(h.handlers.size).toBe(0); }
});
it.each(["ru", "kk"] as const)("item removal review Back in %s retains exact stored row and stays in its list", async locale => {
  const s = setup(), h = hardware(), t = savedListRemoveCopy[locale], c = copy[locale], list = savedListCreatePage()[0]!, row = list.items[0]!, action = `${t.start}: ${row.offerId}`, view = await render(<StrictMode><App session={{ client: s.client, scope, organizationName: "SYNTHETIC" }} locale={locale} /></StrictMode>);
  try {
    await screen.findByText("SYNTHETIC product"); await fireEvent.press(screen.getByRole("tab", { name: c.savedLists })); await screen.findByText(list.name); await fireEvent.press(screen.getByRole("button", { name: `${c.open}: ${list.name}` })); await screen.findByRole("button", { name: action }); await fireEvent.press(screen.getByRole("button", { name: action })); await screen.findByRole("button", { name: t.confirm });
    expect(await h.press()).toBe(true); expect(screen.queryByRole("button", { name: t.confirm })).toBeNull(); expect(screen.getByRole("button", { name: action })).toBeOnTheScreen(); expect(screen.getByText(`${c.quantity}: ${row.quantity}`)).toBeOnTheScreen(); expect(s.listRead).toHaveBeenCalledTimes(1); unsent(s);
    await fireEvent.press(screen.getByRole("button", { name: action })); await screen.findByRole("button", { name: t.confirm }); expect(await h.press()).toBe(true); expect(screen.getByRole("button", { name: action })).toBeOnTheScreen(); unsent(s);
  } finally { await view.unmount(); expect(h.handlers.size).toBe(0); }
});
it.each(["ru", "kk"] as const)("item save review Back in %s retains selected source and exact local quantity/note/name/caret", async locale => {
  const s = setup(), h = hardware(), t = savedListItemCopy[locale], c = copy[locale], list = savedListCreatePage()[0]!, use = `${t.use}: ${list.name}`, view = await render(<StrictMode><App session={{ client: s.client, scope, organizationName: "SYNTHETIC" }} locale={locale} /></StrictMode>);
  try {
    await screen.findByText("SYNTHETIC product"); await fireEvent.press(screen.getByRole("button", { name: `${c.open}: SYNTHETIC product, SYNTHETIC variant` })); await screen.findByText("SYNTHETIC supplier"); await fireEvent.press(screen.getByRole("button", { name: `${c.open}: SYNTHETIC supplier` })); await fireEvent.press(screen.getByRole("button", { name: c.localListAdd })); await screen.findByLabelText(c.localListQuantity);
    const rawName = "  SYNTHETIC бастапқы атау  ", rawQuantity = " 0,250000 ", rawNote = "  SYNTHETIC бастапқы заметка\nЕкінші жол  ", selection = { start: 3, end: 8 };
    await fireEvent.changeText(screen.getByLabelText(c.localListName), rawName); await fireEvent.changeText(screen.getByLabelText(c.localListQuantity), rawQuantity); await fireEvent.changeText(screen.getByLabelText(c.localListNote), rawNote); await fireEvent(screen.getByLabelText(c.localListNote), "selectionChange", { nativeEvent: { selection } }); await fireEvent.press(screen.getByRole("button", { name: t.start })); await screen.findByRole("button", { name: use }); await fireEvent.press(screen.getByRole("button", { name: use })); await screen.findByText(t.reviewTitle);
    const reads = s.listRead.mock.calls.length, comparisons = s.compare.mock.calls.length; expect(await h.press()).toBe(true); expect(screen.queryByRole("button", { name: t.confirm })).toBeNull(); expect(screen.getByRole("button", { name: use })).toBeOnTheScreen(); expect(s.listRead).toHaveBeenCalledTimes(reads); expect(s.compare).toHaveBeenCalledTimes(comparisons); unsent(s);
    await fireEvent.press(screen.getByRole("button", { name: c.localListResume })); await screen.findByLabelText(c.localListName); expect(screen.getByLabelText(c.localListName)).toHaveDisplayValue(rawName); await fireEvent.press(screen.getByRole("button", { name: `${c.localListEdit}: ${c.cartItem} 1` })); await screen.findByLabelText(c.localListQuantity); expect(screen.getByLabelText(c.localListQuantity)).toHaveDisplayValue(rawQuantity); expect(screen.getByLabelText(c.localListNote)).toHaveDisplayValue(rawNote); expect(screen.getByLabelText(c.localListNote)).toHaveProp("selection", selection); unsent(s);
  } finally { await view.unmount(); expect(h.handlers.size).toBe(0); }
});

const staleReads = ["fresh-page", "network", "throttled"] as const;
const staleCases = (["ru", "kk"] as const).flatMap(locale => staleReads.map(outcome => ({ locale, outcome })));
function failNextRead(read: ReturnType<typeof setup>["listRead"] | ReturnType<typeof setup>["commentRead"], outcome: typeof staleReads[number]) {
  if (outcome !== "fresh-page") read.mockRejectedValueOnce(outcome === "throttled" ? cartCommandError(429) : Error("SYNTHETIC read unavailable"));
}
function sameReadError(locale: Locale, outcome: typeof staleReads[number]) {
  if (outcome !== "fresh-page") { expect(screen.getByText(outcome === "throttled" ? copy[locale].throttled : copy[locale].error)).toBeOnTheScreen(); expect(screen.getByRole("button", { name: copy[locale].retry })).toBeOnTheScreen(); }
}
async function retryIfNeeded(locale: Locale, outcome: typeof staleReads[number]) {
  if (outcome !== "fresh-page") await fireEvent.press(screen.getByRole("button", { name: copy[locale].retry }));
}
it.each(staleCases)("visible stale list header Back preserves fields without GET/send in $locale/$outcome", async ({ locale, outcome }) => {
  const s = setup(), h = hardware(), t = savedListCreateCopy[locale], c = copy[locale], raw = "  SYNTHETIC сақталған атау  ", selection = { start: 2, end: 8 };
  const view = await render(<StrictMode><App session={{ client: s.client, scope, organizationName: "SYNTHETIC" }} locale={locale} /></StrictMode>);
  try {
    await screen.findByText("SYNTHETIC product"); await fireEvent.press(screen.getByRole("tab", { name: c.savedLists })); await screen.findByRole("button", { name: t.start }); await fireEvent.press(screen.getByRole("button", { name: t.start }));
    await fireEvent.changeText(screen.getByLabelText(t.name), raw); await fireEvent(screen.getByLabelText(t.name), "selectionChange", { nativeEvent: { selection } }); await fireEvent(screen.getByRole("switch", { name: t.default }), "valueChange", true); await fireEvent.press(screen.getByRole("button", { name: t.preview })); await screen.findByText(t.reviewTitle);
    failNextRead(s.listRead, outcome); await fireEvent.press(screen.getByRole("button", { name: c.refresh })); await screen.findByRole("button", { name: t.edit }); const reads = s.listRead.mock.calls.length;
    expect(await h.press()).toBe(true); expect(screen.queryByRole("button", { name: t.edit })).toBeNull(); sameReadError(locale, outcome); expect(s.listRead).toHaveBeenCalledTimes(reads); unsent(s);
    if (outcome !== "fresh-page") { expect(screen.queryByLabelText(t.name)).toBeNull(); expect(await h.press()).toBe(false); sameReadError(locale, outcome); }
    await retryIfNeeded(locale, outcome); await screen.findByLabelText(t.name); expect(screen.getByLabelText(t.name)).toHaveDisplayValue(raw); expect(screen.getByLabelText(t.name)).toHaveProp("selection", selection); expect(screen.getByRole("switch", { name: t.default, checked: true })).toBeOnTheScreen(); unsent(s);
  } finally { await view.unmount(); }
});
it.each(staleCases)("visible stale list removal Back keeps the exact stored row in $locale/$outcome", async ({ locale, outcome }) => {
  const s = setup(), h = hardware(), t = savedListRemoveCopy[locale], c = copy[locale], list = savedListCreatePage()[0]!, row = list.items[0]!, before = JSON.stringify(list);
  const view = await render(<StrictMode><App session={{ client: s.client, scope, organizationName: "SYNTHETIC" }} locale={locale} /></StrictMode>);
  try {
    await screen.findByText("SYNTHETIC product"); await fireEvent.press(screen.getByRole("tab", { name: c.savedLists })); await screen.findByRole("button", { name: `${c.open}: ${list.name}` }); await fireEvent.press(screen.getByRole("button", { name: `${c.open}: ${list.name}` })); await fireEvent.press(screen.getByRole("button", { name: `${t.start}: ${row.offerId}` })); await screen.findByRole("button", { name: t.confirm });
    failNextRead(s.listRead, outcome); await fireEvent.press(screen.getByRole("button", { name: c.refresh })); await screen.findByRole("button", { name: t.cancel }); const reads = s.listRead.mock.calls.length;
    expect(await h.press()).toBe(true); expect(screen.queryByRole("button", { name: t.cancel })).toBeNull(); sameReadError(locale, outcome); expect(s.listRead).toHaveBeenCalledTimes(reads); unsent(s);
    await retryIfNeeded(locale, outcome); await screen.findByRole("button", { name: `${t.start}: ${row.offerId}` }); expect(screen.getByText(`${c.quantity}: ${row.quantity}`)).toBeOnTheScreen(); expect(JSON.stringify(list)).toBe(before); unsent(s);
  } finally { await view.unmount(); }
});
it.each(staleCases)("visible stale list item Back retains selected local plan in $locale/$outcome", async ({ locale, outcome }) => {
  const s = setup(), h = hardware(), t = savedListItemCopy[locale], c = copy[locale], list = savedListCreatePage()[0]!, use = `${t.use}: ${list.name}`, rawName = "  SYNTHETIC жергілікті атау  ", rawQuantity = " 0,250000 ", rawNote = "  SYNTHETIC note\nЕкінші жол  ", selection = { start: 3, end: 8 };
  const view = await render(<StrictMode><App session={{ client: s.client, scope, organizationName: "SYNTHETIC" }} locale={locale} /></StrictMode>);
  try {
    await screen.findByText("SYNTHETIC product"); await fireEvent.press(screen.getByRole("button", { name: `${c.open}: SYNTHETIC product, SYNTHETIC variant` })); await screen.findByText("SYNTHETIC supplier"); await fireEvent.press(screen.getByRole("button", { name: `${c.open}: SYNTHETIC supplier` })); await fireEvent.press(screen.getByRole("button", { name: c.localListAdd })); await screen.findByLabelText(c.localListQuantity);
    await fireEvent.changeText(screen.getByLabelText(c.localListName), rawName); await fireEvent.changeText(screen.getByLabelText(c.localListQuantity), rawQuantity); await fireEvent.changeText(screen.getByLabelText(c.localListNote), rawNote); await fireEvent(screen.getByLabelText(c.localListNote), "selectionChange", { nativeEvent: { selection } }); await fireEvent.press(screen.getByRole("button", { name: t.start })); await screen.findByRole("button", { name: use }); await fireEvent.press(screen.getByRole("button", { name: use })); await screen.findByText(t.reviewTitle);
    failNextRead(s.listRead, outcome); await fireEvent.press(screen.getByRole("button", { name: c.refresh })); await screen.findByRole("button", { name: t.cancel }); const reads = s.listRead.mock.calls.length, comparisons = s.compare.mock.calls.length;
    expect(await h.press()).toBe(true); expect(screen.queryByRole("button", { name: t.cancel })).toBeNull(); sameReadError(locale, outcome); expect(s.listRead).toHaveBeenCalledTimes(reads); expect(s.compare).toHaveBeenCalledTimes(comparisons); unsent(s);
    await retryIfNeeded(locale, outcome); await screen.findByRole("button", { name: use }); await fireEvent.press(screen.getByRole("button", { name: c.localListResume })); await screen.findByLabelText(c.localListName); expect(screen.getByLabelText(c.localListName)).toHaveDisplayValue(rawName); await fireEvent.press(screen.getByRole("button", { name: `${c.localListEdit}: ${c.cartItem} 1` })); await screen.findByLabelText(c.localListQuantity); expect(screen.getByLabelText(c.localListQuantity)).toHaveDisplayValue(rawQuantity); expect(screen.getByLabelText(c.localListNote)).toHaveDisplayValue(rawNote); expect(screen.getByLabelText(c.localListNote)).toHaveProp("selection", selection); unsent(s);
  } finally { await view.unmount(); }
});
it.each(staleCases)("visible stale comment create Back retains raw body/caret without issuing a key in $locale/$outcome", async ({ locale, outcome }) => {
  const s = setup(), h = hardware(), t = orderCommentCreateCopy[locale], c = copy[locale], raw = "  SYNTHETIC сақталған пікір\nНовая строка  ", selection = { start: 2, end: 9 };
  const view = await render(<StrictMode><App session={{ client: s.client, scope, organizationName: "SYNTHETIC" }} locale={locale} /></StrictMode>);
  try {
    await openComments(locale); await fireEvent.press(screen.getByRole("button", { name: t.start })); await fireEvent.changeText(screen.getByLabelText(t.body), raw); await fireEvent(screen.getByLabelText(t.body), "selectionChange", { nativeEvent: { selection } }); await fireEvent.press(screen.getByRole("button", { name: t.preview })); await screen.findByText(t.reviewTitle);
    failNextRead(s.commentRead, outcome); await fireEvent.press(screen.getByRole("button", { name: c.refresh })); await screen.findByRole("button", { name: t.edit }); const reads = s.commentRead.mock.calls.length;
    expect(await h.press()).toBe(true); expect(screen.queryByRole("button", { name: t.edit })).toBeNull(); sameReadError(locale, outcome); expect(s.commentRead).toHaveBeenCalledTimes(reads); unsent(s);
    await retryIfNeeded(locale, outcome); await screen.findByLabelText(t.body); expect(screen.getByLabelText(t.body)).toHaveDisplayValue(raw); expect(screen.getByLabelText(t.body)).toHaveProp("selection", selection); unsent(s);
  } finally { await view.unmount(); }
});
it.each(staleCases)("visible stale own-comment edit Back preserves explicit resume in $locale/$outcome", async ({ locale, outcome }) => {
  const s = setup(), h = hardware(), t = commentEditCopy[locale], c = copy[locale], raw = "  SYNTHETIC түзетілген пікір\nНовая строка  ", selection = { start: 2, end: 9 };
  const view = await render(<StrictMode><App session={{ client: s.client, scope, organizationName: "SYNTHETIC" }} locale={locale} /></StrictMode>);
  try {
    await openComments(locale); await fireEvent.press(screen.getByRole("button", { name: `${t.start}: ${t.comment} 1` })); await fireEvent.changeText(screen.getByLabelText(t.body), raw); await fireEvent(screen.getByLabelText(t.body), "selectionChange", { nativeEvent: { selection } }); await fireEvent.press(screen.getByRole("button", { name: t.preview })); await screen.findByText(t.reviewTitle);
    failNextRead(s.commentRead, outcome); await fireEvent.press(screen.getByRole("button", { name: c.refresh })); await screen.findByRole("button", { name: t.edit }); const reads = s.commentRead.mock.calls.length;
    expect(await h.press()).toBe(true); expect(screen.queryByRole("button", { name: t.edit })).toBeNull(); sameReadError(locale, outcome); expect(s.commentRead).toHaveBeenCalledTimes(reads); unsent(s);
    await retryIfNeeded(locale, outcome); await screen.findByRole("button", { name: `${t.resume}: ${t.comment} 1` }); await fireEvent.press(screen.getByRole("button", { name: `${t.resume}: ${t.comment} 1` })); await screen.findByLabelText(t.body); expect(screen.getByLabelText(t.body)).toHaveDisplayValue(raw); expect(screen.getByLabelText(t.body)).toHaveProp("selection", selection); unsent(s);
  } finally { await view.unmount(); }
});
it.each(["ru", "kk"] as const)("loading keeps hidden list preparation untouched until a visible local Back in %s", async locale => {
  const s = setup(), h = hardware(), t = savedListCreateCopy[locale], c = copy[locale], raw = "  SYNTHETIC сақталған атау  ", selection = { start: 2, end: 8 };
  let finish: ((value: Awaited<ReturnType<typeof s.listRead>>) => void) | undefined;
  const body = savedListCreatePage().map(list => ({ ...list, createdById: scope.userId }));
  const view = await render(<StrictMode><App session={{ client: s.client, scope, organizationName: "SYNTHETIC" }} locale={locale} /></StrictMode>);
  try {
    await screen.findByText("SYNTHETIC product"); await fireEvent.press(screen.getByRole("tab", { name: c.savedLists })); await screen.findByRole("button", { name: t.start }); await fireEvent.press(screen.getByRole("button", { name: t.start })); await fireEvent.changeText(screen.getByLabelText(t.name), raw); await fireEvent(screen.getByLabelText(t.name), "selectionChange", { nativeEvent: { selection } }); await fireEvent.press(screen.getByRole("button", { name: t.preview })); await screen.findByText(t.reviewTitle);
    s.listRead.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); await fireEvent.press(screen.getByRole("button", { name: c.refresh })); expect(screen.queryByRole("button", { name: t.edit })).toBeNull(); const reads = s.listRead.mock.calls.length;
    expect(await h.press()).toBe(false); expect(s.listRead).toHaveBeenCalledTimes(reads); unsent(s);
    await act(async () => { finish!(body); }); await screen.findByRole("button", { name: t.edit }); expect(await h.press()).toBe(true); await screen.findByLabelText(t.name); expect(screen.getByLabelText(t.name)).toHaveDisplayValue(raw); expect(screen.getByLabelText(t.name)).toHaveProp("selection", selection); expect(s.listRead).toHaveBeenCalledTimes(reads); unsent(s);
  } finally { if (finish) await act(async () => { finish!(body); }); await view.unmount(); }
});
