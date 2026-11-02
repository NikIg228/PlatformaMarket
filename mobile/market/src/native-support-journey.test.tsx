import { StrictMode } from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { createSupportTicketSchema, addSupportMessageSchema } from "../../../packages/schemas/src/commercial";
import { workspaceOrderPageSchema } from "../../../packages/schemas/src/workspace-reads";
import NativeMarketApp from "./NativeMarketApp";
import { nativeSupportCommandCopy as command, supportCommandCopy as fixtureCommand } from "./SupportCommandUi";
import { conversationSupportCopy as orderLink } from "./ConversationSupportLinkUi";
import { offerSupportCopy as offerLink } from "./OfferConversationSupportLinkUi";
import { orderConversationCopy } from "./OrderConversationRead";
import { offerConversationCopy } from "./OfferConversationRead";
import { copy } from "./i18n";
import { sessionCopy } from "./session-copy";
import type { Locale } from "./format-wire";
import { api, current, response, server, user, workspace } from "./test-fixtures/market-session";
import { listDraftPayload, listDraftComparison, listDraftScope, listDraftId as id } from "./test-fixtures/list-draft";
import { supportDetail, supportSummary } from "./test-fixtures/support";
import { commandFields, createdTicket, postedSupportMessage, replyCommandText, commandEnvelope } from "./test-fixtures/support-commands";
import { conversationScope, conversationWorkflow } from "./test-fixtures/order-conversation";
import { conversationWithSupport, conversationSupportTicket } from "./test-fixtures/conversation-support";
import { offerWithSupport, offerSupportTicket } from "./test-fixtures/offer-conversation-support";
jest.mock("expo/fetch", () => ({ fetch: jest.fn(() => { throw Error("Unexpected real native request"); }) }));
function backend(options: { failure?: number; foreign?: boolean; terminal?: boolean; origin?: "ORDER" | "OFFER"; brokenLink?: boolean } = {}) {
  const scope = options.origin ? conversationScope : listDraftScope, parent = options.origin === "OFFER" ? offerWithSupport() : conversationWithSupport(), workflow = conversationWorkflow();
  if (parent.conversation.context) parent.conversation.context.productId = parent.conversation.productId;
  const ticket = options.origin === "OFFER" ? offerSupportTicket() : options.origin ? conversationSupportTicket() : supportDetail();
  if (options.terminal) ticket.status = "CLOSED";
  if (options.brokenLink) ticket.links[0]!.entityId = id(129999);
  const page = workspaceOrderPageSchema.parse({ items: [{ ...workflow.order, supplier: { id: workflow.order.supplierOrganizationId, displayName: "SYNTHETIC supplier" }, buyer: { id: scope.organizationId, displayName: "SYNTHETIC buyer" }, itemCount: workflow.order.items.length }], nextCursor: null });
  const writes: { path: string; body: string; init: RequestInit }[] = [], receipts = new Map<string, unknown>(); let effects = 0;
  const fetcher = server((path, init) => {
    if (path === "/auth/current?workspace=BUYER") return response(current({ user: { ...user, id: scope.userId }, activeOrganizationId: scope.organizationId, organizationIds: [scope.organizationId], workspaces: [workspace(scope.organizationId)] }));
    if (path.startsWith("/marketplace/search")) return response(listDraftPayload("catalog-null-price"));
    if (path.includes("/compare")) return response(listDraftComparison());
    if (path.startsWith("/workspaces/buyer/orders")) return response(page);
    if (path === `/supplier-orders/${workflow.orderId}/workflow`) return response(workflow);
    if (path.startsWith("/conversations/context?")) return response({ conversationId: parent.conversation.id });
    if (path === `/conversations/${parent.conversation.id}`) return response(parent);
    if (path.startsWith("/support/tickets?") && init.method === "GET") return response([supportSummary(ticket)]);
    if (path.split("?")[0] === `/support/tickets/${ticket.id}` && init.method === "GET") return response(ticket);
    if (path.startsWith("/support/tickets") && init.method === "POST") {
      writes.push({ path, body: String(init.body), init }); if (options.failure === 403) return response(commandEnvelope(403).payload, 403);
      const raw: unknown = JSON.parse(String(init.body)), kind = path === "/support/tickets" ? "create" : "reply";
      const input = kind === "create" ? createSupportTicketSchema.strict().parse(raw) : addSupportMessageSchema.strict().parse(raw), identity = `${kind}/${input.idempotencyKey}`;
      if (!receipts.has(identity)) { const result = kind === "create" ? { ...createdTicket(createSupportTicketSchema.parse(input)), organizationId: scope.organizationId, requesterId: scope.userId } : { ...postedSupportMessage(ticket.id, addSupportMessageSchema.parse(input)), authorId: scope.userId }; receipts.set(identity, result); effects++; }
      if (options.failure === 500 && writes.length === 1) return response(commandEnvelope(500).payload, 500);
      const result = receipts.get(identity) as object;
      return response(options.foreign ? { ...result, ...(kind === "create" ? { organizationId: id(129999), subject: "SYNTHETIC foreign private ticket" } : { ticketId: id(129999), body: "SYNTHETIC foreign private reply" }) } : result, 201);
    }
    return undefined;
  }); return { fetcher, writes, effects: () => effects, scope, ticket, workflow, parent, options };
}
async function start(s: ReturnType<typeof backend>, locale: Locale = "ru", entropy = true) { let serial = 124100; const uuid = jest.fn(() => id(++serial)); await render(<StrictMode><NativeMarketApp initialApiUrl={api} fetcher={s.fetcher} reviewUuidProvider={entropy ? { randomUUID: uuid } : {}} /></StrictMode>); if (locale === "kk") await fireEvent.press(screen.getByRole("tab", { name: "ҚАЗ" })); await screen.findByText("SYNTHETIC product"); return uuid; }
async function general(s: ReturnType<typeof backend>, locale: Locale = "ru", entropy = true) { const uuid = await start(s, locale, entropy); await fireEvent.press(screen.getByRole("tab", { name: copy[locale].support })); await screen.findByText(s.ticket.number); return uuid; }
async function create(s: ReturnType<typeof backend>, locale: Locale = "ru", entropy = true) { const uuid = await general(s, locale, entropy), t = copy[locale]; await fireEvent.press(screen.getByRole("button", { name: t.supportDraftStart })); await screen.findByLabelText(t.supportDraftSubject); for (const [field, label] of [["subject", t.supportDraftSubject], ["description", t.supportDraftDescription], ["category", t.supportDraftCategory]] as const) await fireEvent.changeText(screen.getByLabelText(label), commandFields[field]); return uuid; }
async function reply(s: ReturnType<typeof backend>, locale: Locale = "ru") {
  let uuid: ReturnType<typeof jest.fn>; const t = copy[locale];
  if (!s.options.origin) { uuid = await general(s, locale); await fireEvent.press(screen.getByRole("button", { name: `${t.open}: ${s.ticket.number}` })); }
  else {
    uuid = await start(s, locale);
    if (s.options.origin === "ORDER") { await fireEvent.press(screen.getByRole("tab", { name: t.orders })); await fireEvent.press(await screen.findByRole("button", { name: `${t.open}: ${s.workflow.order.orderNumber}` })); await fireEvent.press(await screen.findByRole("button", { name: orderConversationCopy[locale].open })); await fireEvent.press(await screen.findByRole("button", { name: orderLink[locale].open })); }
    else { await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC product, SYNTHETIC variant` })); await fireEvent.press(await screen.findByRole("button", { name: `${t.open}: SYNTHETIC supplier` })); await fireEvent.press(await screen.findByRole("button", { name: offerConversationCopy[locale].open })); await fireEvent.press(await screen.findByRole("button", { name: offerLink[locale].open })); }
  }
  await fireEvent.press(await screen.findByRole("button", { name: t.supportReplyStart })); await screen.findByLabelText(t.supportReplyBody); await fireEvent.changeText(screen.getByLabelText(t.supportReplyBody), replyCommandText); return uuid;
}
it.each(["ru", "kk"] as const)("creates a native own support ticket only on explicit confirmation in%s", async locale => {
  const s = backend(), t = command[locale], uuid = await create(s, locale); expect(s.writes).toHaveLength(0); expect(uuid).not.toHaveBeenCalled(); expect(screen.queryByText(fixtureCommand[locale].boundaryBody)).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: t.create })); await screen.findByText(t.created); const body = JSON.parse(s.writes[0].body); expect(body).toEqual({ subject: commandFields.subject.trim(), description: commandFields.description.trim(), category: commandFields.category.trim(), priority: "NORMAL", links: [], idempotencyKey: id(124101) });
  expect(s.writes[0].init).toMatchObject({ method: "POST", credentials: "omit", headers: { authorization: "Bearer synthetic-buyer-access-token", "x-organization-id": s.scope.organizationId } }); expect(s.effects()).toBe(1); expect(uuid).toHaveBeenCalledTimes(1); expect(screen.getByLabelText(copy[locale].supportDraftDescription)).toHaveDisplayValue(commandFields.description);
});
it.each(["ru", "kk"] as const)("sends a native public text reply to the selected own ticket in%s", async locale => {
  const s = backend(), t = command[locale], uuid = await reply(s, locale); expect(s.writes).toHaveLength(0); await fireEvent.press(screen.getByRole("button", { name: t.reply })); await screen.findByText(t.replyCreated); expect(s.writes[0].path).toBe(`/support/tickets/${s.ticket.id}/messages`); expect(JSON.parse(s.writes[0].body)).toEqual({ idempotencyKey: id(124101), body: replyCommandText.trim(), isInternal: false, attachments: [] }); expect(s.effects()).toBe(1); expect(uuid).toHaveBeenCalledTimes(1);
});
it.each(["ORDER", "OFFER"].flatMap(origin => (["ru", "kk"] as const).map(locale => ({ origin: origin as "ORDER" | "OFFER", locale }))))("sends native $origin-linked support reply only after independent verified ticket read in$locale", async ({ origin, locale }) => {
  const s = backend({ origin }), t = command[locale]; await reply(s, locale); expect(s.fetcher.mock.calls.some(([url, init]) => url.endsWith(`/support/tickets/${s.ticket.id}`) && init.method === "GET")).toBe(true); expect(s.writes).toHaveLength(0); await fireEvent.press(screen.getByRole("button", { name: t.reply })); await screen.findByText(t.replyCreated); expect(s.writes).toHaveLength(1); expect(s.writes[0].path).toBe(`/support/tickets/${s.ticket.id}/messages`);
});
it.each(["create", "reply"] as const)("preserves the identical native support%s attempt after lost response until explicit replay", async kind => {
  const s = backend({ failure: 500 }), t = command.ru, uuid = await (kind === "create" ? create(s) : reply(s)); await fireEvent.press(screen.getByRole("button", { name: kind === "create" ? t.create : t.reply })); await screen.findByText(t.unknown); expect(s.writes).toHaveLength(1);
  await fireEvent.press(screen.getByRole("button", { name: t.retry })); await screen.findByText(kind === "create" ? t.created : t.replyCreated); expect(s.writes[1].body).toBe(s.writes[0].body); expect(s.effects()).toBe(1); expect(uuid).toHaveBeenCalledTimes(1);
});
it.each(["create", "reply"] as const)("rejects foreign native support%s result before displaying its private fields", async kind => {
  const s = backend({ foreign: true }), t = command.ru; await (kind === "create" ? create(s) : reply(s)); await fireEvent.press(screen.getByRole("button", { name: kind === "create" ? t.create : t.reply })); await screen.findByText(t.invalid); expect(screen.queryByText("SYNTHETIC foreign private ticket")).toBeNull(); expect(screen.queryByText("SYNTHETIC foreign private reply")).toBeNull(); expect(s.writes).toHaveLength(1);
});
it.each(["create", "reply"] as const)("invalidates native support%s command authority after source403", async kind => {
  const s = backend({ failure: 403 }), t = command.ru; await (kind === "create" ? create(s) : reply(s)); await fireEvent.press(screen.getByRole("button", { name: kind === "create" ? t.create : t.reply })); expect(screen.queryByText(kind === "create" ? t.created : t.replyCreated)).toBeNull(); expect(screen.queryByRole("button", { name: t.retry })).toBeNull(); expect(s.effects()).toBe(0); expect(s.writes).toHaveLength(1);
});
it("keeps support text local when native UUID is unavailable", async () => { const s = backend(); await create(s, "ru", false); expect(screen.queryByRole("button", { name: command.ru.create })).toBeNull(); expect(screen.getByLabelText(copy.ru.supportDraftSubject)).toHaveDisplayValue(commandFields.subject); expect(s.writes).toHaveLength(0); });
it("does not expose a public reply for a terminal native ticket", async () => { const s = backend({ terminal: true }); await general(s); await fireEvent.press(screen.getByRole("button", { name: `${copy.ru.open}: ${s.ticket.number}` })); await screen.findByText(copy.ru.supportReplyUnavailable); expect(screen.queryByRole("button", { name: command.ru.reply })).toBeNull(); expect(s.writes).toHaveLength(0); });
it("clears the unresolved support attempt and private draft on confirmed logout", async () => { const s = backend({ failure: 500 }), t = command.ru; await create(s); await fireEvent.press(screen.getByRole("button", { name: t.create })); await screen.findByText(t.unknown); await fireEvent.press(screen.getByRole("button", { name: sessionCopy.ru.logout })); await screen.findByLabelText(sessionCopy.ru.password); expect(screen.queryByText(t.unknown)).toBeNull(); expect(screen.queryByLabelText(copy.ru.supportDraftSubject)).toBeNull(); expect(s.writes).toHaveLength(1); });
