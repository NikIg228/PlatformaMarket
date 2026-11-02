import { StrictMode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import App from "../App";
import type { MobileReadClient } from "./read-controller";
import type { SupportCommandFixture, AddSupportInput } from "./support-command-fixture";
import { supportCommandCopy } from "./SupportCommandUi";
import { commandScope, syntheticSupportAuthorization, replyCommandText, postedSupportMessage, commandEnvelope, commandFields, createdTicket } from "./test-fixtures/support-commands";
import { supportSummary, supportDetail, supportId } from "./test-fixtures/support";
import { listDraftPayload } from "./test-fixtures/list-draft";
import { copy } from "./i18n";
function setup() {
  let counter = 3000, ticket = supportDetail(); const key = jest.fn(() => supportId(++counter));
  const send = jest.fn(async (_scope: typeof commandScope, id: string, input: AddSupportInput): Promise<unknown> => postedSupportMessage(id, input));
  const fixture: SupportCommandFixture = { authorization: syntheticSupportAuthorization(), nextIdempotencyKey: key, addSupportMessage: send };
  const client: MobileReadClient = { searchCatalog: async () => listDraftPayload("catalog-empty"), compareOffers: async () => listDraftPayload("comparison-exact-offer"), workspaceOrders: async () => listDraftPayload("workspace-orders-page"), getOrderWorkflow: async () => listDraftPayload("order-workflow-minimal"), supportTickets: async () => [supportSummary(ticket)], supportTicket: async () => ticket, supportCommandFixture: fixture };
  return { client, fixture, key, send, setTicket: (value: typeof ticket) => { ticket = value; } };
}
const session = (client: MobileReadClient, scope = commandScope) => ({ client, scope, organizationName: "SYNTHETIC" });
async function open(client: MobileReadClient, locale: "ru" | "kk" = "ru") {
  const view = await render(<StrictMode><App session={session(client)} locale={locale} /></StrictMode>), t = copy[locale];
  await fireEvent.press(screen.getByRole("tab", { name: t.support })); await screen.findByText("SYNTHETIC-SUP-001"); await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC-SUP-001` })); await screen.findByRole("button", { name: t.supportReplyStart }); await fireEvent.press(screen.getByRole("button", { name: t.supportReplyStart })); await screen.findByLabelText(t.supportReplyBody); return view;
}
it.each(["absent", "permission"])("keeps the reply command unavailable without explicit synthetic authorization: %s", async variant => {
  const s = setup(); if (variant === "absent") delete s.client.supportCommandFixture; else s.fixture.authorization = { ...s.fixture.authorization, permissions: [] };
  await open(s.client); expect(screen.queryByRole("button", { name: supportCommandCopy.ru.reply })).toBeNull(); expect(s.send).not.toHaveBeenCalled();
});
it.each(["ru", "kk"] as const)("shows only the validated fake reply result in %s and does not append an optimistic message/version", async locale => {
  const s = setup(), t = copy[locale], c = supportCommandCopy[locale]; await open(s.client, locale); await fireEvent.changeText(screen.getByLabelText(t.supportReplyBody), replyCommandText); await fireEvent.press(screen.getByRole("button", { name: c.reply })); await screen.findByText(c.replyCreated); expect(screen.getByText(replyCommandText.trim())).toBeOnTheScreen(); expect(s.send).toHaveBeenCalledTimes(1); expect(s.key).toHaveBeenCalledTimes(1); expect(screen.getByLabelText(t.supportReplyBody)).toHaveProp("value", replyCommandText); expect(screen.getByLabelText(t.supportReplyBody)).toHaveProp("editable", false);
  await fireEvent.press(screen.getByRole("button", { name: c.replyDone })); await screen.findByText("SYNTHETIC user body 61"); expect(screen.queryByText(replyCommandText.trim())).toBeNull();
});
it("keeps an unknown reply attempt across Back/locale and a newer current ticket, replays the same key instead of sending a new body", async () => {
  const s = setup(); s.send.mockRejectedValueOnce(new Error("SYNTHETIC lost response")); const view = await open(s.client); await fireEvent.changeText(screen.getByLabelText(copy.ru.supportReplyBody), replyCommandText); await fireEvent.press(screen.getByRole("button", { name: supportCommandCopy.ru.reply })); await screen.findByText(supportCommandCopy.ru.unknown);
  expect(screen.getByLabelText(copy.ru.supportReplyBody)).toHaveProp("editable", false); expect(screen.queryByRole("button", { name: copy.ru.supportReplyCancel })).toBeNull(); await fireEvent.press(screen.getByRole("button", { name: copy.ru.supportReplyBack })); await fireEvent.press(screen.getByRole("button", { name: copy.ru.supportReplyResume }));
  s.setTicket(supportDetail({ version: 4 })); await fireEvent.press(screen.getByRole("button", { name: copy.ru.refresh })); await screen.findByText(copy.ru.supportReplyUnavailable);
  await view.rerender(<StrictMode><App session={session(s.client)} locale="kk" /></StrictMode>); await screen.findByText(supportCommandCopy.kk.unknown); expect(screen.getByText(replyCommandText.trim())).toBeOnTheScreen(); expect(screen.queryByRole("button", { name: supportCommandCopy.kk.reply })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: supportCommandCopy.kk.retry })); await screen.findByText(supportCommandCopy.kk.replyCreated); expect(s.key).toHaveBeenCalledTimes(1); expect(s.send.mock.calls[1]![2]).toBe(s.send.mock.calls[0]![2]);
});
it("keeps raw multiline text and selection after a definitive fake rejection, then sends an explicit edited request", async () => {
  const s = setup(); s.send.mockRejectedValueOnce(commandEnvelope(409)); const view = await open(s.client); await fireEvent.changeText(screen.getByLabelText(copy.ru.supportReplyBody), replyCommandText); await fireEvent(screen.getByLabelText(copy.ru.supportReplyBody), "selectionChange", { nativeEvent: { selection: { start: 3, end: 8 } } });
  await fireEvent.press(screen.getByRole("button", { name: supportCommandCopy.ru.reply })); await screen.findByText(supportCommandCopy.ru.rejected); expect(screen.getByLabelText(copy.ru.supportReplyBody)).toHaveProp("editable", true); expect(screen.queryByText("SYNTHETIC private command error")).toBeNull();
  await view.rerender(<StrictMode><App session={session(s.client)} locale="kk" /></StrictMode>); expect(screen.getByLabelText(copy.kk.supportReplyBody)).toHaveProp("value", replyCommandText); expect(screen.getByLabelText(copy.kk.supportReplyBody)).toHaveProp("selection", { start: 3, end: 8 });
  await fireEvent.changeText(screen.getByLabelText(copy.kk.supportReplyBody), "SYNTHETIC corrected public reply"); expect(screen.queryByRole("button", { name: supportCommandCopy.kk.retry })).toBeNull(); await fireEvent.press(screen.getByRole("button", { name: supportCommandCopy.kk.reply })); await screen.findByText(supportCommandCopy.kk.replyCreated); expect(s.key).toHaveBeenCalledTimes(2);
});
it.each(["generation", "client"])("drops late replies after %s context replacement", async field => {
  const s = setup(); let finish!: (body: unknown) => void; s.send.mockImplementationOnce(() => new Promise(yes => { finish = yes; })); const view = await open(s.client); await fireEvent.changeText(screen.getByLabelText(copy.ru.supportReplyBody), replyCommandText); await fireEvent.press(screen.getByRole("button", { name: supportCommandCopy.ru.reply }));
  const client = field === "client" ? { ...s.client } : s.client, scope = { ...commandScope, generation: field === "generation" ? 2 : commandScope.generation };
  await view.rerender(<StrictMode><App session={session(client, scope)} /></StrictMode>); await screen.findByText(copy.ru.emptyCatalog); const hidden = jest.fn(() => { throw new Error("Stale reply decoded"); }), body = {}; Object.defineProperty(body, "id", { get: hidden }); await act(async () => finish(body)); expect(hidden).not.toHaveBeenCalled(); expect(screen.queryByText(supportCommandCopy.ru.replyCreated)).toBeNull();
});
it("connects creation then public reply using returned fake records and explicit fresh reads, with no optimistic ticket/message", async () => {
  const s = setup(); let saved = supportDetail(); s.setTicket(saved);
  s.fixture.createSupportTicket = async (_scope, input) => { const summary = createdTicket(input); saved = supportDetail({ ...summary, messages: [{ ...postedSupportMessage(summary.id, { idempotencyKey: supportId(9999), body: input.description, isInternal: false, attachments: [] }), id: supportId(441) }] }); s.setTicket(saved); return summary; };
  s.send.mockImplementation(async (_scope, id, input) => { const message = postedSupportMessage(id, input); saved = supportDetail({ ...saved, version: saved.version + 1, messages: [...saved.messages, message] }); s.setTicket(saved); return message; });
  await render(<StrictMode><App session={session(s.client)} /></StrictMode>); await fireEvent.press(screen.getByRole("tab", { name: copy.ru.support })); await screen.findByText("SYNTHETIC-SUP-001"); await fireEvent.press(screen.getByRole("button", { name: copy.ru.supportDraftStart }));
  for (const [field, label] of [["subject", copy.ru.supportDraftSubject], ["description", copy.ru.supportDraftDescription], ["category", copy.ru.supportDraftCategory]] as const) await fireEvent.changeText(screen.getByLabelText(label), commandFields[field]);
  await fireEvent.press(screen.getByRole("button", { name: supportCommandCopy.ru.create })); await screen.findByText(`${supportCommandCopy.ru.number}: SYNTHETIC-CREATED-330`); await fireEvent.press(screen.getByRole("button", { name: copy.ru.supportDraftBack })); await fireEvent.press(screen.getByRole("button", { name: copy.ru.refresh })); await screen.findByRole("button", { name: `${copy.ru.open}: SYNTHETIC-CREATED-330` });
  await fireEvent.press(screen.getByRole("button", { name: `${copy.ru.open}: SYNTHETIC-CREATED-330` })); await screen.findByRole("button", { name: copy.ru.supportReplyStart }); await fireEvent.press(screen.getByRole("button", { name: copy.ru.supportReplyStart })); await fireEvent.changeText(screen.getByLabelText(copy.ru.supportReplyBody), replyCommandText); await fireEvent.press(screen.getByRole("button", { name: supportCommandCopy.ru.reply })); await screen.findByText(supportCommandCopy.ru.replyCreated);
  await fireEvent.press(screen.getByRole("button", { name: supportCommandCopy.ru.replyDone })); await fireEvent.press(screen.getByRole("button", { name: copy.ru.refresh })); await screen.findByText(replyCommandText.trim()); expect(s.key).toHaveBeenCalledTimes(2); expect(s.send).toHaveBeenCalledTimes(1); expect(saved.version).toBe(4);
});
