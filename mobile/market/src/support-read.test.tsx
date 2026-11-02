import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { jest } from "@jest/globals";
import App from "../App";
import type { MarketSession, MobileReadClient, ReadScope } from "./read-controller";
import { supportTicketSummarySchema } from "../../../packages/schemas/src/support-workflow";
import { createMobileReadSlot } from "../../../contracts/mobile-read/read-adapter";
import { createMobileReadQueries } from "../../../contracts/mobile-read/read-queries";
import { copy, supportPriorityLabel, supportStatuses, supportStatusLabel } from "./i18n";
import { supportDetail, supportId, supportOrganization, supportSummary, supportUser } from "./test-fixtures/support";
const corpus = JSON.parse(readFileSync(resolve(__dirname, "../../../contracts/mobile-read/fixtures.json"), "utf8")) as { cases: { id: string; payload: unknown }[] };
const fixture = (id: string): unknown => JSON.parse(JSON.stringify(corpus.cases.find(item => item.id === id)!.payload));
const scope: ReadScope = { product: "market", environment: "synthetic-offline", userId: supportUser, organizationId: supportOrganization, generation: 1 };
function client() { return { searchCatalog: jest.fn<MobileReadClient["searchCatalog"]>().mockResolvedValue(fixture("catalog-empty")), compareOffers: jest.fn<MobileReadClient["compareOffers"]>().mockResolvedValue(fixture("comparison-exact-offer")), workspaceOrders: jest.fn<MobileReadClient["workspaceOrders"]>().mockResolvedValue(fixture("workspace-orders-page")), getOrderWorkflow: jest.fn<MobileReadClient["getOrderWorkflow"]>().mockResolvedValue(fixture("order-workflow-minimal")), supportTickets: jest.fn<NonNullable<MobileReadClient["supportTickets"]>>().mockResolvedValue([supportSummary()]), supportTicket: jest.fn<NonNullable<MobileReadClient["supportTicket"]>>().mockResolvedValue(supportDetail()) }; }
function session(api = client(), active = scope): MarketSession { return { scope: active, client: api, organizationName: "SYNTHETIC organization" }; }
async function open(locale: "ru" | "kk", api = client()) {
  const rendered = await render(<App session={session(api)} locale={locale} />);
  await fireEvent.press(screen.getByRole("tab", { name: copy[locale].support })); await screen.findByText("SYNTHETIC-SUP-001");
  await fireEvent.press(screen.getByRole("button", { name: `${copy[locale].open}: SYNTHETIC-SUP-001` })); await screen.findByText("SYNTHETIC user body 61");
  return rendered;
}

it.each(["ru", "kk"] as const)("shows public ticket messages and attachment metadata in %s with self/other labels and no file/action side effects", async locale => {
  const api = client(), t = copy[locale]; await open(locale, api);
  expect(screen.getByText(`${t.supportDescription}: SYNTHETIC user description`)).toBeOnTheScreen();
  expect(screen.getByText(t.supportSelf)).toBeOnTheScreen(); expect(screen.getAllByText(t.supportOther)).toHaveLength(2);
  expect(screen.getByText(t.supportAttachmentsUnknown)).toBeOnTheScreen(); expect(screen.getByText(t.supportNoAttachments)).toBeOnTheScreen();
  expect(screen.getByText("SYNTHETIC attachment.pdf")).toBeOnTheScreen(); expect(screen.getByText(`PDF · 123 ${t.supportBytes}`)).toBeOnTheScreen();
  expect(screen.queryByText("SYNTHETIC server Russian role")).toBeNull();
  expect(screen.queryByText("SYNTHETIC private linked label")).toBeNull(); expect(screen.queryByText(/https:\/\/private/)).toBeNull();
  expect(screen.queryByText(supportUser)).toBeNull();
  expect(screen.queryByRole("button", { name: /Отправить|Скачать|Создать|Жіберу|Жүктеу|Құру/ })).toBeNull();
  expect(api.supportTicket).toHaveBeenCalledWith(supportId(60), undefined);
});
it.each(["ru", "kk"] as const)("retains support search/status/sort through 50-row pages, ticket and Back in %s", async locale => {
  const api = client(), t = copy[locale];
  api.supportTickets.mockImplementation(async (_status, offset) => offset === 50 ? [supportSummary({ number: "SYNTHETIC page two" })] : Array.from({ length: 50 }, (_, i) => supportSummary({ id: supportId(100 + i), number: `SYNTHETIC page one ${i}` })));
  await render(<App session={session(api)} locale={locale} />);
  await fireEvent.press(screen.getByRole("tab", { name: t.support })); await screen.findByText("SYNTHETIC page one 0");
  await fireEvent.changeText(screen.getByLabelText(t.searchSupport), " exact & /? + қ ");
  expect(api.supportTickets).toHaveBeenCalledTimes(1);
  await fireEvent(screen.getByLabelText(t.searchSupport), "submitEditing"); await screen.findByText("SYNTHETIC page one 0");
  await fireEvent.press(screen.getByRole("tab", { name: supportStatusLabel("WAITING_CUSTOMER", locale) })); await screen.findByText("SYNTHETIC page one 0");
  await fireEvent.press(screen.getByRole("tab", { name: t.supportQueue })); await screen.findByText("SYNTHETIC page one 0");
  await fireEvent.press(screen.getByRole("button", { name: t.next })); await screen.findByText("SYNTHETIC page two");
  expect(api.supportTickets.mock.calls.at(-1)).toEqual(["WAITING_CUSTOMER", 50, { q: "exact & /? + қ", sort: "queue" }]);
  expect(screen.queryByRole("button", { name: t.next })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC page two` })); await screen.findByText("SYNTHETIC user body 61");
  await fireEvent.press(screen.getByRole("button", { name: t.back })); await screen.findByText("SYNTHETIC page two");
  expect(api.supportTickets.mock.calls.at(-1)).toEqual(["WAITING_CUSTOMER", 50, { q: "exact & /? + қ", sort: "queue" }]);
  expect(screen.getByLabelText(t.searchSupport)).toHaveProp("value", " exact & /? + қ ");
  await fireEvent.press(screen.getByRole("button", { name: t.back })); await screen.findByText("SYNTHETIC page one 0");
  expect(api.supportTickets.mock.calls.at(-1)?.[1]).toBe(0);
  await fireEvent.press(screen.getByRole("button", { name: t.clear })); await screen.findByText("SYNTHETIC page one 0");
  expect(api.supportTickets.mock.calls.at(-1)).toEqual(["WAITING_CUSTOMER", 0, { q: "", sort: "queue" }]);
});
it("uses actual older-message cursor and returns to the newer page without merging or replaying messages", async () => {
  const api = client(), first = supportDetail();
  api.supportTicket.mockImplementation(async (_id, before) => before ? supportDetail({ messages: [{ ...first.messages[0]!, id: supportId(59), body: "SYNTHETIC older message" }], hasOlder: false }) : first);
  await open("ru", api);
  await fireEvent.press(screen.getByRole("button", { name: copy.ru.supportOlder })); await screen.findByText("SYNTHETIC older message");
  expect(api.supportTicket.mock.calls.at(-1)).toEqual([supportId(60), supportId(61)]);
  expect(screen.queryByText("SYNTHETIC user body 63")).toBeNull(); expect(screen.queryByRole("button", { name: copy.ru.supportOlder })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: copy.ru.back })); await screen.findByText("SYNTHETIC user body 61");
  expect(api.supportTicket.mock.calls.at(-1)).toEqual([supportId(60), undefined]);
});
it("exposes inconsistent partial history as an explicit retry without a fabricated cursor or auto-loop", async () => {
  const api = client(); api.supportTicket.mockResolvedValue(supportDetail({ messages: [], hasOlder: true }));
  await render(<App session={session(api)} />); await fireEvent.press(screen.getByRole("tab", { name: copy.ru.support })); await screen.findByText("SYNTHETIC-SUP-001");
  await fireEvent.press(screen.getByRole("button", { name: `${copy.ru.open}: SYNTHETIC-SUP-001` }));
  await screen.findByRole("alert", { name: `${copy.ru.supportOlderUnavailable}. ${copy.ru.supportPartialBody}` });
  expect(screen.queryByRole("button", { name: copy.ru.supportOlder })).toBeNull(); expect(api.supportTicket).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole("button", { name: copy.ru.retry }));
  await screen.findByRole("alert", { name: `${copy.ru.supportOlderUnavailable}. ${copy.ru.supportPartialBody}` }); expect(api.supportTicket).toHaveBeenCalledTimes(2);
});
it("retains older-message page through locale switch and offline error/retry without switching ticket or page", async () => {
  const api = client(), first = supportDetail(); api.supportTicket.mockImplementation(async (_id, before) => before ? supportDetail({ messages: [{ ...first.messages[0]!, id: supportId(59), body: "SYNTHETIC older" }], hasOlder: false }) : first);
  const rendered = await open("ru", api); await fireEvent.press(screen.getByRole("button", { name: copy.ru.supportOlder })); await screen.findByText("SYNTHETIC older");
  let reject!: (error: Error) => void; api.supportTicket.mockReturnValueOnce(new Promise((_yes, no) => { reject = no; }));
  await fireEvent.press(screen.getByRole("button", { name: copy.ru.refresh })); expect(screen.queryByText("SYNTHETIC older")).toBeNull();
  await rendered.rerender(<App session={session(api)} locale="kk" />); await act(async () => reject(new Error("SYNTHETIC private transport failure")));
  await screen.findByRole("alert", { name: `${copy.kk.error}. ${copy.kk.errorBody}` });
  expect(screen.queryByText("SYNTHETIC private transport failure")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: copy.kk.retry })); await screen.findByText("SYNTHETIC older");
  expect(api.supportTicket.mock.calls.at(-1)).toEqual([supportId(60), supportId(61)]);
});
it("resets support history/draft and discards a late ticket after session generation changes", async () => {
  const api = client(); let resolve!: (value: unknown) => void;
  const rendered = await render(<App session={session(api)} />); await fireEvent.press(screen.getByRole("tab", { name: copy.ru.support })); await screen.findByText("SYNTHETIC-SUP-001");
  await fireEvent.changeText(screen.getByLabelText(copy.ru.searchSupport), "SYNTHETIC old private draft");
  api.supportTicket.mockReturnValueOnce(new Promise(yes => { resolve = yes; }));
  await fireEvent.press(screen.getByRole("button", { name: `${copy.ru.open}: SYNTHETIC-SUP-001` }));
  await rendered.rerender(<App session={session(api, { ...scope, generation: 2 })} />); await screen.findByText(copy.ru.emptyCatalog);
  await act(async () => resolve(supportDetail())); expect(screen.queryByText("SYNTHETIC user body 61")).toBeNull();
  await fireEvent.press(screen.getByRole("tab", { name: copy.ru.support })); await screen.findByText("SYNTHETIC-SUP-001");
  expect(screen.getByLabelText(copy.ru.searchSupport)).toHaveProp("value", ""); expect(screen.queryByRole("button", { name: copy.ru.back })).toBeNull();
});

it.each(["organization", "ticket", "message", "link", "internal"] as const)("rejects incompatible %s context before accepting a buyer ticket", variant => {
  const data = supportDetail();
  if (variant === "organization") data.organizationId = supportId(999);
  if (variant === "ticket") data.id = supportId(999);
  if (variant === "message") data.messages[0]!.ticketId = supportId(999);
  if (variant === "link") data.links[0]!.ticketId = supportId(999);
  if (variant === "internal") data.messages[0]!.isInternal = true;
  const slot = createMobileReadSlot(scope); slot.complete(slot.begin({ kind: "support-ticket", ticketId: supportId(60) }), { status: 200, body: data }); expect(slot.getState().phase).toBe("contract-error");
});
it("rejects a foreign ticket list and future closed statuses instead of reinterpreting access/state", () => {
  const slot = createMobileReadSlot(scope);
  for (const body of [[supportSummary({ organizationId: supportId(999) })], [{ ...supportSummary(), status: "FUTURE_STATUS" }]]) {
    slot.complete(slot.begin({ kind: "support-tickets" }), { status: 200, body }); expect(slot.getState().phase).toBe("contract-error");
  }
});
it("never renders internal message data; denied view has only safe recovery", async () => {
  const api = client(), detail = supportDetail(); detail.messages[0]!.isInternal = true; detail.messages[0]!.body = "SYNTHETIC internal secret"; api.supportTicket.mockResolvedValue(detail);
  await render(<App session={session(api)} />); await fireEvent.press(screen.getByRole("tab", { name: copy.ru.support })); await screen.findByText("SYNTHETIC-SUP-001");
  await fireEvent.press(screen.getByRole("button", { name: `${copy.ru.open}: SYNTHETIC-SUP-001` })); await screen.findByRole("alert", { name: `${copy.ru.contract}. ${copy.ru.contractBody}` });
  expect(screen.queryByText("SYNTHETIC internal secret")).toBeNull();
});
it("compares support version only within the same ticket/message-page identity", () => {
  const slot = createMobileReadSlot(scope); const target = { kind: "support-ticket", ticketId: supportId(60) } as const;
  slot.complete(slot.begin(target), { status: 200, body: supportDetail({ version: 3, subject: "SYNTHETIC current version" }) });
  slot.complete(slot.begin(target), { status: 200, body: supportDetail({ version: 2, subject: "SYNTHETIC stale version" }) });
  const state = slot.getState(); expect("read" in state && state.read.kind === "support-ticket" && state.read.value.subject).toBe("SYNTHETIC current version");
  slot.complete(slot.begin({ ...target, beforeMessageId: supportId(61) }), { status: 200, body: supportDetail({ version: 2, subject: "SYNTHETIC distinct page" }) });
  const older = slot.getState(); expect("read" in older && older.read.kind === "support-ticket" && older.read.value.subject).toBe("SYNTHETIC distinct page");
});
it("snapshots support query inputs and refreshes only that request; invalid cursor never reaches the port", async () => {
  const api = client(), reads = createMobileReadQueries(scope, api); const input = { offset: 50, q: " original ", sort: "recent" as const };
  await reads.load({ kind: "support-tickets", input }); input.q = "mutated"; input.offset = 100;
  await reads.refresh(); expect(api.supportTickets.mock.calls.at(-1)).toEqual([undefined, 50, { q: "original", sort: "recent" }]);
  await reads.load({ kind: "support-ticket", ticketId: supportId(60), beforeMessageId: "invalid" }); expect(api.supportTicket).not.toHaveBeenCalled();
});
it("labels every actual support status/priority in RU/KK and retains compatibility with legacy ports", async () => {
  expect(supportStatuses.filter(status => status !== undefined)).toEqual(supportTicketSummarySchema.shape.status.options);
  for (const locale of ["ru", "kk"] as const) {
    for (const status of supportTicketSummarySchema.shape.status.options) expect(supportStatusLabel(status, locale)).not.toBe(status);
    for (const priority of supportTicketSummarySchema.shape.priority.options) expect(supportPriorityLabel(priority, locale)).not.toBe(priority);
  }
  const { supportTickets: _list, supportTicket: _detail, ...legacy } = client();
  await render(<App session={{ scope, client: legacy, organizationName: "SYNTHETIC organization" }} />); await screen.findByText(copy.ru.emptyCatalog);
  expect(screen.queryByRole("tab", { name: copy.ru.support })).toBeNull();
});

it.each(["ru", "kk"] as const)("offers the actual previous message page after older-cursor 404 in %s", async locale => {
  const api = client(), t = copy[locale];
  api.supportTicket.mockImplementation(async (_id, before) => {
    if (before) throw { status: 404, payload: { statusCode: 404, code: "NOT_FOUND", message: "SYNTHETIC cursor private detail", path: `/support/tickets/${supportId(60)}`, timestamp: "2026-10-29T01:02:03.000Z" } };
    return supportDetail();
  });
  await open(locale, api); await fireEvent.press(screen.getByRole("button", { name: t.supportOlder }));
  await screen.findByRole("alert", { name: `${t.unavailable}. ${t.supportPreviousPage}` });
  expect(screen.queryByText("SYNTHETIC cursor private detail")).toBeNull(); expect(screen.queryByRole("button", { name: t.retry })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: t.back })); await screen.findByText("SYNTHETIC user body 61");
  expect(api.supportTicket.mock.calls.at(-1)).toEqual([supportId(60), undefined]);
});
it("stops older-page navigation when the server repeats the same cursor and waits for explicit retry", async () => {
  const api = client(); await open("ru", api);
  await fireEvent.press(screen.getByRole("button", { name: copy.ru.supportOlder }));
  await screen.findByRole("alert", { name: `${copy.ru.supportOlderUnavailable}. ${copy.ru.supportPartialBody}` });
  expect(api.supportTicket).toHaveBeenCalledTimes(2); expect(screen.queryByRole("button", { name: copy.ru.supportOlder })).toBeNull();
  expect(api.supportTicket.mock.calls.at(-1)).toEqual([supportId(60), supportId(61)]);
});
