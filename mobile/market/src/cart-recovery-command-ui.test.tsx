import { StrictMode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import App from "../App";
import * as CartUi from "./CartRead";
import type { CartResponse } from "../../../packages/schemas/src/core-api";
import type { MobileReadClient } from "./read-controller";
import type { CartCommandFixture, CartVersionInput } from "./cart-command-fixture";
import { cartWorkspaceCommandCopy as commandCopy } from "./CartWorkspaceCommandUi";
import { recoveredCartCopy } from "./recovered-cart-link";
import { cartCommandAuthorization, cartCommandScope, cartCommandError, createdCartResult, recoveryCartSource, recoveredCartResult, recoveryTargetId } from "./test-fixtures/cart-commands";
import { listDraftPayload } from "./test-fixtures/list-draft";
import { savedPage } from "./test-fixtures/carts";
import { copy } from "./i18n";
import { formatMinor } from "./format-wire";
import { captureHardwareBack } from "./test-fixtures/hardware-back";

function setup() {
  let source = recoveryCartSource(), active: CartResponse | null = null, receipt: CartResponse | null = null;
  const recover = jest.fn(async (_scope: typeof cartCommandScope, _id: string, _input: CartVersionInput): Promise<unknown> => {
    if (receipt) return receipt;
    receipt = recoveredCartResult(); active = receipt; source.recoveredCartId = receipt.id;
    return receipt;
  });
  const fixture: CartCommandFixture = { authorization: cartCommandAuthorization(), recoverCart: recover };
  const read = jest.fn(async () => savedPage(active?.status === "ACTIVE" && active.checkout === null ? active : null, [source]));
  const detail = jest.fn(async () => receipt ?? recoveredCartResult());
  const client: MobileReadClient = { searchCatalog: async () => listDraftPayload("catalog-empty"), compareOffers: async () => listDraftPayload("comparison-exact-offer"), workspaceOrders: async () => listDraftPayload("workspace-orders-page"), getOrderWorkflow: async () => listDraftPayload("order-workflow-minimal"), workspaceCarts: read, workspaceCart: detail, cartCommandFixture: fixture };
  return { recover, fixture, read, detail, client, setSource: (cart: CartResponse) => { source = cart; }, setActive: (cart: CartResponse | null) => { active = cart; }, setReceipt: (cart: CartResponse) => { receipt = cart; } };
}
const session = (client: MobileReadClient, scope = cartCommandScope) => ({ client, scope, organizationName: "SYNTHETIC" });
async function open(client: MobileReadClient, locale: "ru" | "kk" = "ru") {
  const view = await render(<StrictMode><App session={session(client)} locale={locale} /></StrictMode>);
  await fireEvent.press(screen.getByRole("tab", { name: copy[locale].cart })); await screen.findByText(copy[locale].failedCarts);
  return view;
}
async function recover(locale: "ru" | "kk" = "ru") { await fireEvent.press(screen.getByRole("button", { name: `${commandCopy[locale].recoveryStart}: ${copy[locale].savedCart} 1` })); }

it.each(["ru", "kk"] as const)("hardware Back restores original lost recovery review without sending a prepared newer version in%s", async locale => {
 const hardware = captureHardwareBack(), s = setup(), t = commandCopy[locale];
 try {
  s.recover.mockRejectedValueOnce(Error("SYNTHETIC lost recovery")); await open(s.client, locale); await recover(locale); await screen.findByText(t.recoveryUnknownBody); const original = s.recover.mock.calls[0]![2]; s.setSource(recoveryCartSource(8)); await fireEvent.press(screen.getByRole("button", { name: t.read })); await screen.findByText(t.reviewBody); await fireEvent.press(screen.getByRole("button", { name: t.recoveryPrepare })); await screen.findByText(t.recoveryPreparedBody);
  const reads = s.read.mock.calls.length; expect(await hardware.press()).toBe(true); await screen.findByText(t.reviewBody); expect(screen.queryByText(t.recoveryPreparedBody)).toBeNull(); expect(screen.getByRole("button", { name: t.replayRecovery })).toBeOnTheScreen(); expect(screen.getByText(`${t.expectedVersion}: ${original.expectedVersion}`)).toBeOnTheScreen(); expect(screen.getByText(t.priorBody)).toBeOnTheScreen(); expect(s.recover).toHaveBeenCalledTimes(1); expect(s.recover.mock.calls[0]![2]).toBe(original); expect(s.read).toHaveBeenCalledTimes(reads); expect(s.detail).not.toHaveBeenCalled(); expect(await hardware.press()).toBe(false);
 } finally { hardware.restore(); }
});

it.each(["absent", "permission"])("has no recovery action without explicit injected authority: %s", async kind => {
  const s = setup(); if (kind === "absent") delete s.client.cartCommandFixture; else s.fixture.authorization = { ...s.fixture.authorization, permissions: [] };
  await open(s.client); expect(screen.queryByRole("button", { name: new RegExp(commandCopy.ru.recoveryStart.replace(/[()]/g, "\\$&")) })).toBeNull(); expect(s.recover).not.toHaveBeenCalled();
});

it.each(["ru", "kk"] as const)("shows only explicit recovery on the actual failed row and independently reads the returned cart in %s", async locale => {
  const s = setup(), t = commandCopy[locale], c = copy[locale]; await open(s.client, locale);
  expect(s.recover).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: t.start })).toBeNull();
  await recover(locale); await screen.findByText(t.recoveryResultBody);
  expect(s.recover.mock.calls[0]).toEqual([cartCommandScope, recoveryCartSource().id, { expectedVersion: 4 }]);
  expect(screen.getByText(`${t.total}: ${formatMinor(recoveredCartResult().items[0]!.totalPriceMinor, recoveredCartResult().currency, locale)}`)).toBeOnTheScreen();
  expect(screen.getByText(c.noCurrentCart)).toBeOnTheScreen(); expect(screen.queryByText("SYNTHETIC private pricing")).toBeNull();
  const newer = recoveredCartResult(9); newer.items[0]!.quantity = "8.5"; s.setReceipt(newer);
  await fireEvent.press(screen.getByRole("button", { name: t.openResult })); await screen.findByText(`${c.quantity}: 8.5`); expect(s.detail).toHaveBeenCalledWith(recoveryTargetId);
  await fireEvent.press(screen.getByRole("button", { name: c.back })); await screen.findByText(recoveredCartCopy[locale].body);
  expect(s.read.mock.calls.at(-1)).toEqual([{ limit: 1, q: "" }]); expect(s.recover).toHaveBeenCalledTimes(1);
});

it("disables recovery rather than replacing a nonempty current cart", async () => {
  const s = setup(); s.setActive(createdCartResult()); await open(s.client);
  expect(screen.getByText(commandCopy.ru.recoveryBlocked)).toBeOnTheScreen();
  const button = screen.getByRole("button", { name: `${commandCopy.ru.recoveryStart}: ${copy.ru.savedCart} 1` }); expect(button).toBeDisabled(); await fireEvent.press(button);
  expect(s.recover).not.toHaveBeenCalled(); expect(screen.getByText(`${copy.ru.quantity}: 3.000001`)).toBeOnTheScreen();
});

it("offers an existing recovered target read instead of another new recovery", async () => {
  const s = setup(), source = recoveryCartSource(); source.recoveredCartId = recoveryTargetId; s.setSource(source); await open(s.client);
  await screen.findByText(recoveredCartCopy.ru.body); expect(screen.queryByRole("button", { name: `${commandCopy.ru.recoveryStart}: ${copy.ru.savedCart} 1` })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: `${recoveredCartCopy.ru.open}: ${copy.ru.savedCart} 1` })); await screen.findByText(`${copy.ru.snapshotVersion}: 1`);
  expect(s.recover).not.toHaveBeenCalled(); expect(s.detail).toHaveBeenCalledWith(recoveryTargetId);
});

it("does not resend a pending recovery across duplicate presses or locale change", async () => {
  const s = setup(); let finish!: (value: unknown) => void; s.recover.mockImplementationOnce(() => new Promise(done => { finish = done; })); const view = await open(s.client);
  const button = screen.getByRole("button", { name: `${commandCopy.ru.recoveryStart}: ${copy.ru.savedCart} 1` }); await fireEvent.press(button); await fireEvent.press(button);
  await view.rerender(<StrictMode><App session={session(s.client)} locale="kk" /></StrictMode>); expect(screen.getByLabelText(commandCopy.kk.pending)).toBeOnTheScreen();
  await act(async () => finish(recoveredCartResult())); await screen.findByText(commandCopy.kk.recoveryResultBody); expect(s.recover).toHaveBeenCalledTimes(1);
});

it("recovers the same committed operation after a lost reply and newer source without creating a second target", async () => {
  const s = setup(), t = commandCopy.ru; let executions = 0, receipt: CartResponse | null = null;
  s.recover.mockImplementation(async () => { if (receipt) return receipt; executions++; receipt = recoveredCartResult(); throw new Error("SYNTHETIC committed response lost"); });
  await open(s.client); await recover(); await screen.findByText(t.recoveryUnknownBody); const original = s.recover.mock.calls[0]![2];
  const source = recoveryCartSource(25); source.recoveredCartId = recoveryTargetId; s.setSource(source); s.setActive(recoveredCartResult(6));
  await fireEvent.press(screen.getByRole("button", { name: t.read })); await screen.findByText(t.reviewBody);
  expect(screen.queryByText(t.recoveryResultBody)).toBeNull(); expect(screen.getByText(`${t.expectedVersion}: 4`)).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: t.recoveryPrepare })).toBeNull();
  receipt = recoveredCartResult(91); receipt.status = "CHECKED_OUT"; receipt.checkout = { id: "00000000-0000-4000-8000-000000000090", status: "COMPLETED" }; receipt.items[0]!.quantity = "99";
  await fireEvent.press(screen.getByRole("button", { name: t.replayRecovery })); await screen.findByText(t.recoveryResultBody);
  expect(s.recover.mock.calls[1]![2]).toBe(original); expect(executions).toBe(1); expect(screen.getByText(`${t.version}: 91`)).toBeOnTheScreen(); expect(screen.queryByText(t.priorBody)).toBeNull();
});

it("requires separate read/review/explicit submit after409, without automatically changing the sent version", async () => {
  const s = setup(), t = commandCopy.ru; s.recover.mockRejectedValueOnce(cartCommandError(409)); await open(s.client); await recover(); await screen.findByText(t.rejectedBody);
  expect(screen.queryByRole("button", { name: t.replayRecovery })).toBeNull(); expect(screen.queryByText("SYNTHETIC private cart error")).toBeNull();
  s.setSource(recoveryCartSource(8)); await fireEvent.press(screen.getByRole("button", { name: t.read })); await screen.findByText(t.reviewBody); expect(screen.getByText(`${t.expectedVersion}: 4`)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: t.recoveryPrepare })); await screen.findByText(t.recoveryPreparedBody); expect(s.recover).toHaveBeenCalledTimes(1); expect(screen.getByText(`${t.expectedVersion}: 8`)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: t.recoverySubmit })); await screen.findByText(t.recoveryResultBody); expect(s.recover.mock.calls.map(call => call[2])).toEqual([{ expectedVersion: 4 }, { expectedVersion: 8 }]);
});

it("restores original replay after cancelling a prepared newer version and keeps read-error recovery reachable", async () => {
  const s = setup(), t = commandCopy.ru; s.recover.mockRejectedValueOnce(new Error("SYNTHETIC lost reply")); await open(s.client); await recover(); await screen.findByText(t.recoveryUnknownBody);
  s.read.mockRejectedValueOnce(new Error("SYNTHETIC offline")); await fireEvent.press(screen.getByRole("button", { name: t.read })); await screen.findByText(t.readError);
  s.setSource(recoveryCartSource(8)); await fireEvent.press(screen.getByRole("button", { name: t.read })); await screen.findByText(t.reviewBody);
  await fireEvent.press(screen.getByRole("button", { name: t.recoveryPrepare })); await screen.findByText(t.recoveryPreparedBody); await fireEvent.press(screen.getByRole("button", { name: t.returnReview }));
  expect(screen.getByText(`${t.expectedVersion}: 4`)).toBeOnTheScreen(); await fireEvent.press(screen.getByRole("button", { name: t.replayRecovery })); await screen.findByText(t.recoveryResultBody);
  expect(s.recover.mock.calls[1]![2]).toBe(s.recover.mock.calls[0]![2]);
});

it.each(["generation", "organizationId", "client"])("drops late recovery before content decoding on %s replacement", async field => {
  const s = setup(); let finish!: (value: unknown) => void; s.recover.mockImplementationOnce(() => new Promise(done => { finish = done; })); const view = await open(s.client); await recover();
  const scope = { ...cartCommandScope, ...(field === "generation" ? { generation: 2 } : field === "organizationId" ? { organizationId: "00000000-0000-4000-8000-000000000099" } : {}) };
  await view.rerender(<StrictMode><App session={session(field === "client" ? { ...s.client } : s.client, scope)} /></StrictMode>); await screen.findByText(copy.ru.emptyCatalog);
  const decoded = jest.fn(() => { throw new Error("Late recovery decoded"); }), result = {}; Object.defineProperty(result, "id", { get: decoded }); await act(async () => finish(result));
  expect(decoded).not.toHaveBeenCalled(); expect(screen.queryByText(commandCopy.ru.recoveryResultBody)).toBeNull();
});

it("rejects retained recovery row callbacks and a result navigation after leaving its page", async () => {
  const real = CartUi.CartWorkspaceRead, pages: Parameters<typeof real>[0][] = [], spy = jest.spyOn(CartUi, "CartWorkspaceRead").mockImplementation(props => { pages.push(props); return real(props); });
  try {
    const s = setup(); await open(s.client); const first = pages.at(-1)!;
    await fireEvent.press(screen.getByRole("button", { name: copy.ru.refresh })); await screen.findByText(copy.ru.failedCarts);
    await act(async () => first.workspaceCommands?.startRecovery(first.page, first.page.items[0]!)); expect(s.recover).not.toHaveBeenCalled();
    await recover(); await screen.findByText(commandCopy.ru.recoveryResultBody); const last = pages.at(-1)!, result = last.workspaceCommands!.getSnapshot().result!;
    await fireEvent.press(screen.getByRole("tab", { name: copy.ru.catalog })); await screen.findByText(copy.ru.emptyCatalog);
    await act(async () => last.onCommandResult?.(result)); expect(s.detail).not.toHaveBeenCalled();
  } finally { spy.mockRestore(); }
});
