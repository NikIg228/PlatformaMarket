import { archiveLinksCopy } from "./ArchiveDocumentLinks";
import { logoutRecoveryCopy } from "./session-logout-recovery";
import { foregroundSessionCopy } from "./foreground-session-recovery";
import { cartAddCopy } from "./CartAddCommandUi";
import { cartAddComparison } from "./test-fixtures/cart-commands";
import { cartWorkspaceCommandCopy } from "./CartWorkspaceCommandUi";
import { recoveredCartCopy } from "./recovered-cart-link";
import { cartCommandCopy } from "./CartCommandUi";
import { supportCommandCopy } from "./SupportCommandUi";
import { archiveDocument, archiveDocumentId, archivePage, archiveSummary } from "./test-fixtures/document-archive";
import { cityFixture } from "./test-fixtures/public-cities";
import { attributesComparison } from "./test-fixtures/comparison-attributes";
import { attributesCopy } from "./ComparisonAttributesRead";
import { orderListCopy } from "./OrderListRead";
import { orderStatusCopy, orderStatusFilterLabel } from "./OrderStatusFilters";
import { orderHistoryCopy, orderHistoryActionLabel } from "./OrderHistoryRead";
import { historyWorkflow } from "./test-fixtures/order-history";
import { goodsReturnCopy } from "./GoodsReturnDraftUi";
import { goodsReturnWorkflow } from "./test-fixtures/goods-return-draft";
import { receiptDraftCopy } from "./ShipmentReceiptDraftUi";
import { receiptWorkflow } from "./test-fixtures/receipt-draft";
import { cancellationCopy } from "./OrderCancellationDraftUi";
import { cancellationWorkflow } from "./test-fixtures/cancellation-draft";
import { archiveParticipantCopy } from "./ArchiveParticipantMetadata";
import { archiveSignatureCopy } from "./ArchiveSignatureMetadata";
import { archiveHistoryCopy } from "./ArchiveVersionHistory";
import { orderCommentsCopy } from "./OrderCommentsRead";
import { commentWorkflow, orderComments } from "./test-fixtures/order-comments";
import { savedListFixture } from "./test-fixtures/saved-lists";
import { cityCopy } from "./DeliveryCityRead";
import { reviewCopy } from "./PublishedReviewsRead";
import { archiveCopy } from "./document-archive-i18n";
import { intentCheckout } from "./test-fixtures/payment-intent";
import { copy } from "./i18n";
import { ownOrganization } from "./test-fixtures/organization";
import { savedCart, savedCheckout, savedPage, failedCartId, checkoutId } from "./test-fixtures/carts";
import { catalogSearchResponseSchema } from "../../../packages/schemas/src/core-api";
import { supportDetail, supportId, supportSummary } from "./test-fixtures/support";
import { StrictMode } from "react";
import { AppState } from "react-native";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import NativeMarketApp from "./NativeMarketApp";
import type { FetchTransport } from "./market-transport";
import { sessionCopy } from "./session-copy";

jest.mock("expo/fetch", () => ({ fetch: jest.fn() }));
const api = "https://market.example.invalid/api";
const org = "00000000-0000-4000-8000-000000000004";
const user = { id: "00000000-0000-4000-8000-000000000020", email: "synthetic@example.invalid", displayName: "SYNTHETIC account" };
const sessionId = "00000000-0000-4000-8000-000000000021";
const context = { organizationId: org, organizationDisplayName: "SYNTHETIC organization", capabilities: ["BUYER"] };
const auth = { user, accessToken: "synthetic-private-access-token", accessTokenExpiresIn: 300, sessionId, activeOrganizationId: org, organizationIds: [org], csrfToken: "synthetic-private-csrf-token", refreshTokenExpiresAt: "2099-01-01T00:00:00.000Z" };
const mfa = { enabled: false, status: "NOT_ENROLLED", verifiedAt: null, lastUsedAt: null, recoveryCodesRemaining: 0, lockedUntil: null };
const corpus = JSON.parse(readFileSync(resolve(__dirname, "../../../contracts/mobile-read/fixtures.json"), "utf8")) as { cases: { id: string; payload: unknown }[] };
const payload = (id: string) => corpus.cases.find(item => item.id === id)!.payload;
const response = (body: unknown, status = 200) => ({ status, ok: status >= 200 && status < 300, text: async () => JSON.stringify(body) });
function server(override?: (path: string) => ReturnType<typeof response> | Promise<ReturnType<typeof response>> | undefined) {
  return jest.fn<ReturnType<FetchTransport>, Parameters<FetchTransport>>(async (url) => {
    const path = url.slice(api.length); const result = override?.(path); if (result) return result;
    if (path === "/auth/current?workspace=BUYER") return response(null);
    if (path === "/auth/login") return response(auth, 201);
    if (path === "/identity/mfa") return response(mfa);
    if (path === "/auth/workspaces") return response([context]);
    if (path === "/auth/workspace-context") return response(context);
    if (path === "/auth/handoff") return response({ organizationId: org, organizationDisplayName: context.organizationDisplayName, capability: "BUYER", handoffCode: "synthetic-single-use-handoff", expiresAt: "2099-01-01T00:00:00.000Z" }, 201);
    if (path === "/auth/handoff/exchange") return response({ ...auth, ...context, capability: "BUYER" }, 201);
    if (path === "/auth/session-logout") return response({ sessionId, status: "REVOKED", loginStatus: "REVOKED" }, 201);
    if (path.startsWith("/marketplace/search")) return response(payload("catalog-null-price"));
    if (path.startsWith("/workspaces/buyer/orders")) return response(payload("workspace-orders-page"));
    throw new Error(`Unexpected synthetic request: ${path}`);
  });
}
async function signIn() {
  await screen.findByLabelText("Email");
  await fireEvent.changeText(screen.getByLabelText("Email"), user.email);
  await fireEvent.changeText(screen.getByLabelText("Пароль"), "synthetic-password");
  await fireEvent.press(screen.getByRole("button", { name: "Войти" }));
  await screen.findByRole("button", { name: "Открыть: SYNTHETIC organization" });
}
async function openBuyer() {
  await fireEvent.press(screen.getByRole("button", { name: "Открыть: SYNTHETIC organization" }));
  await screen.findByText("SYNTHETIC product");
}
it("makes no request until an explicit valid HTTPS server is configured", async () => {
  const fetcher = server(); await render(<NativeMarketApp initialApiUrl="" fetcher={fetcher} />);
  expect(fetcher).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText("HTTPS-адрес API"), "http://localhost/api");
  await fireEvent.press(screen.getByRole("button", { name: "Подключиться" }));
  expect(fetcher).not.toHaveBeenCalled(); expect(screen.getByText("Введите HTTPS-адрес без пароля, параметров и фрагмента.")).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText("HTTPS-адрес API"), api); await fireEvent.press(screen.getByRole("button", { name: "Подключиться" }));
  await screen.findByLabelText("Пароль"); expect(fetcher.mock.calls[0][0]).toBe(`${api}/auth/current?workspace=BUYER`);
});
it("connects login, explicit organization, actual read decoder and confirmed logout", async () => {
  const fetcher = server(); await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn();
  expect(fetcher.mock.calls.some(([url]) => url.includes("/marketplace/"))).toBe(false);
  await openBuyer(); expect(screen.getByText(user.displayName)).toBeOnTheScreen();
  const read = fetcher.mock.calls.find(([url]) => url.includes("/marketplace/search"))!;
  expect(new URL(read[0]).searchParams.get("buyerOrganizationId")).toBe(org); expect(read[1]).toMatchObject({ headers: { authorization: `Bearer ${auth.accessToken}` }, credentials: "omit" });
  await fireEvent.press(screen.getByRole("button", { name: "Выйти" })); await screen.findByLabelText("Пароль"); expect(screen.queryByText("SYNTHETIC product")).not.toBeOnTheScreen();
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/auth/session-logout"))).toHaveLength(1);
});
it("clears the password after failed login and never renders a raw server error", async () => {
  const fetcher = server(path => path === "/auth/login" ? response({ message: "synthetic-secret-message" }, 401) : undefined);
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await screen.findByLabelText("Пароль");
  await fireEvent.changeText(screen.getByLabelText("Email"), user.email); await fireEvent.changeText(screen.getByLabelText("Пароль"), "synthetic-password"); await fireEvent.press(screen.getByRole("button", { name: "Войти" }));
  await screen.findByText("Сеанс не подтверждён. Войдите заново."); expect(screen.getByLabelText("Пароль")).toHaveProp("value", ""); expect(screen.getByLabelText("Email")).toHaveProp("value", user.email); expect(screen.queryByText("synthetic-secret-message")).not.toBeOnTheScreen();
});
it("restores a server-verified session once under StrictMode", async () => {
  const fetcher = server(path => path.startsWith("/auth/current") ? response({ ...auth, workspaces: [context] }) : undefined);
  await render(<StrictMode><NativeMarketApp initialApiUrl={api} fetcher={fetcher} /></StrictMode>); await screen.findByText("SYNTHETIC product");
  expect(fetcher.mock.calls.filter(([url]) => url.includes("/auth/current"))).toHaveLength(1); expect(fetcher.mock.calls.some(([url]) => url.endsWith("/auth/login"))).toBe(false);
});
it("closes authenticated reads after unknown logout and checks current independently", async () => {
  const fetcher = server(path => path === "/auth/session-logout" ? response(null, 503) : undefined);
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer(); await fireEvent.press(screen.getByRole("button", { name: "Выйти" }));
  await screen.findByText("Сервер не ответил. Проверьте соединение и повторите действие."); await screen.findByRole("button", { name: logoutRecoveryCopy.ru.check }); expect(screen.queryByText("SYNTHETIC product")).toBeNull(); expect(screen.queryByLabelText("Пароль")).toBeNull(); await fireEvent.press(screen.getByRole("button", { name: logoutRecoveryCopy.ru.check })); await screen.findByLabelText("Пароль"); expect(screen.getByText(logoutRecoveryCopy.ru.history)).toBeOnTheScreen(); expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/auth/session-logout"))).toHaveLength(1);
});
it("closes old read data on revoked refresh instead of falling back to development headers", async () => {
  const fetcher = server(path => path.startsWith("/workspaces/buyer/orders") || path === "/auth/refresh" ? response(null, 401) : undefined);
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer(); await fireEvent.press(screen.getByRole("tab", { name: "Заказы" }));
  await screen.findByLabelText("Пароль"); expect(screen.queryByText("SYNTHETIC product")).not.toBeOnTheScreen();
  for (const [, init] of fetcher.mock.calls) expect(init.headers).not.toHaveProperty("x-user-id");
});
it("checks the same server session on foreground without silently switching accounts", async () => {
  let listener: ((state: "active" | "background") => void) | undefined; let changed = false;
  const originalImplementation = jest.isMockFunction(AppState.addEventListener) ? jest.mocked(AppState.addEventListener).getMockImplementation() : undefined;
  const subscription = jest.spyOn(AppState, "addEventListener").mockImplementation((_event, callback) => { listener = callback; return { remove: jest.fn() }; });
  try {
    const fetcher = server(path => path.startsWith("/auth/current") ? response({ ...auth, user: changed ? { ...user, id: org } : user, workspaces: [context] }) : undefined);
    await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await screen.findByText("SYNTHETIC product"); changed = true;
    await act(async () => { listener!("background"); listener!("active"); }); await screen.findByRole("button", { name: foregroundSessionCopy.ru.continue }); expect(screen.queryByText("SYNTHETIC product")).not.toBeOnTheScreen(); expect(screen.queryByLabelText("Пароль")).toBeNull(); await fireEvent.press(screen.getByRole("button", { name: sessionCopy.ru.logout })); await screen.findByLabelText("Пароль");
  } finally {
    subscription.mockRestore();
    if (originalImplementation) jest.mocked(AppState.addEventListener).mockImplementation(originalImplementation);
  }
});

it.each(["ru", "kk"] as const)("uses keyboard submit for API setup, login and MFA in %s without bypassing empty-input guards", async locale => {
  const t = sessionCopy[locale];
  const fetcher = server(path => path === "/identity/mfa" ? response({ ...mfa, enabled: true, status: "ACTIVE" })
    : path === "/identity/mfa/challenge" ? response({ accessToken: "synthetic-elevated-access-token", accessTokenExpiresIn: 300, activeOrganizationId: org, authenticationMethods: ["password", "totp"], factor: { verified: true, method: "TOTP", challengeId: user.id, recoveryCodesRemaining: 0 } }) : undefined);
  await render(<NativeMarketApp initialApiUrl="" fetcher={fetcher} />);
  if (locale === "kk") await fireEvent.press(screen.getByRole("tab", { name: "ҚАЗ" }));
  await fireEvent.changeText(screen.getByLabelText(t.api), "http://localhost/api");
  await fireEvent(screen.getByLabelText(t.api), "submitEditing");
  expect(screen.getByRole("alert", { name: t.invalidUrl })).toBeOnTheScreen();
  expect(screen.getByLabelText(t.api)).toHaveProp("accessibilityHint", t.invalidUrl);
  expect(fetcher).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText(t.api), api);
  await fireEvent(screen.getByLabelText(t.api), "submitEditing");
  await screen.findByLabelText(t.password);
  await fireEvent.changeText(screen.getByLabelText(t.email), user.email);
  expect(screen.getByLabelText(t.email)).toHaveProp("returnKeyType", "next");
  await fireEvent(screen.getByLabelText(t.email), "submitEditing");
  expect(fetcher.mock.calls.some(([url]) => url.endsWith("/auth/login"))).toBe(false);
  await fireEvent.changeText(screen.getByLabelText(t.password), "synthetic-keyboard-password");
  await fireEvent(screen.getByLabelText(t.password), "submitEditing");
  await screen.findByLabelText(t.code);
  expect(screen.queryByLabelText(t.password)).toBeNull();
  await fireEvent.changeText(screen.getByLabelText(t.code), "   ");
  await fireEvent(screen.getByLabelText(t.code), "submitEditing");
  expect(screen.getByRole("button", { name: t.verify })).toBeDisabled();
  expect(fetcher.mock.calls.some(([url]) => url.endsWith("/identity/mfa/challenge"))).toBe(false);
  await fireEvent.changeText(screen.getByLabelText(t.code), "123456");
  await fireEvent(screen.getByLabelText(t.code), "submitEditing");
  await screen.findByRole("button", { name: `${t.open}: SYNTHETIC organization` });
  const challenges = fetcher.mock.calls.filter(([url]) => url.endsWith("/identity/mfa/challenge"));
  expect(challenges).toHaveLength(1);
  expect(challenges[0][1].body).toBe(JSON.stringify({ code: "123456" }));
  expect(fetcher.mock.calls.some(([url]) => url.includes("/marketplace/"))).toBe(false);
});

it("does not submit or clear a password through Enter while Email contains only whitespace", async () => {
  const fetcher = server();
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />);
  await screen.findByLabelText("Пароль");
  await fireEvent.changeText(screen.getByLabelText("Email"), "   ");
  await fireEvent.changeText(screen.getByLabelText("Пароль"), "synthetic-keyboard-password");
  await fireEvent(screen.getByLabelText("Пароль"), "submitEditing");
  expect(screen.getByRole("button", { name: "Войти" })).toBeDisabled();
  expect(screen.getByLabelText("Пароль")).toHaveDisplayValue("synthetic-keyboard-password");
  expect(fetcher.mock.calls.some(([url]) => url.endsWith("/auth/login"))).toBe(false);
});

it.each(["ru", "kk"] as const)("clears a failed MFA code and permits only a fresh explicit keyboard retry in %s", async locale => {
  const t = sessionCopy[locale];
  const fetcher = server(path => path === "/identity/mfa" ? response({ ...mfa, enabled: true, status: "ACTIVE" }) : path === "/identity/mfa/challenge" ? response({ message: "synthetic-private-mfa-error" }, 503) : undefined);
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />);
  if (locale === "kk") await fireEvent.press(screen.getByRole("tab", { name: "ҚАЗ" }));
  await screen.findByLabelText(t.password);
  await fireEvent.changeText(screen.getByLabelText(t.email), user.email);
  await fireEvent.changeText(screen.getByLabelText(t.password), "synthetic-keyboard-password");
  await fireEvent(screen.getByLabelText(t.password), "submitEditing");
  await screen.findByLabelText(t.code);
  await fireEvent.changeText(screen.getByLabelText(t.code), "123456");
  await fireEvent(screen.getByLabelText(t.code), "submitEditing");
  await screen.findByRole("alert", { name: t.issue.network });
  expect(screen.getByLabelText(t.code)).toHaveDisplayValue("");
  expect(screen.getByRole("button", { name: t.verify })).toBeDisabled();
  expect(screen.queryByText("synthetic-private-mfa-error")).toBeNull();
  await fireEvent(screen.getByLabelText(t.code), "submitEditing");
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/identity/mfa/challenge"))).toHaveLength(1);
});

it.each(["ru", "kk"] as const)("offers an accessible empty organization state and a real choices reload in %s", async locale => {
  const t = sessionCopy[locale]; let allowed = false;
  const fetcher = server(path => path === "/auth/workspaces" ? response(allowed ? [context] : []) : undefined);
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />);
  if (locale === "kk") await fireEvent.press(screen.getByRole("tab", { name: "ҚАЗ" }));
  await screen.findByLabelText(t.password);
  await fireEvent.changeText(screen.getByLabelText(t.email), user.email);
  await fireEvent.changeText(screen.getByLabelText(t.password), "synthetic-password");
  await fireEvent.press(screen.getByRole("button", { name: t.submit }));
  await screen.findByRole("text", { name: t.empty });
  expect(screen.getByRole("button", { name: t.logout })).toBeEnabled();
  allowed = true; await fireEvent.press(screen.getByRole("button", { name: t.reloadOrganizations }));
  await screen.findByRole("button", { name: `${t.open}: SYNTHETIC organization` });
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/auth/workspaces"))).toHaveLength(2);
  expect(fetcher.mock.calls.some(([url]) => url.includes("/marketplace/"))).toBe(false);
  await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC organization` }));
  await screen.findByText("SYNTHETIC product");
});

it("does not invent a selectorless reload and clears the login draft on exit from an empty account", async () => {
  const fetcher = server(path => path === "/auth/login" ? response({ ...auth, activeOrganizationId: null, organizationIds: [] }, 201) : undefined);
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />);
  await screen.findByLabelText("Пароль");
  await fireEvent.changeText(screen.getByLabelText("Email"), user.email);
  await fireEvent.changeText(screen.getByLabelText("Пароль"), "synthetic-password");
  await fireEvent.press(screen.getByRole("button", { name: "Войти" }));
  await screen.findByRole("text", { name: sessionCopy.ru.empty });
  expect(screen.queryByRole("button", { name: sessionCopy.ru.reloadOrganizations })).toBeNull();
  expect(fetcher.mock.calls.some(([url]) => url.endsWith("/auth/workspaces") || url.endsWith("/auth/handoff"))).toBe(false);
  await fireEvent.press(screen.getByRole("button", { name: "Выйти" }));
  await screen.findByLabelText("Пароль");
  expect(screen.getByLabelText("Email")).toHaveDisplayValue("");
  expect(screen.getByLabelText("Пароль")).toHaveDisplayValue("");
});

it("preserves a secure login draft when locale changes and submits it only on explicit action", async () => {
  const fetcher = server();
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />);
  await screen.findByLabelText("Пароль");
  await fireEvent.changeText(screen.getByLabelText("Email"), user.email);
  await fireEvent.changeText(screen.getByLabelText("Пароль"), "synthetic-retained-password");
  await fireEvent.press(screen.getByRole("tab", { name: "ҚАЗ" }));
  expect(screen.getByLabelText(sessionCopy.kk.email)).toHaveDisplayValue(user.email);
  expect(screen.getByLabelText(sessionCopy.kk.password)).toHaveDisplayValue("synthetic-retained-password");
  expect(screen.getByLabelText(sessionCopy.kk.password)).toHaveProp("secureTextEntry", true);
  expect(fetcher).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole("button", { name: sessionCopy.kk.submit }));
  await screen.findByRole("button", { name: `${sessionCopy.kk.open}: SYNTHETIC organization` });
  const login = fetcher.mock.calls.filter(([url]) => url.endsWith("/auth/login"));
  expect(login).toHaveLength(1);
  expect(JSON.parse(String(login[0][1].body))).toEqual({ email: user.email, password: "synthetic-retained-password" });
});

it("does not restart a pending login or bootstrap when locale changes", async () => {
  let resolve!: (reply: ReturnType<typeof response>) => void;
  const pending = new Promise<ReturnType<typeof response>>(yes => { resolve = yes; });
  const fetcher = server(path => path === "/auth/login" ? pending : undefined);
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />);
  await screen.findByLabelText("Пароль");
  await fireEvent.changeText(screen.getByLabelText("Email"), user.email);
  await fireEvent.changeText(screen.getByLabelText("Пароль"), "synthetic-pending-password");
  await fireEvent.press(screen.getByRole("button", { name: "Войти" }));
  await fireEvent.press(screen.getByRole("tab", { name: "ҚАЗ" }));
  expect(screen.getByRole("progressbar", { name: sessionCopy.kk.loading, busy: true })).toBeOnTheScreen();
  await act(async () => { resolve(response(auth, 201)); });
  await screen.findByRole("button", { name: `${sessionCopy.kk.open}: SYNTHETIC organization` });
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/auth/login"))).toHaveLength(1);
  expect(fetcher.mock.calls.filter(([url]) => url.includes("/auth/current"))).toHaveLength(1);
});

it("binds current-cart viewing to the existing buyer GET with bearer and no creation request", async () => {
  const fetcher = server(path => path.startsWith("/workspaces/buyer/carts?") ? response({ current: null, items: [], nextCursor: null }) : undefined);
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer();
  await fireEvent.press(screen.getByRole("tab", { name: "Корзина" }));
  await screen.findByText("Текущей корзины пока нет");
  const calls = fetcher.mock.calls.filter(([url]) => url.includes("/workspaces/buyer/carts"));
  expect(calls).toHaveLength(1); expect(calls[0][0]).toBe(`${api}/workspaces/buyer/carts?limit=1`);
  expect(calls[0][1]).toMatchObject({ method: "GET", credentials: "omit", headers: { authorization: `Bearer ${auth.accessToken}` } });
  expect(fetcher.mock.calls.some(([url, init]) => init.method === "POST" && /\/carts|checkout|recover/.test(url))).toBe(false);
});

it("passes order search/group through the authenticated existing GET with exact URL encoding", async () => {
  const fetcher = server();
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />);
  await signIn(); await openBuyer();
  await fireEvent.press(screen.getByRole("tab", { name: "Заказы" }));
  await screen.findByText("SYNTHETIC-READ-001");
  await fireEvent.changeText(screen.getByLabelText("Найти заказ"), " /? + & қ ");
  await fireEvent(screen.getByLabelText("Найти заказ"), "submitEditing");
  await screen.findByText("SYNTHETIC-READ-001");
  await fireEvent.press(screen.getByRole("tab", { name: "В работе" }));
  await screen.findByText("SYNTHETIC-READ-001");
  const calls = fetcher.mock.calls.filter(([url]) => url.includes("/workspaces/buyer/orders"));
  const [url, init] = calls.at(-1)!;
  expect(new URL(url).pathname).toBe("/api/workspaces/buyer/orders");
  expect(Object.fromEntries(new URL(url).searchParams)).toEqual({ limit: "50", q: "/? + & қ", group: "active" });
  expect(init).toMatchObject({ headers: { authorization: `Bearer ${auth.accessToken}` }, credentials: "omit" });
  expect(init.method ?? "GET").toBe("GET");
  expect(init.headers).not.toHaveProperty("x-user-id");
});

it("uses authenticated existing support GETs for search/status/sort and older messages without read/mutation calls", async () => {
  const detail = supportDetail();
  const fetcher = server(path => path.startsWith("/support/tickets?") ? response([supportSummary()])
    : path.startsWith(`/support/tickets/${supportId(60)}`) ? response(path.includes("beforeMessageId=") ? supportDetail({ messages: [{ ...detail.messages[0]!, id: supportId(59), body: "SYNTHETIC native older" }], hasOlder: false }) : detail) : undefined);
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer();
  await fireEvent.press(screen.getByRole("tab", { name: "Поддержка" })); await screen.findByText("SYNTHETIC-SUP-001");
  await fireEvent.changeText(screen.getByLabelText("Найти обращение"), " /? + & қ ");
  await fireEvent(screen.getByLabelText("Найти обращение"), "submitEditing"); await screen.findByText("SYNTHETIC-SUP-001");
  await fireEvent.press(screen.getByRole("tab", { name: "Ожидает ответа клиента" })); await screen.findByText("SYNTHETIC-SUP-001");
  const lists = fetcher.mock.calls.filter(([url]) => new URL(url).pathname === "/api/support/tickets");
  expect(Object.fromEntries(new URL(lists.at(-1)![0]).searchParams)).toEqual({ offset: "0", status: "WAITING_CUSTOMER", q: "/? + & қ", sort: "recent" });
  await fireEvent.press(screen.getByRole("button", { name: "Открыть: SYNTHETIC-SUP-001" })); await screen.findByText("SYNTHETIC user body 61");
  await fireEvent.press(screen.getByRole("button", { name: "Более ранние сообщения" })); await screen.findByText("SYNTHETIC native older");
  const calls = fetcher.mock.calls.filter(([url]) => url.includes("/support/"));
  expect(calls.at(-1)![0]).toBe(`${api}/support/tickets/${supportId(60)}?beforeMessageId=${supportId(61)}`);
  for (const [, init] of calls) {
    expect(init.method ?? "GET").toBe("GET");
    expect(init).toMatchObject({ headers: { authorization: `Bearer ${auth.accessToken}` }, credentials: "omit" });
    expect(init.headers).not.toHaveProperty("x-user-id");
  }
  expect(fetcher.mock.calls.some(([url]) => /notifications|inbox|\/read(?:$|\?)/.test(url))).toBe(false);
});

it("passes catalog category/supplier facet IDs through the existing scoped GET without using them as identity", async () => {
  const categoryId = "00000000-0000-4000-8000-000000000040", supplierId = "00000000-0000-4000-8000-000000000041";
  const catalog = catalogSearchResponseSchema.parse(payload("catalog-null-price"));
  catalog.facets = { categories: [{ id: categoryId, name: "SYNTHETIC category", count: 1 }], suppliers: [{ id: supplierId, name: "SYNTHETIC supplier filter", count: 1 }] };
  const fetcher = server(path => path.startsWith("/marketplace/search") ? response(catalog) : undefined);
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer();
  await fireEvent.press(screen.getByRole("button", { name: "Фильтры каталога" }));
  await fireEvent.press(screen.getByRole("tab", { name: "Категория: SYNTHETIC category" })); await screen.findByText("SYNTHETIC product");
  await fireEvent.press(screen.getByRole("button", { name: "Фильтры каталога" }));
  await fireEvent.press(screen.getByRole("tab", { name: "Поставщик: SYNTHETIC supplier filter" })); await screen.findByText("SYNTHETIC product");
  const calls = fetcher.mock.calls.filter(([url]) => url.includes("/marketplace/search"));
  expect(calls.filter(([url]) => new URL(url).searchParams.get("includeFilterOptions") === "true")).toHaveLength(2);
  expect(calls.filter(([url]) => !new URL(url).searchParams.has("includeFilterOptions"))).toHaveLength(3);
  for (const [, options] of calls) expect(options).toMatchObject({ credentials: "omit", headers: { authorization: `Bearer ${auth.accessToken}` } });
  const [url, init] = calls.at(-1)!;
  expect(Object.fromEntries(new URL(url).searchParams)).toEqual({ offset: "0", categoryId, supplierOrganizationId: supplierId, buyerOrganizationId: org });
  expect(init.method ?? "GET").toBe("GET"); expect(init).toMatchObject({ headers: { authorization: `Bearer ${auth.accessToken}` }, credentials: "omit" });
});

it("reads failed cart page/detail/saved checkout via existing authenticated GETs and never invokes checkout/recover commands", async () => {
  const cursor = "SYNTHETIC:failed+/=cursor";
  const fetcher = server(path => path.startsWith("/workspaces/buyer/carts?") ? response(savedPage(null, [savedCart(failedCartId, 2, true)], cursor))
    : path === `/workspaces/buyer/carts/${failedCartId}` ? response(savedCart(failedCartId, 2, true))
    : path === `/checkouts/${checkoutId}` ? response(savedCheckout()) : undefined);
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer();
  await fireEvent.press(screen.getByRole("tab", { name: "Корзина" })); await screen.findByText("После неудачного оформления");
  await fireEvent.press(screen.getByRole("button", { name: "Далее" })); await screen.findByText("Версия сохранённой корзины: 2");
  const pages = fetcher.mock.calls.filter(([url]) => new URL(url).pathname === "/api/workspaces/buyer/carts");
  expect(Object.fromEntries(new URL(pages.at(-1)![0]).searchParams)).toEqual({ limit: "1", cursor });
  await fireEvent.press(screen.getByRole("button", { name: "Открыть: Сохранённая корзина 1" })); await screen.findByText("Количество: 1.000001");
  await fireEvent.press(screen.getByRole("button", { name: "Посмотреть результат оформления" })); await screen.findByText("Позиций в снимке корзины: 1");
  const calls = fetcher.mock.calls.filter(([url]) => /\/(?:carts|checkouts)(?:\/|\?)/.test(url));
  expect(calls.map(([url]) => new URL(url).pathname)).toContain(`/api/checkouts/${checkoutId}`);
  for (const [, init] of calls) { expect(init.method ?? "GET").toBe("GET"); expect(init).toMatchObject({ headers: { authorization: `Bearer ${auth.accessToken}` }, credentials: "omit" }); }
  expect(fetcher.mock.calls.some(([url]) => /\/(?:recover|validate|checkout)$/.test(url))).toBe(false);
  expect(screen.queryByText("SYNTHETIC private idempotency")).toBeNull(); expect(screen.queryByText("SYNTHETIC private failure")).toBeNull();
});

it("reads current organization profile through the existing context-bound GET only on explicit navigation", async () => {
  const fetcher = server(path => path === "/organizations/current/profile" ? response(ownOrganization()) : undefined);
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer();
  expect(fetcher.mock.calls.some(([url]) => url.endsWith("/organizations/current/profile"))).toBe(false);
  await fireEvent.press(screen.getByRole("tab", { name: "Организация" })); await screen.findByText("Юридическое наименование: SYNTHETIC legal organization");
  const calls = fetcher.mock.calls.filter(([url]) => url.endsWith("/organizations/current/profile")); expect(calls).toHaveLength(1);
  expect(calls[0]![1].method ?? "GET").toBe("GET"); expect(calls[0]![1]).toMatchObject({ headers: { authorization: `Bearer ${auth.accessToken}` }, credentials: "omit" });
  expect(screen.queryByText("SYNTHETIC private BIN")).toBeNull();
});

it("checks/returns/cancels quantity drafts entirely in memory with original server values and no request", async () => {
  const fetcher = server(path => path.startsWith("/workspaces/buyer/carts?") ? response(savedPage(savedCart(), [])) : undefined);
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer();
  await fireEvent.press(screen.getByRole("tab", { name: "Корзина" })); await screen.findByText("Количество: 1.000001");
  const requests = fetcher.mock.calls.length;
  await fireEvent.press(screen.getByRole("button", { name: "Изменить количество локально: Позиция корзины 1" }));
  await fireEvent.changeText(screen.getByLabelText("Количество в черновике"), "2,5"); await fireEvent.press(screen.getByRole("button", { name: "Проверить черновик" }));
  await screen.findByRole("text", { name: "Формат количества проверен. Черновик хранится только в приложении и не отправлен на сервер." });
  await fireEvent.press(screen.getByRole("button", { name: "Вернуться к корзине" })); expect(screen.getByText("Количество: 1.000001")).toBeOnTheScreen();
  expect(screen.getByText("Локальный черновик: 2,5")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Отменить все черновики" })); expect(fetcher).toHaveBeenCalledTimes(requests);
  expect(fetcher.mock.calls.some(([url]) => /\/(?:validate|reprice|recover|checkout)(?:$|\?)/.test(url))).toBe(false);
  for (const [url, init] of fetcher.mock.calls.filter(([url]) => !url.includes("/auth/") && !url.includes("/identity/"))) expect(init.method ?? "GET").toBe("GET");
});

it("keeps unsent support draft edits/priority/check/Back/resume/cancel entirely in memory", async () => {
  const t = copy.ru, fetcher = server(path => path.startsWith("/support/tickets?") ? response([supportSummary()]) : undefined);
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer();
  await fireEvent.press(screen.getByRole("tab", { name: t.support })); await screen.findByText("SYNTHETIC-SUP-001"); const requests = fetcher.mock.calls.length;
  await fireEvent.press(screen.getByRole("button", { name: t.supportDraftStart }));
  await fireEvent.changeText(screen.getByLabelText(t.supportDraftSubject), "  SYNTHETIC native subject  "); await fireEvent.changeText(screen.getByLabelText(t.supportDraftDescription), "  SYNTHETIC native description\nraw text  "); await fireEvent.changeText(screen.getByLabelText(t.supportDraftCategory), "SYNTHETIC free category");
  await fireEvent.press(screen.getByRole("tab", { name: "Срочный" })); await fireEvent.press(screen.getByRole("button", { name: t.supportDraftCheck }));
  await screen.findByRole("text", { name: `${t.supportDraftChecked}. ${t.supportDraftOnlyLocal}` }); expect(screen.queryByText("SYNTHETIC-SUP-001")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: t.supportDraftBack })); await fireEvent.press(screen.getByRole("button", { name: t.supportDraftResume })); expect(screen.getByLabelText(t.supportDraftSubject)).toHaveProp("value", "  SYNTHETIC native subject  ");
  await fireEvent.press(screen.getByRole("button", { name: t.supportDraftCancel })); expect(fetcher).toHaveBeenCalledTimes(requests);
  for (const [url, init] of fetcher.mock.calls.filter(([url]) => !url.includes("/auth/") && !url.includes("/identity/"))) expect(init.method ?? "GET").toBe("GET");
});
it("drops an unsent support draft on confirmed logout and starts empty in a new session for the same user/org", async () => {
  const t = copy.ru; let again = false;
  const fetcher = server(path => path.startsWith("/support/tickets?") ? response([supportSummary()])
    : again && path === "/auth/login" ? response({ ...auth, sessionId: supportId(999) }, 201)
    : again && path === "/auth/handoff/exchange" ? response({ ...auth, ...context, sessionId: supportId(999), capability: "BUYER" }, 201) : undefined);
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer();
  await fireEvent.press(screen.getByRole("tab", { name: t.support })); await screen.findByText("SYNTHETIC-SUP-001"); await fireEvent.press(screen.getByRole("button", { name: t.supportDraftStart }));
  await fireEvent.changeText(screen.getByLabelText(t.supportDraftSubject), "SYNTHETIC previous session draft"); await fireEvent.press(screen.getByRole("button", { name: t.supportDraftBack }));
  await fireEvent.press(screen.getByRole("button", { name: "Выйти" })); await screen.findByLabelText("Пароль"); again = true;
  await signIn(); await openBuyer(); await fireEvent.press(screen.getByRole("tab", { name: t.support })); await screen.findByText("SYNTHETIC-SUP-001");
  expect(screen.queryByRole("button", { name: t.supportDraftResume })).toBeNull(); await fireEvent.press(screen.getByRole("button", { name: t.supportDraftStart })); expect(screen.getByLabelText(t.supportDraftSubject)).toHaveProp("value", "");
});

it("edits/checks/Back/resumes/cancels an unsent reply to a read ticket without any transport request", async () => {
  const t = copy.ru, fetcher = server(path => path.startsWith("/support/tickets?") ? response([supportSummary()]) : path === `/support/tickets/${supportId(60)}` ? response(supportDetail()) : undefined);
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer(); await fireEvent.press(screen.getByRole("tab", { name: t.support })); await screen.findByText("SYNTHETIC-SUP-001"); await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC-SUP-001` })); await screen.findByText("SYNTHETIC user body 61"); const requests = fetcher.mock.calls.length;
  await fireEvent.press(screen.getByRole("button", { name: t.supportReplyStart })); await fireEvent.changeText(screen.getByLabelText(t.supportReplyBody), " \n "); await fireEvent.press(screen.getByRole("button", { name: t.supportReplyCheck })); await screen.findByRole("alert", { name: `${t.supportReplyError}. ${t.supportReplyRequired}` });
  const body = "  SYNTHETIC native reply\nСұрақ  "; await fireEvent.changeText(screen.getByLabelText(t.supportReplyBody), body); await fireEvent.press(screen.getByRole("button", { name: t.supportReplyCheck })); await screen.findByRole("text", { name: `${t.supportReplyChecked}. ${t.supportReplyLocal}` }); await fireEvent.press(screen.getByRole("button", { name: t.supportReplyBack })); expect(screen.queryByText(body)).toBeNull(); expect(screen.getAllByText(/SYNTHETIC user body/)).toHaveLength(3);
  await fireEvent.press(screen.getByRole("button", { name: t.supportReplyResume })); expect(screen.getByLabelText(t.supportReplyBody)).toHaveProp("value", body); await fireEvent.press(screen.getByRole("button", { name: t.supportReplyCancel })); expect(fetcher).toHaveBeenCalledTimes(requests);
  for (const [, init] of fetcher.mock.calls.filter(([url]) => url.includes("/support/"))) expect(init.method ?? "GET").toBe("GET"); expect(fetcher.mock.calls.some(([url]) => /\/(messages|reopen|notifications)(?:$|\?)/.test(url))).toBe(false);
});
it("erases unsent reply text after confirmed logout and does not restore it for a fresh session of the same buyer", async () => {
  const t = copy.ru; let again = false;
  const fetcher = server(path => path.startsWith("/support/tickets?") ? response([supportSummary()]) : path === `/support/tickets/${supportId(60)}` ? response(supportDetail()) : again && path === "/auth/login" ? response({ ...auth, sessionId: supportId(998) }, 201) : again && path === "/auth/handoff/exchange" ? response({ ...auth, ...context, sessionId: supportId(998), capability: "BUYER" }, 201) : undefined);
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer(); await fireEvent.press(screen.getByRole("tab", { name: t.support })); await screen.findByText("SYNTHETIC-SUP-001"); await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC-SUP-001` })); await screen.findByRole("button", { name: t.supportReplyStart }); await fireEvent.press(screen.getByRole("button", { name: t.supportReplyStart })); await fireEvent.changeText(screen.getByLabelText(t.supportReplyBody), "SYNTHETIC previous session reply");
  await fireEvent.press(screen.getByRole("button", { name: "Выйти" })); await screen.findByLabelText("Пароль"); again = true; await signIn(); await openBuyer(); await fireEvent.press(screen.getByRole("tab", { name: t.support })); await screen.findByText("SYNTHETIC-SUP-001"); await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC-SUP-001` })); await screen.findByRole("button", { name: t.supportReplyStart }); expect(screen.queryByRole("button", { name: t.supportReplyResume })).toBeNull(); await fireEvent.press(screen.getByRole("button", { name: t.supportReplyStart })); expect(screen.getByLabelText(t.supportReplyBody)).toHaveProp("value", "");
});
it("reads own saved-lists through native authenticated HTTP while keeping writes absent", async () => {
  const list = savedListFixture(), t = copy.ru, fetcher = server(path => path === "/owner/saved-lists" ? response([list]) : undefined);
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer();
  await fireEvent.press(screen.getByRole("tab", { name: t.savedLists })); await screen.findByText(list.name);
  await fireEvent.press(screen.getByRole("button", { name: `${t.open}: ${list.name}` }));
  await screen.findByText(`${t.quantity}: 999999999999.999999`);
  const calls = fetcher.mock.calls.filter(([url]) => url === `${api}/owner/saved-lists`);
  expect(calls.length).toBeGreaterThan(0);
  for (const [, init] of calls) { expect(init).toMatchObject({ method: "GET", headers: { authorization: `Bearer ${auth.accessToken}` }, credentials: "omit", redirect: "error", cache: "no-store" }); expect(init.body).toBeUndefined(); expect(init.headers).not.toHaveProperty("x-user-id"); }
  expect(fetcher.mock.calls.some(([url, init]) => url.includes("/owner/") && init.method !== "GET")).toBe(false);
  expect(screen.queryByText(list.createdById)).toBeNull();
});
it("keeps local procurement-list selection/fields/check/overview/cancel actions at zero transport calls", async () => {
  const fetcher = server(path => path.startsWith("/marketplace/products/") && path.includes("/compare?") ? response(payload("comparison-exact-offer")) : undefined), t = copy.ru; await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer(); await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC product, SYNTHETIC variant` })); await screen.findByText("SYNTHETIC supplier"); await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC supplier` })); await screen.findByRole("button", { name: t.localListAdd }); const requests = fetcher.mock.calls.length;
  await fireEvent.press(screen.getByRole("button", { name: t.localListAdd })); await fireEvent.changeText(screen.getByLabelText(t.localListName), "  SYNTHETIC native list  "); await fireEvent.changeText(screen.getByLabelText(t.localListQuantity), " 2,5 "); await fireEvent.changeText(screen.getByLabelText(t.localListNote), "  SYNTHETIC note\nraw  "); await fireEvent.press(screen.getByRole("button", { name: t.localListCheck })); await screen.findByRole("text", { name: `${t.localListChecked}. ${t.localListOnlyLocal}` }); await fireEvent.press(screen.getByRole("button", { name: t.localListOverview })); expect(screen.getByText(`${t.localListCount}: 1`)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: `${t.localListEdit}: ${t.cartItem} 1` })); expect(screen.getByLabelText(t.localListQuantity)).toHaveProp("value", " 2,5 "); await fireEvent.press(screen.getByRole("button", { name: t.localListBack })); await fireEvent.press(screen.getByRole("button", { name: t.localListCancelAll })); await fireEvent.press(screen.getByRole("button", { name: t.localListAdd })); expect(screen.getByLabelText(t.localListName)).toHaveProp("value", ""); await fireEvent.press(screen.getByRole("button", { name: t.localListCancelItem })); await fireEvent.press(screen.getByRole("button", { name: t.localListAdd })); expect(screen.getByLabelText(t.localListQuantity)).toHaveProp("value", "1"); expect(fetcher).toHaveBeenCalledTimes(requests);
  const reads = fetcher.mock.calls.filter(([url]) => url.includes("/compare?")); expect(reads).toHaveLength(1); expect(new URL(reads[0]![0]).searchParams.get("buyerOrganizationId")).toBe(org); expect(reads[0]![1].method ?? "GET").toBe("GET");
  expect(fetcher.mock.calls.some(([url]) => /saved-lists|\/carts|\/checkout/.test(url))).toBe(false);
});
it("drops the local list on confirmed logout and starts empty after a new session of the same buyer", async () => {
  const t = copy.ru; let again = false; const fetcher = server(path => path.startsWith("/marketplace/products/") && path.includes("/compare?") ? response(payload("comparison-exact-offer")) : again && path === "/auth/login" ? response({ ...auth, sessionId: supportId(997) }, 201) : again && path === "/auth/handoff/exchange" ? response({ ...auth, ...context, sessionId: supportId(997), capability: "BUYER" }, 201) : undefined);
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer(); await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC product, SYNTHETIC variant` })); await screen.findByText("SYNTHETIC supplier"); await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC supplier` })); await fireEvent.press(screen.getByRole("button", { name: t.localListAdd })); await fireEvent.changeText(screen.getByLabelText(t.localListName), "SYNTHETIC previous session private list"); await fireEvent.press(screen.getByRole("button", { name: "Выйти" })); await screen.findByLabelText("Пароль"); again = true; await signIn(); await openBuyer(); expect(screen.queryByRole("button", { name: t.localListResume })).toBeNull(); await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC product, SYNTHETIC variant` })); await screen.findByText("SYNTHETIC supplier"); await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC supplier` })); await fireEvent.press(screen.getByRole("button", { name: t.localListAdd })); expect(screen.getByLabelText(t.localListName)).toHaveProp("value", ""); expect(screen.getByLabelText(t.localListQuantity)).toHaveProp("value", "1"); expect(screen.getByLabelText(t.localListNote)).toHaveProp("value", "");
});
it("does not expose or call a live dashboard without its explicit synthetic fixture port", async () => {
  const fetcher = server(); await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer(); expect(screen.queryByRole("tab", { name: copy.ru.buyerDashboard })).toBeNull(); expect(fetcher.mock.calls.some(([url]) => url.includes("/owner/") || url.includes("dashboard"))).toBe(false);
});
it.each(["missing", "wrong-checkout", "wrong-buyer"] as const)("does not bind an unassociated untyped checkout paymentIntent%s to native reads or actions", async variant => {
  const t = copy.ru, fetcher = server(path => path.startsWith("/workspaces/buyer/carts?") ? response(savedPage(null, [savedCart(failedCartId, 2, true)])) : path === `/workspaces/buyer/carts/${failedCartId}` ? response(savedCart(failedCartId, 2, true)) : path === `/checkouts/${checkoutId}` ? response(intentCheckout(variant === "missing" ? { secret: "SYNTHETIC untyped extension" } : { id: supportId(910), checkoutId: variant === "wrong-checkout" ? supportId(999) : checkoutId, buyerOrganizationId: variant === "wrong-buyer" ? supportId(999) : org, status: "CAPTURED" })) : undefined); await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer(); await fireEvent.press(screen.getByRole("tab", { name: t.cart })); await screen.findByText(t.failedCarts); await fireEvent.press(screen.getByRole("button", { name: `${t.open}: ${t.savedCart} 1` })); await screen.findByRole("button", { name: t.openSavedCheckout }); await fireEvent.press(screen.getByRole("button", { name: t.openSavedCheckout })); await screen.findByRole("text", { name: `${t.savedCheckout}. ${t.checkoutSnapshotBody}` }); expect(screen.queryByRole("button", { name: t.intentOpen })).toBeNull(); expect(fetcher.mock.calls.some(([url]) => /payment-intents|authorize|capture|refund|reconcile|payout/.test(url))).toBe(false);
});

it("reads only owner archive metadata through the default native session and preserves Back query", async () => {
  const own = archiveDocument({ ownerOrganizationId: org, participants: [], baseAgreementDocumentId: supportId(992) });
  const fetcher = server(path => path.startsWith("/documents/archive?") ? response(archivePage([own])) : path === "/documents/archive/summary" ? response(archiveSummary()) : path === `/documents/archive/${archiveDocumentId}` ? response(own) : undefined);
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer();
  expect(fetcher.mock.calls.some(([url]) => url.includes("/documents/"))).toBe(false);
  await fireEvent.press(screen.getByRole("tab", { name: archiveCopy.ru.registry }));
  await screen.findByRole("button", { name: `${archiveCopy.ru.open}: ${own.documentNumber}` });
  await fireEvent.press(screen.getByRole("button", { name: `${archiveCopy.ru.open}: ${own.documentNumber}` }));
  await screen.findByRole("button", { name: archiveCopy.ru.back }); expect(screen.getByText(own.title)).toBeOnTheScreen();
  for (const label of [archiveHistoryCopy.ru.open, archiveSignatureCopy.ru.open, archiveParticipantCopy.ru.open]) expect(screen.getByRole("button", { name: label })).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: archiveLinksCopy.ru.baseOpen })).toBeOnTheScreen();
  expect(screen.queryByText("SYNTHETIC private signer")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: archiveCopy.ru.back }));
  await screen.findByRole("button", { name: `${archiveCopy.ru.open}: ${own.documentNumber}` });
  const reads = fetcher.mock.calls.filter(([url]) => url.includes("/documents/"));
  expect(reads.filter(([url]) => url === `${api}/documents/archive?limit=25`)).toHaveLength(2);
  for (const [url, init] of reads) { expect(new URL(url).pathname).toMatch(/^\/api\/documents\/archive(?:\/(?:summary|[0-9a-f-]+))?$/); expect(init.method).toBe("GET"); expect(init.body).toBeUndefined(); expect(init.headers).toMatchObject({ authorization: `Bearer ${auth.accessToken}` }); }
  expect(reads.some(([url]) => /download|signature|versions|accounting|992/.test(url))).toBe(false);
});

it("does not reveal a non-owner archive row in the native path", async () => {
  const other = archiveDocument({ ownerOrganizationId: supportId(993), title: "SYNTHETIC non-owner private archive" });
  const fetcher = server(path => path.startsWith("/documents/archive?") ? response(archivePage([other])) : path === "/documents/archive/summary" ? response(archiveSummary()) : undefined);
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer();
  await fireEvent.press(screen.getByRole("tab", { name: archiveCopy.ru.registry })); await screen.findByText(archiveCopy.ru.visibility);
  expect(screen.queryByText(other.title)).toBeNull(); expect(screen.queryByRole("button", { name: `${archiveCopy.ru.open}: ${other.documentNumber}` })).toBeNull();
  expect(fetcher.mock.calls.some(([url]) => url.endsWith(`/${other.id}`))).toBe(false);
});

it("exposes native product/supplier published review entries without an implicit review GET", async () => {
  const fetcher = server(path => path.startsWith("/marketplace/products/") && path.includes("/compare?") ? response(payload("comparison-exact-offer")) : undefined); await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer(); await fireEvent.press(screen.getByRole("button", { name: `${copy.ru.open}: SYNTHETIC product, SYNTHETIC variant` })); await screen.findByText("SYNTHETIC supplier"); expect(screen.getByRole("button", { name: reviewCopy.ru.productOpen })).toBeOnTheScreen(); await fireEvent.press(screen.getByRole("button", { name: `${copy.ru.open}: SYNTHETIC supplier` })); expect(screen.getByRole("button", { name: reviewCopy.ru.supplierOpen })).toBeOnTheScreen(); expect(fetcher.mock.calls.some(([url]) => /\/trust\/|reviews|ratings/.test(url))).toBe(false);
});

it("loads the typed city directory only on explicit native picker opening, preserving RU names in KK", async () => {
  const fetcher = server(path => path === "/catalog/cities" ? response(cityFixture()) : undefined);
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer();
  expect(screen.getByRole("button", { name: cityCopy.ru.open })).toBeOnTheScreen();
  expect(fetcher.mock.calls.some(([url]) => url.endsWith("/catalog/cities"))).toBe(false);
  await fireEvent.press(screen.getByRole("button", { name: cityCopy.ru.open }));
  await screen.findByRole("button", { name: cityCopy.ru.apply });
  expect(screen.getByText(cityCopy.ru.names)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("tab", { name: "ҚАЗ" }));
  expect(screen.getByRole("tab", { name: `${cityCopy.kk.select}: ${cityFixture()[0]!.nameRu}, ${cityFixture()[0]!.region.nameRu}` })).toBeOnTheScreen();
  expect(screen.getByText(cityCopy.kk.names)).toBeOnTheScreen();
  const calls = fetcher.mock.calls.filter(([url]) => url.endsWith("/catalog/cities")); expect(calls).toHaveLength(1);
  expect(calls[0]![1]).toMatchObject({ method: "GET", headers: { authorization: `Bearer ${auth.accessToken}` }, credentials: "omit", redirect: "error", cache: "no-store" });
  expect(calls[0]![1].body).toBeUndefined();
  expect(fetcher.mock.calls.some(([url]) => /geo\/|organization-profile/.test(url))).toBe(false);
});

it("reads private order comments through native session only after an own workflow selection", async () => {
  const workflow = commentWorkflow(), fetcher = server(path => path.includes("/supplier-orders/") && path.endsWith("/workflow") ? response(workflow) : path === `/trust/orders/${workflow.orderId}/comments` ? response(orderComments()) : undefined);
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer();
  expect(fetcher.mock.calls.some(([url]) => /trust\/orders|comments/.test(url))).toBe(false);
  await fireEvent.press(screen.getByRole("tab", { name: copy.ru.orders })); await screen.findByRole("button", { name: `${copy.ru.open}: SYNTHETIC-READ-001` }); await fireEvent.press(screen.getByRole("button", { name: `${copy.ru.open}: SYNTHETIC-READ-001` }));
  await screen.findByRole("button", { name: orderCommentsCopy.ru.open }); await fireEvent.press(screen.getByRole("button", { name: orderCommentsCopy.ru.open }));
  await screen.findByText("SYNTHETIC buyer order comment"); expect(screen.getByText("SYNTHETIC supplier order comment")).toBeOnTheScreen();
  const calls = fetcher.mock.calls.filter(([url]) => url === `${api}/trust/orders/${workflow.orderId}/comments`); expect(calls).toHaveLength(1);
  expect(calls[0][1]).toMatchObject({ method: "GET", headers: { authorization: `Bearer ${auth.accessToken}` }, credentials: "omit", redirect: "error", cache: "no-store" }); expect(calls[0][1].body).toBeUndefined();
  expect(fetcher.mock.calls.some(([url, init]) => /trust\/orders|comments/.test(url) && init.method !== "GET")).toBe(false); expect(screen.queryByText("SYNTHETIC private comment key")).toBeNull();
});
it("prepares/checks/reviews/discards cancellation fields through the native BUYER shell without another request or any order command", async () => {
  const c = cancellationCopy.ru, t = copy.ru, fetcher = server(path => path.includes("/supplier-orders/") && path.endsWith("/workflow") ? response(cancellationWorkflow()) : undefined); await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer(); await fireEvent.press(screen.getByRole("tab", { name: t.orders })); await screen.findByRole("button", { name: `${t.open}: SYNTHETIC-READ-001` }); await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC-READ-001` })); await screen.findByRole("button", { name: c.start }); const requests = fetcher.mock.calls.length;
  await fireEvent.press(screen.getByRole("button", { name: c.start })); await fireEvent.changeText(screen.getByLabelText(c.reason), "  SYNTHETIC native unsent reason  "); await fireEvent(screen.getByRole("switch", { name: c.declaration }), "valueChange", true); await fireEvent.press(screen.getByRole("button", { name: c.review })); await screen.findByText(c.reviewTitle); await fireEvent.press(screen.getByRole("button", { name: c.back })); await fireEvent.press(screen.getByRole("button", { name: c.resume })); await screen.findByText(c.reviewTitle); await fireEvent.press(screen.getByRole("button", { name: c.discard })); await screen.findByRole("button", { name: c.start }); expect(fetcher).toHaveBeenCalledTimes(requests); expect(fetcher.mock.calls.filter(([url]) => url.includes("/supplier-orders/")).every(([, init]) => (init.method ?? "GET") === "GET")).toBe(true); expect(fetcher.mock.calls.some(([url]) => /workflow-command|checkout|cancel-order/.test(url))).toBe(false);
});

it("prepares a single receipt count/check/review/Back/discard with zero native transport requests and no receiving command", async () => {
  const t = copy.ru, r = receiptDraftCopy.ru, fetcher = server(path => path.includes("/supplier-orders/") && path.endsWith("/workflow") ? response(receiptWorkflow()) : undefined); await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer(); await fireEvent.press(screen.getByRole("tab", { name: t.orders })); await screen.findByRole("button", { name: `${t.open}: SYNTHETIC-READ-001` }); await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC-READ-001` })); await screen.findByRole("tab", { name: t.shipments }); await fireEvent.press(screen.getByRole("tab", { name: t.shipments })); const label = `${r.start}: SYNTHETIC receipt shipment, ${r.line} 1`; await screen.findByRole("button", { name: label }); const requests = fetcher.mock.calls.length;
  await fireEvent.press(screen.getByRole("button", { name: label })); await fireEvent.changeText(screen.getByLabelText(r.quantity), " 1,25 "); await fireEvent.press(screen.getByRole("button", { name: r.review })); await screen.findByText(r.reviewTitle); await fireEvent.press(screen.getByRole("button", { name: r.back })); await fireEvent.press(screen.getByRole("button", { name: `${r.resume}: SYNTHETIC receipt shipment, ${r.line} 1` })); await screen.findByText(r.reviewTitle); await fireEvent.press(screen.getByRole("button", { name: r.discard })); await screen.findByRole("button", { name: label }); expect(fetcher).toHaveBeenCalledTimes(requests); expect(fetcher.mock.calls.filter(([url]) => url.includes("/supplier-orders/")).every(([, init]) => (init.method ?? "GET") === "GET")).toBe(true);
});

it("prepares GOODS fields/review/Back/discard through native shell without an extra request or return command", async () => {
  const t = copy.ru, g = goodsReturnCopy.ru, fetcher = server(path => path.includes("/supplier-orders/") && path.endsWith("/workflow") ? response(goodsReturnWorkflow()) : undefined); await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer(); await fireEvent.press(screen.getByRole("tab", { name: t.orders })); await screen.findByRole("button", { name: `${t.open}: SYNTHETIC-READ-001` }); await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC-READ-001` })); const label = `${g.start}: ${g.line} 1`; await screen.findByRole("button", { name: label }); const requests = fetcher.mock.calls.length;
  await fireEvent.press(screen.getByRole("button", { name: label })); await fireEvent.changeText(screen.getByLabelText(g.reason), "  SYNTHETIC native reason  "); await fireEvent.changeText(screen.getByLabelText(g.quantityText), " 0,25 "); await fireEvent.changeText(screen.getByLabelText(g.condition), "  SYNTHETIC native condition  "); await fireEvent.press(screen.getByRole("button", { name: g.review })); await screen.findByText(g.reviewTitle); await fireEvent.press(screen.getByRole("button", { name: g.back })); await fireEvent.press(screen.getByRole("button", { name: `${g.resume}: ${g.line} 1` })); await screen.findByText(g.reviewTitle); await fireEvent.press(screen.getByRole("button", { name: g.discard })); await screen.findByRole("button", { name: label }); expect(fetcher).toHaveBeenCalledTimes(requests); expect(fetcher.mock.calls.filter(([url]) => url.includes("/supplier-orders/")).every(([, init]) => (init.method ?? "GET") === "GET")).toBe(true); expect(fetcher.mock.calls.some(([url]) => /return-requests|refund|workflow-command/.test(url))).toBe(false);
});

it("reads supplied workflow history through native shell by switching panels without another request", async () => {
 const t = copy.ru, h = orderHistoryCopy.ru, fetcher = server(path => path.includes("/supplier-orders/") && path.endsWith("/workflow") ? response(historyWorkflow()) : undefined); await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer(); await fireEvent.press(screen.getByRole("tab", { name: t.orders })); await screen.findByRole("button", { name: `${t.open}: SYNTHETIC-READ-001` }); await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC-READ-001` })); await screen.findByRole("tab", { name: h.title }); const requests = fetcher.mock.calls.length; await fireEvent.press(screen.getByRole("tab", { name: h.title })); await screen.findByText(orderHistoryActionLabel("REQUEST_RETURN", "ru")); expect(screen.getByText(h.unknown)).toBeOnTheScreen(); await fireEvent.press(screen.getByRole("tab", { name: t.composition })); await fireEvent.press(screen.getByRole("tab", { name: h.title })); expect(fetcher).toHaveBeenCalledTimes(requests); expect(fetcher.mock.calls.filter(([url]) => url.includes("/supplier-orders/")).every(([, init]) => (init.method ?? "GET") === "GET")).toBe(true);
});

it("sends selected status with existing order search/group over the same scoped native GET and clears it", async () => {
 const t = copy.ru, o = orderStatusCopy.ru, fetcher = server(); await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer(); await fireEvent.press(screen.getByRole("tab", { name: t.orders })); await screen.findByText("SYNTHETIC-READ-001"); await fireEvent.changeText(screen.getByLabelText(t.searchOrders), " /? + & қ "); await fireEvent(screen.getByLabelText(t.searchOrders), "submitEditing"); await screen.findByText("SYNTHETIC-READ-001"); await fireEvent.press(screen.getByRole("tab", { name: "В работе" })); await screen.findByText("SYNTHETIC-READ-001"); const label = (status?: "PAID") => `${o.title}: ${orderStatusFilterLabel(status, "ru")}`, count = fetcher.mock.calls.length; await fireEvent.press(screen.getByRole("button", { name: label() })); await screen.findByText(o.prompt); expect(fetcher).toHaveBeenCalledTimes(count); await fireEvent.press(screen.getByRole("tab", { name: label("PAID") })); await screen.findByText("SYNTHETIC-READ-001"); let calls = fetcher.mock.calls.filter(([url]) => url.includes("/workspaces/buyer/orders")); const [url, init] = calls.at(-1)!; expect(Object.fromEntries(new URL(url).searchParams)).toEqual({ limit: "50", q: "/? + & қ", group: "active", status: "PAID" }); expect(init.method ?? "GET").toBe("GET"); expect(init.body).toBeUndefined(); expect(init.headers).toMatchObject({ authorization: `Bearer ${auth.accessToken}` }); const handoff = fetcher.mock.calls.find(([requestUrl]) => requestUrl.endsWith("/auth/handoff"))!; expect(handoff[1].headers).toMatchObject({ "x-organization-id": org }); expect(JSON.parse(handoff[1].body as string)).toEqual({ capability: "BUYER" }); expect(init.headers).not.toHaveProperty("x-user-id"); await fireEvent.press(screen.getByRole("button", { name: o.clear })); await screen.findByText("SYNTHETIC-READ-001"); calls = fetcher.mock.calls.filter(([url]) => url.includes("/workspaces/buyer/orders")); expect(Object.fromEntries(new URL(calls.at(-1)![0]).searchParams)).toEqual({ limit: "50", q: "/? + & қ", group: "active" }); expect(calls.every(([, options]) => (options.method ?? "GET") === "GET" && options.body === undefined)).toBe(true);
});

it("stops a returned cursor cycle over existing native GETs with no repeated cursor request", async () => {
 const a = "SYNTHETIC:A+/=", b = "SYNTHETIC:B+/=", t = copy.ru, fetcher = server(path => { if (!path.startsWith("/workspaces/buyer/orders")) return undefined; const token = new URL(`${api}${path}`).searchParams.get("cursor"); return response({ ...JSON.parse(JSON.stringify(payload("workspace-orders-page"))), nextCursor: token === a ? b : a }); }); await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer(); await fireEvent.press(screen.getByRole("tab", { name: t.orders })); await screen.findByText("SYNTHETIC-READ-001"); await fireEvent.press(screen.getByRole("button", { name: t.next })); await screen.findByText("SYNTHETIC-READ-001"); await fireEvent.press(screen.getByRole("button", { name: t.next })); await screen.findByText(orderListCopy.ru.stopped); expect(screen.queryByRole("button", { name: t.next })).toBeNull(); const calls = fetcher.mock.calls.filter(([url]) => url.includes("/workspaces/buyer/orders")); expect(calls.map(([url]) => new URL(url).searchParams.get("cursor"))).toEqual([null, a, b]); expect(calls.every(([, options]) => (options.method ?? "GET") === "GET" && options.body === undefined)).toBe(true);
});

it("stops a cart ancestor cursor cycle through existing native reads without another forward GET", async () => {
 const a = "SYNTHETIC cart A+/=", b = "SYNTHETIC cart B+/=", t = copy.ru, fetcher = server(path => { if (!path.startsWith("/workspaces/buyer/carts")) return undefined; const token = new URL(`${api}${path}`).searchParams.get("cursor"); return response(savedPage(null, [savedCart(failedCartId, 2, true)], token === a ? b : a)); }); await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer(); await fireEvent.press(screen.getByRole("tab", { name: t.cart })); await screen.findByText(t.failedCarts); await fireEvent.press(screen.getByRole("button", { name: t.next })); await screen.findByText(t.failedCarts); await fireEvent.press(screen.getByRole("button", { name: t.next })); await screen.findByRole("alert", { name: `${t.cartPagePartial}. ${t.cartPageRecovery}` }); expect(screen.queryByRole("button", { name: t.next })).toBeNull(); const calls = fetcher.mock.calls.filter(([url]) => url.includes("/workspaces/buyer/carts")); expect(calls.map(([url]) => new URL(url).searchParams.get("cursor"))).toEqual([null, a, b]); expect(calls.every(([, options]) => (options.method ?? "GET") === "GET" && options.body === undefined)).toBe(true);
});

it("stops a repeated ancestor message cursor through existing native support GETs without sending a message", async () => {
 const base = supportDetail(), a = base.messages[0]!.id, b = supportId(58), t = copy.ru, fetcher = server(path => path.startsWith("/support/tickets?") ? response([supportSummary()]) : path.startsWith(`/support/tickets/${supportId(60)}`) ? response(supportDetail({ messages: [{ ...base.messages[0]!, id: new URL(`${api}${path}`).searchParams.get("beforeMessageId") === a ? b : a }], hasOlder: true })) : undefined); await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer(); await fireEvent.press(screen.getByRole("tab", { name: t.support })); await screen.findByText("SYNTHETIC-SUP-001"); await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC-SUP-001` })); await screen.findByText("SYNTHETIC user body 61"); await fireEvent.press(screen.getByRole("button", { name: t.supportOlder })); await screen.findByText("SYNTHETIC user body 61"); await fireEvent.press(screen.getByRole("button", { name: t.supportOlder })); await screen.findByRole("alert", { name: `${t.supportOlderUnavailable}. ${t.supportPartialBody}` }); expect(screen.queryByRole("button", { name: t.supportOlder })).toBeNull(); const calls = fetcher.mock.calls.filter(([url]) => url.includes(`/support/tickets/${supportId(60)}`)); expect(calls.map(([url]) => new URL(url).searchParams.get("beforeMessageId"))).toEqual([null, a, b]); expect(calls.every(([, options]) => (options.method ?? "GET") === "GET" && options.body === undefined)).toBe(true);
});

it("keeps exact catalog q/category/supplier/offset through native comparison/offer/Back reads", async () => {
 const t = copy.ru, category = "00000000-0000-4000-8000-000000000040", supplier = "00000000-0000-4000-8000-000000000041", fetcher = server(path => {
  if (path.startsWith("/marketplace/search?")) { const offset = Number(new URL(`${api}${path}`).searchParams.get("offset") ?? "0"), page = catalogSearchResponseSchema.parse(JSON.parse(JSON.stringify(payload("catalog-null-price")))); page.offset = offset; page.limit = 24; page.total = 48; page.items[0]!.name = offset ? "SYNTHETIC native page 2" : "SYNTHETIC product"; page.facets = { categories: [{ id: category, name: "SYNTHETIC category", count: 48 }], suppliers: [{ id: supplier, name: "SYNTHETIC supplier filter", count: 48 }] }; return response(page); }
  if (path.startsWith("/marketplace/products/") && path.includes("/compare?")) return response(payload("comparison-exact-offer")); return undefined;
 }); await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer(); await screen.findByText("SYNTHETIC product"); for (const label of [`${t.categoryFilter}: SYNTHETIC category`, `${t.supplierFilter}: SYNTHETIC supplier filter`]) { await fireEvent.press(screen.getByRole("button", { name: t.filters })); await fireEvent.press(screen.getByRole("tab", { name: label })); await screen.findByText("SYNTHETIC product"); }
 await fireEvent.changeText(screen.getByLabelText(t.search), " exact & /? + қ "); await fireEvent(screen.getByLabelText(t.search), "submitEditing"); await screen.findByText("SYNTHETIC product"); await fireEvent.press(screen.getByRole("button", { name: t.next })); await screen.findByText("SYNTHETIC native page 2"); await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC native page 2, SYNTHETIC variant` })); await screen.findByText("SYNTHETIC supplier"); await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC supplier` })); await screen.findByText(new RegExp(`^${t.packQuantity}:`)); await fireEvent.press(screen.getByRole("button", { name: t.back })); await screen.findByText("SYNTHETIC supplier"); await fireEvent.press(screen.getByRole("button", { name: t.back })); await screen.findByText("SYNTHETIC native page 2"); const calls = fetcher.mock.calls.filter(([url]) => url.includes("/marketplace/search")), last = calls.at(-1)!; expect(Object.fromEntries(new URL(last[0]).searchParams)).toEqual({ q: "exact & /? + қ", offset: "24", categoryId: category, supplierOrganizationId: supplier, buyerOrganizationId: org }); const reads = fetcher.mock.calls.filter(([url]) => /marketplace\/(search|products)/.test(url)); expect(reads.every(([, options]) => (options.method ?? "GET") === "GET" && options.body === undefined)).toBe(true); expect(last[1].headers).toMatchObject({ authorization: `Bearer ${auth.accessToken}` });
});

it("reads exact selected-variant attributes over the existing native comparison GET without another action or media request", async () => {
 const t = copy.ru, fetcher = server(path => path.startsWith("/marketplace/products/") && path.includes("/compare?") ? response(attributesComparison()) : undefined); await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer(); await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC product, SYNTHETIC variant` })); await screen.findByText("SYNTHETIC explicit selected value"); expect(screen.getByText(attributesCopy.ru.no)).toBeOnTheScreen(); expect(screen.queryByText("SYNTHETIC other selected value")).toBeNull(); expect(screen.queryByText("SYNTHETIC nested opaque")).toBeNull(); const count = fetcher.mock.calls.length; await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC supplier` })); await screen.findByText(new RegExp(`^${t.packQuantity}:`)); expect(screen.getByText("SYNTHETIC explicit selected value")).toBeOnTheScreen(); await fireEvent.press(screen.getByRole("button", { name: t.back })); await screen.findByRole("button", { name: `${t.open}: SYNTHETIC supplier` }); expect(fetcher).toHaveBeenCalledTimes(count); const calls = fetcher.mock.calls.filter(([url]) => url.includes("/compare?")); expect(calls).toHaveLength(1); expect(new URL(calls[0]![0]).searchParams.get("variantId")).toBe(attributesComparison().selectedVariantId); expect(calls[0]![1].method ?? "GET").toBe("GET"); expect(calls[0]![1].body).toBeUndefined(); expect(fetcher.mock.calls.some(([url]) => /catalog\/media|storage|signed-download/.test(url))).toBe(false);
});

it("retries a denied native archive read without exposing a raw error or issuing writes", async () => {
  let denied = true; const own = archiveDocument({ ownerOrganizationId: org, participants: [] });
  const fetcher = server(path => path.startsWith("/documents/archive?") ? denied ? response({ statusCode: 403, code: "SYNTHETIC_CODE", message: "SYNTHETIC private server denial", path: "/documents/archive", timestamp: "2026-10-29T01:02:03.000Z" }, 403) : response(archivePage([own])) : path === "/documents/archive/summary" ? response(archiveSummary()) : undefined);
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer();
  await fireEvent.press(screen.getByRole("tab", { name: archiveCopy.ru.registry })); await screen.findByText(copy.ru.denied);
  expect(screen.queryByText("SYNTHETIC private server denial")).toBeNull(); denied = false;
  await fireEvent.press(screen.getByRole("button", { name: copy.ru.retry })); await screen.findByRole("button", { name: `${archiveCopy.ru.open}: ${own.documentNumber}` });
  expect(fetcher.mock.calls.filter(([url]) => url.includes("/documents/")).every(([, init]) => init.method === "GET" && init.body === undefined)).toBe(true);
});

it("shows supplied typed catalog description through the native fake GET and never follows a description URL", async () => {
  const value = catalogSearchResponseSchema.parse(payload("catalog-null-price")); const text = "SYNTHETIC native <script>literal</script> https://private.example.invalid/description"; value.items[0]!.description = text;
  const fetcher = server(path => path.startsWith("/marketplace/search") ? response(value) : undefined);
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer(); await screen.findByText(text); expect(screen.queryByRole("link")).toBeNull();
  expect(fetcher.mock.calls.every(([url]) => url.startsWith(`${api}/`))).toBe(true);
  expect(fetcher.mock.calls.filter(([url]) => url.includes("/marketplace/search"))).toHaveLength(1);
});

it("never enables a real native support POST command from BUYER/read access alone", async () => {
  const fetcher = server(path => path.startsWith("/support/tickets?") ? response([supportSummary()]) : undefined);
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer();
  await fireEvent.press(screen.getByRole("tab", { name: copy.ru.support })); await screen.findByText("SYNTHETIC-SUP-001"); await fireEvent.press(screen.getByRole("button", { name: copy.ru.supportDraftStart })); await screen.findByLabelText(copy.ru.supportDraftSubject);
  expect(screen.queryByRole("button", { name: supportCommandCopy.ru.create })).toBeNull(); expect(fetcher.mock.calls.filter(([url]) => url.includes("/support/")).every(([, init]) => init.method === "GET")).toBe(true);
});

it("keeps public reply POST unbound in the default authenticated native session", async () => {
  const own = supportDetail(), fetcher = server(path => path.startsWith("/support/tickets?") ? response([supportSummary()]) : path === `/support/tickets/${own.id}` ? response(own) : undefined);
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer(); await fireEvent.press(screen.getByRole("tab", { name: copy.ru.support })); await screen.findByRole("button", { name: `${copy.ru.open}: SYNTHETIC-SUP-001` }); await fireEvent.press(screen.getByRole("button", { name: `${copy.ru.open}: SYNTHETIC-SUP-001` })); await screen.findByRole("button", { name: copy.ru.supportReplyStart }); await fireEvent.press(screen.getByRole("button", { name: copy.ru.supportReplyStart })); await screen.findByLabelText(copy.ru.supportReplyBody);
  expect(screen.queryByRole("button", { name: supportCommandCopy.ru.reply })).toBeNull(); expect(fetcher.mock.calls.filter(([url]) => url.includes("/support/")).every(([, init]) => init.method === "GET")).toBe(true);
});

it("leaves cart quantity PATCH unavailable in a default native BUYER session", async () => {
 const own = savedCart(), fetcher = server(path => path.startsWith("/workspaces/buyer/carts?") ? response(savedPage(own, [])) : undefined);
 await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer(); await fireEvent.press(screen.getByRole("tab", { name: copy.ru.cart })); await screen.findByRole("button", { name: `${copy.ru.draftOpen}: ${copy.ru.cartItem} 1` }); await fireEvent.press(screen.getByRole("button", { name: `${copy.ru.draftOpen}: ${copy.ru.cartItem} 1` })); await screen.findByLabelText(copy.ru.draftQuantity);
 expect(screen.queryByRole("button", { name: cartCommandCopy.ru.save })).toBeNull(); expect(fetcher.mock.calls.filter(([url]) => /\/carts(?:\/|\?)/.test(url)).every(([, init]) => init.method === "GET")).toBe(true);
});

it("leaves cart DELETE unbound and offers no remove action in default native BUYER context", async () => {
 const own = savedCart(), fetcher = server(path => path.startsWith("/workspaces/buyer/carts?") ? response(savedPage(own, [])) : undefined);
 await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer(); await fireEvent.press(screen.getByRole("tab", { name: copy.ru.cart })); await screen.findByRole("button", { name: `${copy.ru.draftOpen}: ${copy.ru.cartItem} 1` }); await fireEvent.press(screen.getByRole("button", { name: `${copy.ru.draftOpen}: ${copy.ru.cartItem} 1` })); await screen.findByLabelText(copy.ru.draftQuantity);
 expect(screen.queryByRole("button", { name: cartCommandCopy.ru.removeStart })).toBeNull(); expect(screen.queryByRole("button", { name: cartCommandCopy.ru.removeConfirm })).toBeNull(); expect(fetcher.mock.calls.filter(([url]) => /\/carts(?:\/|\?)/.test(url)).every(([, init]) => init.method === "GET")).toBe(true);
});

it("opens the server-supplied recovered cart through the existing authenticated GET without a recovery POST", async () => {
  const source = savedCart(failedCartId, 4, true), targetId = "00000000-0000-4000-8000-000000000049", target = savedCart(targetId, 9);
  source.recoveredCartId = targetId; target.items[0]!.quantity = "31.000001";
  const fetcher = server(path => path.startsWith("/workspaces/buyer/carts?") ? response(savedPage(null, [source]))
    : path === `/workspaces/buyer/carts/${targetId}` ? response(target) : undefined);
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer();
  await fireEvent.press(screen.getByRole("tab", { name: copy.ru.cart })); await screen.findByText(recoveredCartCopy.ru.body);
  expect(fetcher.mock.calls.some(([url]) => url.endsWith(`/carts/${targetId}`))).toBe(false);
  await fireEvent.press(screen.getByRole("button", { name: `${recoveredCartCopy.ru.open}: ${copy.ru.savedCart} 1` }));
  await screen.findByText(`${copy.ru.quantity}: 31.000001`);
  const calls = fetcher.mock.calls.filter(([url]) => url.includes("/carts"));
  expect(calls.map(([url]) => new URL(url).pathname)).toEqual(["/api/workspaces/buyer/carts", `/api/workspaces/buyer/carts/${targetId}`]);
  for (const [, init] of calls) { expect(init.method ?? "GET").toBe("GET"); expect(init).toMatchObject({ headers: { authorization: `Bearer ${auth.accessToken}` }, credentials: "omit" }); }
  expect(fetcher.mock.calls.some(([url]) => /\/(?:recover|checkout|reprice|validate)$/.test(url))).toBe(false);
});

it("keeps create-or-get cart unavailable in the default native session even with no active cart", async () => {
  const fetcher = server(path => path.startsWith("/workspaces/buyer/carts?") ? response(savedPage(null, [])) : undefined);
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer();
  await fireEvent.press(screen.getByRole("tab", { name: copy.ru.cart })); await screen.findByText(copy.ru.noCurrentCart);
  expect(screen.queryByRole("button", { name: cartWorkspaceCommandCopy.ru.start })).toBeNull();
  expect(screen.queryByText(cartWorkspaceCommandCopy.ru.body)).toBeNull();
  expect(fetcher.mock.calls.filter(([url]) => url.includes("/carts")).every(([, init]) => (init.method ?? "GET") === "GET")).toBe(true);
  expect(fetcher.mock.calls.some(([url, init]) => init.method === "POST" && /\/(?:carts|checkout|recover)(?:[/?]|$)/.test(url))).toBe(false);
});

it("never offers or sends recovery from failed cart metadata in the default native session", async () => {
  const source = savedCart(failedCartId, 4, true);
  const fetcher = server(path => path.startsWith("/workspaces/buyer/carts?") ? response(savedPage(null, [source])) : undefined);
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer();
  await fireEvent.press(screen.getByRole("tab", { name: copy.ru.cart })); await screen.findByText(`${copy.ru.savedCartVersion}: 4`);
  expect(screen.queryByRole("button", { name: `${cartWorkspaceCommandCopy.ru.recoveryStart}: ${copy.ru.savedCart} 1` })).toBeNull();
  expect(screen.queryByText(cartWorkspaceCommandCopy.ru.recoveryBody)).toBeNull();
  expect(fetcher.mock.calls.filter(([url]) => url.includes("/carts")).every(([, init]) => (init.method ?? "GET") === "GET")).toBe(true);
  expect(fetcher.mock.calls.some(([url]) => /\/(?:recover|checkout|reprice|validate)$/.test(url))).toBe(false);
});

it("keeps offer-to-cart preparation and add POST absent from a default native buyer session", async () => {
  const t = copy.ru, fetcher = server(path => path.startsWith("/marketplace/products/") && path.includes("/compare?") ? response(cartAddComparison())
    : path.startsWith("/workspaces/buyer/carts?") ? response(savedPage(savedCart(), [])) : undefined);
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />); await signIn(); await openBuyer();
  await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC product, SYNTHETIC variant` })); await screen.findByText("SYNTHETIC supplier");
  await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC supplier` })); await fireEvent.press(screen.getByRole("button", { name: t.localListAdd })); await screen.findByLabelText(t.localListQuantity);
  await fireEvent.changeText(screen.getByLabelText(t.localListQuantity), "3.5");
  expect(screen.queryByRole("button", { name: cartAddCopy.ru.choose })).toBeNull(); expect(screen.queryByRole("button", { name: cartAddCopy.ru.readOffer })).toBeNull();
  await fireEvent.press(screen.getByRole("tab", { name: t.cart })); await screen.findByText(t.currentCart);
  expect(screen.queryByText(cartAddCopy.ru.body)).toBeNull(); expect(screen.queryByRole("button", { name: cartAddCopy.ru.apply })).toBeNull();
  const calls = fetcher.mock.calls.filter(([url]) => url.includes("/carts")); expect(calls).toHaveLength(1);
  for (const [, init] of calls) { expect(init.method ?? "GET").toBe("GET"); expect(init.headers).toMatchObject({ authorization: `Bearer ${auth.accessToken}` }); }
  expect(fetcher.mock.calls.some(([url, init]) => init.method === "POST" && /\/carts(?:[/?]|$)/.test(url))).toBe(false);
});
