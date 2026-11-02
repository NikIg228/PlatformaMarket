import { StrictMode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import App from "../App";
import type { MobileReadClient } from "./read-controller";
import type { SupportCommandFixture, CreateSupportInput } from "./support-command-fixture";
import { supportCommandCopy } from "./SupportCommandUi";
import { commandScope, syntheticSupportAuthorization, commandFields, createdTicket, commandEnvelope } from "./test-fixtures/support-commands";
import { supportSummary, supportDetail, supportId } from "./test-fixtures/support";
import { listDraftPayload } from "./test-fixtures/list-draft";
import { copy } from "./i18n";
function setup() {
  let counter = 1000; const key = jest.fn(() => supportId(++counter));
  const create = jest.fn(async (_scope: typeof commandScope, input: CreateSupportInput): Promise<unknown> => createdTicket(input));
  const fixture: SupportCommandFixture = { authorization: syntheticSupportAuthorization(), nextIdempotencyKey: key, createSupportTicket: create };
  const client: MobileReadClient = { searchCatalog: async () => listDraftPayload("catalog-empty"), compareOffers: async () => listDraftPayload("comparison-exact-offer"), workspaceOrders: async () => listDraftPayload("workspace-orders-page"), getOrderWorkflow: async () => listDraftPayload("order-workflow-minimal"), supportTickets: async () => [supportSummary()], supportTicket: async () => supportDetail(), supportCommandFixture: fixture };
  return { client, fixture, key, create };
}
const session = (client: MobileReadClient, scope = commandScope) => ({ client, scope, organizationName: "SYNTHETIC" });
async function open(client: MobileReadClient, locale: "ru" | "kk" = "ru") {
  const view = await render(<StrictMode><App session={session(client)} locale={locale} /></StrictMode>);
  await fireEvent.press(screen.getByRole("tab", { name: copy[locale].support })); await screen.findByText("SYNTHETIC-SUP-001"); await fireEvent.press(screen.getByRole("button", { name: copy[locale].supportDraftStart })); await screen.findByLabelText(copy[locale].supportDraftSubject); return view;
}
async function fill(locale: "ru" | "kk" = "ru") { const t = copy[locale]; for (const [field, label] of [["subject", t.supportDraftSubject], ["description", t.supportDraftDescription], ["category", t.supportDraftCategory]] as const) await fireEvent.changeText(screen.getByLabelText(label), commandFields[field]); }
it.each(["absent", "permission"])("keeps create unavailable without accepted injected source authorization: %s", async variant => {
  const s = setup(); if (variant === "absent") delete s.client.supportCommandFixture; else s.fixture.authorization = { ...s.fixture.authorization, permissions: [] };
  await open(s.client); await fill(); expect(screen.queryByRole("button", { name: supportCommandCopy.ru.create })).toBeNull(); expect(s.create).not.toHaveBeenCalled(); expect(s.key).not.toHaveBeenCalled();
});
it.each(["ru", "kk"] as const)("creates only through the explicit fake port and shows its validated returned result in %s under StrictMode", async locale => {
  const s = setup(), t = supportCommandCopy[locale]; await open(s.client, locale); await fill(locale); expect(s.create).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: t.create })); await screen.findByText(`${t.number}: SYNTHETIC-CREATED-330`); expect(s.create).toHaveBeenCalledTimes(1); expect(s.key).toHaveBeenCalledTimes(1); expect(screen.getByLabelText(copy[locale].supportDraftDescription)).toHaveProp("value", commandFields.description); expect(screen.getByLabelText(copy[locale].supportDraftSubject)).toHaveProp("editable", false);
  expect(screen.queryByRole("button", { name: t.create })).toBeNull(); await fireEvent.press(screen.getByRole("button", { name: t.newDraft })); expect(screen.getByLabelText(copy[locale].supportDraftSubject)).toHaveProp("value", ""); expect(screen.getByRole("button", { name: t.create })).toBeOnTheScreen();
});
it("keeps pending/unknown distinct from success and replays one immutable attempt across locale/Back", async () => {
  const s = setup(); let fail!: (error: unknown) => void; s.create.mockImplementationOnce(() => new Promise((_yes, no) => { fail = no; })); const view = await open(s.client); await fill(); await fireEvent.press(screen.getByRole("button", { name: supportCommandCopy.ru.create })); await screen.findByRole("progressbar", { name: supportCommandCopy.ru.pending });
  expect(screen.getByLabelText(copy.ru.supportDraftDescription)).toHaveProp("editable", false); expect(screen.queryByRole("button", { name: copy.ru.supportDraftCancel })).toBeNull(); await act(async () => fail(new Error("SYNTHETIC timeout"))); await screen.findByText(supportCommandCopy.ru.unknown); expect(screen.queryByText(/SYNTHETIC-CREATED/)).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: copy.ru.supportDraftBack })); await fireEvent.press(screen.getByRole("button", { name: copy.ru.supportDraftResume }));
  await view.rerender(<StrictMode><App session={session(s.client)} locale="kk" /></StrictMode>); await screen.findByText(supportCommandCopy.kk.unknown);
  await fireEvent.press(screen.getByRole("button", { name: supportCommandCopy.kk.retry })); await screen.findByText(`${supportCommandCopy.kk.number}: SYNTHETIC-CREATED-330`); expect(s.key).toHaveBeenCalledTimes(1); expect(s.create.mock.calls[1]![1]).toBe(s.create.mock.calls[0]![1]);
});
it("retains editable raw fields on definitive rejection and submits changed fields with a new key only on explicit action", async () => {
  const s = setup(); s.create.mockRejectedValueOnce(commandEnvelope(400)); await open(s.client); await fill(); await fireEvent.press(screen.getByRole("button", { name: supportCommandCopy.ru.create })); await screen.findByText(supportCommandCopy.ru.rejected);
  expect(screen.getByLabelText(copy.ru.supportDraftDescription)).toHaveProp("value", commandFields.description); expect(screen.getByLabelText(copy.ru.supportDraftSubject)).toHaveProp("editable", true); expect(screen.queryByText("SYNTHETIC private command error")).toBeNull();
  await fireEvent.changeText(screen.getByLabelText(copy.ru.supportDraftSubject), "SYNTHETIC corrected request"); expect(screen.queryByRole("button", { name: supportCommandCopy.ru.retry })).toBeNull(); expect(s.create).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole("button", { name: supportCommandCopy.ru.create })); await screen.findByText(`${supportCommandCopy.ru.number}: SYNTHETIC-CREATED-330`); expect(s.key).toHaveBeenCalledTimes(2);
});
it("does not apply a late command result after the authenticated generation changes", async () => {
  const s = setup(); let finish!: (body: unknown) => void; s.create.mockImplementationOnce(() => new Promise(yes => { finish = yes; })); const view = await open(s.client); await fill(); await fireEvent.press(screen.getByRole("button", { name: supportCommandCopy.ru.create }));
  await view.rerender(<StrictMode><App session={session(s.client, { ...commandScope, generation: 2 })} /></StrictMode>); await screen.findByText(copy.ru.emptyCatalog); const hidden = jest.fn(() => { throw new Error("Old command result decoded"); }), body = {}; Object.defineProperty(body, "id", { get: hidden }); await act(async () => finish(body)); expect(hidden).not.toHaveBeenCalled(); expect(screen.queryByText(/SYNTHETIC-CREATED/)).toBeNull();
});
