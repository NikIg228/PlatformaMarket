import { StrictMode } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { jest } from "@jest/globals";
import App from "../App";
import type { MobileReadClient, ReadScope } from "./read-controller";
import { supportSummary, supportDetail, supportId, supportOrganization, supportUser } from "./test-fixtures/support";
import { copy, supportDraftIssueText, supportPriorityLabel, supportStatusLabel } from "./i18n";
const corpus = JSON.parse(readFileSync(resolve(__dirname, "../../../contracts/mobile-read/fixtures.json"), "utf8")) as { cases: { id: string; payload: unknown }[] };
const fixture = (id: string): unknown => JSON.parse(JSON.stringify(corpus.cases.find(item => item.id === id)!.payload));
const scope: ReadScope = { product: "market", environment: "synthetic-offline", userId: supportUser, organizationId: supportOrganization, generation: 1 };
function client() { return { searchCatalog: jest.fn<MobileReadClient["searchCatalog"]>().mockResolvedValue(fixture("catalog-empty")), compareOffers: jest.fn<MobileReadClient["compareOffers"]>().mockResolvedValue(fixture("comparison-exact-offer")), workspaceOrders: jest.fn<MobileReadClient["workspaceOrders"]>().mockResolvedValue(fixture("workspace-orders-page")), getOrderWorkflow: jest.fn<MobileReadClient["getOrderWorkflow"]>().mockResolvedValue(fixture("order-workflow-minimal")), supportTickets: jest.fn<NonNullable<MobileReadClient["supportTickets"]>>().mockResolvedValue([supportSummary()]), supportTicket: jest.fn<NonNullable<MobileReadClient["supportTicket"]>>().mockResolvedValue(supportDetail()) }; }
const session = (api = client(), active = scope) => ({ scope: active, client: api, organizationName: "SYNTHETIC organization" });
async function open(locale: "ru" | "kk", api = client()) { const rendered = await render(<App session={session(api)} locale={locale} />); await fireEvent.press(screen.getByRole("tab", { name: copy[locale].support })); await screen.findByText("SYNTHETIC-SUP-001"); await fireEvent.press(screen.getByRole("button", { name: copy[locale].supportDraftStart })); await screen.findByLabelText(copy[locale].supportDraftSubject); return rendered; }
async function fill(locale: "ru" | "kk") { const t = copy[locale]; await fireEvent.changeText(screen.getByLabelText(t.supportDraftSubject), "  SYNTHETIC Тема raw  "); await fireEvent.changeText(screen.getByLabelText(t.supportDraftDescription), "  SYNTHETIC Сұрақ\nSecond line\n  "); await fireEvent.changeText(screen.getByLabelText(t.supportDraftCategory), "  SYNTHETIC свой текст  "); }

it.each(["ru", "kk"] as const)("checks only local fields, preserves original text through Back/resume and cancels to empty in %s", async locale => {
  const api = client(), t = copy[locale]; await open(locale, api); const reads = api.supportTickets.mock.calls.length;
  expect(screen.queryByText("SYNTHETIC-SUP-001")).toBeNull(); expect(screen.getByText(t.supportDraftUnchanged)).toBeOnTheScreen();
  await fill(locale); await fireEvent.press(screen.getByRole("tab", { name: supportPriorityLabel("URGENT", locale) }));
  await fireEvent(screen.getByLabelText(t.supportDraftSubject), "submitEditing"); expect(screen.queryByRole("text", { name: `${t.supportDraftChecked}. ${t.supportDraftOnlyLocal}` })).toBeNull();
  expect(screen.getByLabelText(t.supportDraftDescription)).toHaveProp("multiline", true);
  await fireEvent(screen.getByLabelText(t.supportDraftDescription), "submitEditing"); expect(screen.queryByRole("text", { name: `${t.supportDraftChecked}. ${t.supportDraftOnlyLocal}` })).toBeNull();
  await fireEvent(screen.getByLabelText(t.supportDraftCategory), "submitEditing"); await screen.findByRole("text", { name: `${t.supportDraftChecked}. ${t.supportDraftOnlyLocal}` });
  expect(screen.getByLabelText(t.supportDraftSubject)).toHaveProp("value", "  SYNTHETIC Тема raw  "); expect(screen.getByLabelText(t.supportDraftDescription)).toHaveProp("value", "  SYNTHETIC Сұрақ\nSecond line\n  ");
  expect(screen.queryByRole("button", { name: /Отправить|Создать заявку|Жіберу|Өтініш құру/ })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: t.supportDraftBack })); expect(screen.getByRole("button", { name: t.supportDraftResume })).toBeOnTheScreen(); expect(screen.getByText(t.supportDraftDirty)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: t.supportDraftResume })); expect(screen.getByLabelText(t.supportDraftCategory)).toHaveProp("value", "  SYNTHETIC свой текст  "); expect(screen.getByRole("tab", { name: supportPriorityLabel("URGENT", locale) })).toHaveProp("accessibilityState", expect.objectContaining({ selected: true }));
  await fireEvent.press(screen.getByRole("button", { name: t.supportDraftCancel })); expect(screen.queryByRole("button", { name: t.supportDraftResume })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: t.supportDraftStart })); expect(screen.getByLabelText(t.supportDraftSubject)).toHaveProp("value", ""); expect(screen.getByLabelText(t.supportDraftDescription)).toHaveProp("value", ""); expect(screen.getByLabelText(t.supportDraftCategory)).toHaveProp("value", "");
  expect(api.supportTickets).toHaveBeenCalledTimes(reads); expect(api.supportTicket).not.toHaveBeenCalled();
});
it.each(["ru", "kk"] as const)("shows real field minimum/maximum errors and retains long text without truncation in %s", async locale => {
  const api = client(), t = copy[locale]; await open(locale, api); await fireEvent.press(screen.getByRole("button", { name: t.supportDraftCheck }));
  await screen.findByRole("alert"); expect(screen.getByRole("alert").props.accessibilityLabel).toContain(`${t.supportDraftSubject}:`);
  for (const [label, minimum] of [[t.supportDraftSubject, "4"], [t.supportDraftDescription, "10"], [t.supportDraftCategory, "2"]]) expect(screen.getByLabelText(label!)).toHaveProp("accessibilityHint", supportDraftIssueText({ kind: "minimum", count: minimum! }, locale));
  await fill(locale); const tooLong = "я".repeat(10001); await fireEvent.changeText(screen.getByLabelText(t.supportDraftDescription), tooLong); await fireEvent.press(screen.getByRole("button", { name: t.supportDraftCheck }));
  expect(screen.getByLabelText(t.supportDraftDescription)).toHaveProp("value", tooLong); expect(screen.getByLabelText(t.supportDraftDescription)).toHaveProp("accessibilityHint", supportDraftIssueText({ kind: "maximum", count: "10000" }, locale));
  const atLimit = "  " + "я".repeat(10000) + "\n"; await fireEvent.changeText(screen.getByLabelText(t.supportDraftDescription), atLimit); await fireEvent.press(screen.getByRole("button", { name: t.supportDraftCheck }));
  expect(screen.getByLabelText(t.supportDraftDescription)).toHaveProp("value", atLimit); expect(screen.queryByRole("alert")).toBeNull(); expect(screen.getByRole("text", { name: `${t.supportDraftChecked}. ${t.supportDraftOnlyLocal}` })).toBeOnTheScreen();
});
it("switches error copy/priority labels but never translates/normalizes user input or refetches on locale change", async () => {
  const api = client(), rendered = await open("ru", api); await fill("ru"); await fireEvent.changeText(screen.getByLabelText(copy.ru.supportDraftDescription), " \n "); await fireEvent.press(screen.getByRole("button", { name: copy.ru.supportDraftCheck }));
  await rendered.rerender(<App session={session(api)} locale="kk" />);
  expect(screen.getByLabelText(copy.kk.supportDraftSubject)).toHaveProp("value", "  SYNTHETIC Тема raw  "); expect(screen.getByLabelText(copy.kk.supportDraftDescription)).toHaveProp("value", " \n ");
  expect(screen.getByLabelText(copy.kk.supportDraftDescription)).toHaveProp("accessibilityHint", supportDraftIssueText({ kind: "minimum", count: "10" }, "kk")); expect(screen.queryByText(supportDraftIssueText({ kind: "minimum", count: "10" }, "ru"))).toBeNull(); expect(api.supportTickets).toHaveBeenCalledTimes(1);
});
it("retains independent draft/search/filter/offset values through list Back, tabs and resume", async () => {
  const api = client(), t = copy.ru; api.supportTickets.mockImplementation(async (_status, offset) => offset === 50 ? [supportSummary({ number: "SYNTHETIC page two" })] : Array.from({ length: 50 }, (_, n) => supportSummary({ id: supportId(100 + n), number: n ? `SYNTHETIC item ${n}` : "SYNTHETIC-SUP-001" })));
  await render(<App session={session(api)} />); await fireEvent.press(screen.getByRole("tab", { name: t.support })); await screen.findByText("SYNTHETIC-SUP-001");
  await fireEvent.changeText(screen.getByLabelText(t.searchSupport), "applied search"); await fireEvent(screen.getByLabelText(t.searchSupport), "submitEditing"); await screen.findByText("SYNTHETIC-SUP-001");
  await fireEvent.press(screen.getByRole("tab", { name: supportStatusLabel("WAITING_CUSTOMER", "ru") })); await screen.findByText("SYNTHETIC-SUP-001"); await fireEvent.press(screen.getByRole("button", { name: t.next })); await screen.findByText("SYNTHETIC page two");
  await fireEvent.changeText(screen.getByLabelText(t.searchSupport), "unsent search"); const reads = api.supportTickets.mock.calls.length;
  await fireEvent.press(screen.getByRole("button", { name: t.supportDraftStart })); await fill("ru"); await fireEvent.press(screen.getByRole("button", { name: t.back })); await screen.findByText("SYNTHETIC page two");
  expect(api.supportTickets).toHaveBeenCalledTimes(reads); expect(api.supportTickets.mock.calls.at(-1)).toEqual(["WAITING_CUSTOMER", 50, { q: "applied search", sort: "recent" }]); expect(screen.getByLabelText(t.searchSupport)).toHaveProp("value", "unsent search");
  await fireEvent.press(screen.getByRole("button", { name: t.supportDraftResume })); await fireEvent.press(screen.getByRole("tab", { name: t.catalog })); await screen.findByText(t.emptyCatalog);
  await fireEvent.press(screen.getByRole("tab", { name: t.support })); await screen.findByText("SYNTHETIC page two"); await fireEvent.press(screen.getByRole("button", { name: t.supportDraftResume }));
  expect(screen.getByLabelText(t.supportDraftCategory)).toHaveProp("value", "  SYNTHETIC свой текст  "); expect(api.supportTickets.mock.calls.at(-1)).toEqual(["WAITING_CUSTOMER", 50, { q: "applied search", sort: "recent" }]);
});
it.each(["user", "organization", "environment", "generation", "client"] as const)("isolates and clears the draft before replacement %s context renders", async field => {
  const api = client(), rendered = await open("ru", api); await fill("ru"); const active = { ...scope };
  if (field === "user") active.userId = supportId(99); if (field === "organization") active.organizationId = supportId(98); if (field === "environment") active.environment = "synthetic-other"; if (field === "generation") active.generation++;
  const nextApi = field === "client" ? client() : api; nextApi.supportTickets.mockResolvedValue([supportSummary({ organizationId: active.organizationId })]);
  await rendered.rerender(<App session={session(nextApi, active)} />); await screen.findByText(copy.ru.emptyCatalog); expect(screen.queryByLabelText(copy.ru.supportDraftDescription)).toBeNull();
  await fireEvent.press(screen.getByRole("tab", { name: copy.ru.support })); await screen.findByText("SYNTHETIC-SUP-001"); expect(screen.queryByRole("button", { name: copy.ru.supportDraftResume })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: copy.ru.supportDraftStart })); expect(screen.getByLabelText(copy.ru.supportDraftSubject)).toHaveProp("value", ""); expect(screen.getByLabelText(copy.ru.supportDraftDescription)).toHaveProp("value", "");
});
it("retains recoverable offline text but clears on lost permitted support-list context", async () => {
  const api = client(), t = copy.ru; await open("ru", api); await fill("ru");
  await fireEvent(screen.getByLabelText(t.supportDraftSubject), "selectionChange", { nativeEvent: { selection: { start: 3, end: 8 } } }); api.supportTickets.mockRejectedValueOnce(new Error("SYNTHETIC offline")); await fireEvent.press(screen.getByRole("button", { name: t.refresh })); await screen.findByRole("alert", { name: `${t.error}. ${t.errorBody}` });
  await fireEvent.press(screen.getByRole("button", { name: t.retry })); await screen.findByLabelText(t.supportDraftSubject); expect(screen.getByLabelText(t.supportDraftSubject)).toHaveProp("value", "  SYNTHETIC Тема raw  "); expect(screen.getByLabelText(t.supportDraftSubject)).toHaveProp("selection", { start: 3, end: 8 });
  api.supportTickets.mockRejectedValueOnce({ status: 403, payload: fixture("error-denied") }); await fireEvent.press(screen.getByRole("button", { name: t.refresh })); await screen.findByRole("alert", { name: `${t.denied}. ${t.deniedBody}` }); expect(screen.queryByLabelText(t.supportDraftDescription)).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: t.retry })); await screen.findByRole("text", { name: `${t.supportDraftUnavailable}. ${t.supportDraftUnavailableBody}` });
  await fireEvent.press(screen.getByRole("button", { name: t.supportDraftBack })); expect(screen.getByRole("button", { name: t.supportDraftStart })).toBeOnTheScreen();
});
it("clears on an incompatible foreign-org support response without reflecting the previous draft", async () => {
  const api = client(), t = copy.ru; await open("ru", api); await fill("ru"); api.supportTickets.mockResolvedValueOnce([supportSummary({ organizationId: supportId(99) })]);
  await fireEvent.press(screen.getByRole("button", { name: t.refresh })); await screen.findByRole("alert", { name: `${t.contract}. ${t.contractBody}` }); await fireEvent.press(screen.getByRole("button", { name: t.retry }));
  await screen.findByRole("text", { name: `${t.supportDraftUnavailable}. ${t.supportDraftUnavailableBody}` }); expect(screen.queryByLabelText(t.supportDraftDescription)).toBeNull();
});
it("does not erase input for an unrelated read denial and keeps StrictMode local navigation inert", async () => {
  const api = { ...client(), getOrganizationProfile: jest.fn<NonNullable<MobileReadClient["getOrganizationProfile"]>>().mockRejectedValue({ status: 403, payload: fixture("error-denied") }) }, t = copy.ru;
  await render(<StrictMode><App session={session(api)} /></StrictMode>); await fireEvent.press(screen.getByRole("tab", { name: t.support })); await screen.findByText("SYNTHETIC-SUP-001"); const reads = api.supportTickets.mock.calls.length;
  await fireEvent.press(screen.getByRole("button", { name: t.supportDraftStart })); await fill("ru"); await fireEvent.press(screen.getByRole("button", { name: t.supportDraftBack })); expect(api.supportTickets).toHaveBeenCalledTimes(reads);
  await fireEvent.press(screen.getByRole("tab", { name: t.organization })); await screen.findByRole("alert", { name: `${t.denied}. ${t.deniedBody}` });
  await fireEvent.press(screen.getByRole("tab", { name: t.support })); await screen.findByText("SYNTHETIC-SUP-001"); await fireEvent.press(screen.getByRole("button", { name: t.supportDraftResume })); expect(screen.getByLabelText(t.supportDraftSubject)).toHaveProp("value", "  SYNTHETIC Тема raw  ");
});
