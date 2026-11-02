import { addSupportMessageSchema } from "../../../packages/schemas/src/commercial";
import type { ReadScope } from "./read-controller";
import { checkSupportReplyText, createSupportReplyDrafts } from "./support-reply-draft";
import { supportDetail, supportId, supportOrganization, supportSummary, supportUser } from "./test-fixtures/support";
const scope: ReadScope = { product: "market", environment: "synthetic-offline", userId: supportUser, organizationId: supportOrganization, generation: 1 };
const syntheticKey = supportId(900);
function started() { const store = createSupportReplyDrafts(scope), ticket = supportDetail(); store.syncTicket(ticket); const target = store.begin(ticket)!; return { store, ticket, target }; }

it.each(["", " ", "\n\t\u00a0 ", "a", "  қ\n😀  ", "я".repeat(20000), "я".repeat(20001), "  " + "я".repeat(20000) + "\n", "😀".repeat(20000), "😀".repeat(20000) + "😀"])("matches the real root text-or-attachment refinement and body bounds for case %#", body => {
  const actual = addSupportMessageSchema.safeParse({ idempotencyKey: syntheticKey, body });
  expect(checkSupportReplyText(body) === null).toBe(actual.success);
  const { store, target, ticket } = started(); store.setText(target, body); expect(store.check(target)).toBe(actual.success); expect(store.entryFor(ticket)?.body).toBe(body);
});
it("does not mistake body-field-only acceptance for a valid empty text message without attachments", () => {
  expect(addSupportMessageSchema.shape.body.safeParse(" \n ").success).toBe(true);
  expect(checkSupportReplyText(" \n ")).toEqual({ kind: "required" });
  expect(checkSupportReplyText("я".repeat(20001))).toEqual({ kind: "maximum", count: "20000" });
  expect(addSupportMessageSchema.safeParse({ body: "SYNTHETIC body" }).success).toBe(false);
});
it("retains raw text/identity on checks and separates dirty, checked, error, cancel states", () => {
  const { store, target, ticket } = started(); expect(store.entryFor(ticket)?.dirty).toBe(false); store.check(target); expect(store.entryFor(ticket)?.issue).toEqual({ kind: "required" });
  const body = "  SYNTHETIC Сұрақ\nSecond line\t "; store.setText(target, body); expect(store.entryFor(ticket)).toMatchObject({ dirty: true, checked: false, issue: null, body }); store.check(target); expect(store.entryFor(ticket)).toMatchObject({ dirty: true, checked: true, issue: null, body });
  store.cancel(target); expect(store.entryFor(ticket)).toMatchObject({ started: false, body: "", dirty: false, checked: false, issue: null });
  expect(store.setText(target, "SYNTHETIC old handler")).toBe(false); expect(store.check(target)).toBe(false);
});
it("requires a separately verified detail and isolates ticket drafts, including equal versions and message pages", () => {
  const store = createSupportReplyDrafts(scope), a = supportDetail(), b = supportDetail({ id: supportId(70) });
  store.syncSummaries([supportSummary(), supportSummary({ id: b.id })]); expect(store.begin(a)).toBeNull();
  store.syncTicket(a); const first = store.begin(a)!; store.setText(first, "SYNTHETIC A"); store.syncTicket(b); const second = store.begin(b)!; store.setText(second, "SYNTHETIC B");
  store.syncTicket({ ...a, messages: [], hasOlder: false }); expect(store.begin(a)).toBe(first); expect(store.entryFor(a)?.body).toBe("SYNTHETIC A"); expect(store.entryFor(b)?.body).toBe("SYNTHETIC B");
  store.cancel(first); expect(store.entryFor(b)?.body).toBe("SYNTHETIC B");
});
it.each(["RESOLVED", "CLOSED"] as const)("clears text on %s and never creates a local reply/reopen grant", status => {
  const { store, ticket, target } = started(); store.setText(target, "SYNTHETIC previous body"); const terminal = { ...ticket, version: ticket.version + 1, status };
  store.syncTicket(terminal); expect(store.entryFor(terminal)).toMatchObject({ available: false, started: false, body: "", discarded: true }); expect(store.begin(terminal)).toBeNull(); expect(store.setText(target, "SYNTHETIC late input")).toBe(false);
});
it("clears on version and status changes, blocks stale/copy handles and does not rebase onto older message pages", () => {
  const { store, ticket, target } = started(); store.setText(target, "SYNTHETIC previous body");
  const next = { ...ticket, version: ticket.version + 1 }; store.syncTicket(next); expect(store.entryFor(next)).toMatchObject({ body: "", started: false, discarded: true });
  const latest = store.begin(next)!; store.setText(latest, "SYNTHETIC newer draft"); store.syncTicket(ticket); expect(store.entryFor(ticket)).toBeNull(); expect(store.begin(ticket)).toBeNull(); expect(store.entryFor(next)?.body).toBe("SYNTHETIC newer draft");
  expect(store.setText(target, "SYNTHETIC previous version")).toBe(false); expect(store.setText({ ...latest }, "SYNTHETIC copied handle")).toBe(false);
  const statusChange = { ...next, status: "WAITING_CUSTOMER" as const }; store.syncTicket(statusChange); expect(store.entryFor(statusChange)?.body).toBe(""); expect(store.setText(latest, "SYNTHETIC old status")).toBe(false);
});
it("a newer summary invalidates an existing detail but never grants editor access; missing rows are not deletion", () => {
  const { store, ticket, target } = started(); store.setText(target, "SYNTHETIC body"); store.syncSummaries([]); expect(store.entryFor(ticket)?.body).toBe("SYNTHETIC body");
  const next = supportDetail({ version: 4 }); store.syncSummaries([supportSummary({ version: 4 })]); expect(store.entryFor(next)).toMatchObject({ available: false, body: "", discarded: true }); expect(store.begin(next)).toBeNull();
  store.syncTicket(next); expect(store.begin(next)).not.toBeNull(); expect(store.entryFor(next)?.body).toBe(""); expect(store.setText(target, "SYNTHETIC late text")).toBe(false);
});
it("denial, foreign organization, close and clear erase text and invalidate all previous handles", () => {
  const { store, ticket, target } = started(); store.setText(target, "SYNTHETIC body"); store.invalidate(ticket.id); expect(store.begin(ticket)).toBeNull(); store.syncTicket(ticket); const after = store.begin(ticket)!;
  expect(after).not.toBe(target); expect(store.setText(target, "SYNTHETIC retained callback")).toBe(false); expect(store.entryFor(ticket)?.body).toBe(""); store.setText(after, "SYNTHETIC body2");
  store.syncTicket({ ...ticket, organizationId: supportId(99) }); expect(store.entryFor(ticket)?.body).toBe(""); expect(store.begin(ticket)).toBeNull(); store.clear(); expect(store.getSnapshot().entries).toEqual({});
  store.syncTicket(ticket); const old = store.begin(ticket)!; store.close(); store.syncTicket(ticket); expect(store.begin(ticket)).toBeNull(); expect(store.setText(old, "SYNTHETIC old session")).toBe(false);
  const next = createSupportReplyDrafts({ ...scope, generation: 2 }); next.syncTicket(ticket); next.begin(ticket); expect(next.entryFor(ticket)?.body).toBe("");
});
