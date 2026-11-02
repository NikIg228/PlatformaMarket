import { fireEvent, render, screen } from "@testing-library/react-native";
import NativeMarketApp from "./NativeMarketApp";
import { sessionCopy } from "./session-copy";
import type { FetchTransport } from "./market-transport";
import { api, response, server, user, workspace } from "./test-fixtures/market-session";

jest.mock("expo/fetch", () => ({ fetch: jest.fn(() => { throw Error("Unexpected real native request"); }) }));
afterEach(() => jest.restoreAllMocks());
const addressAction = { ru: "Изменить адрес сервера", kk: "Сервер мекенжайын өзгерту" } as const;

it.each(["ru", "kk"] as const)("corrects an unavailable API before login and clears the old local form in %s", async locale => {
  const t = sessionCopy[locale], unavailable = "https://unreachable.example.invalid/api", good = server();
  const fetcher = jest.fn<ReturnType<FetchTransport>, Parameters<FetchTransport>>(async (url, init) => {
    if (url.startsWith(unavailable + "/")) throw Error("SYNTHETIC unavailable API");
    return good(url, init);
  });
  await render(<NativeMarketApp initialApiUrl={unavailable} fetcher={fetcher} />);
  if (locale === "kk") await fireEvent.press(screen.getByRole("tab", { name: "ҚАЗ" }));
  await screen.findByRole("alert", { name: t.issue.network });
  await fireEvent.changeText(screen.getByLabelText(t.email), "synthetic-unsent@example.invalid");
  await fireEvent.changeText(screen.getByLabelText(t.password), "synthetic-private-unsent-password");
  await fireEvent.press(screen.getByRole("button", { name: addressAction[locale] }));
  expect(screen.getByLabelText(t.api)).toHaveDisplayValue(unavailable);
  expect(screen.queryByLabelText(t.password)).toBeNull();
  expect(screen.queryByDisplayValue("synthetic-private-unsent-password")).toBeNull();
  await fireEvent.changeText(screen.getByLabelText(t.api), api);
  await fireEvent(screen.getByLabelText(t.api), "submitEditing");
  await screen.findByText(user.displayName);
  expect(fetcher.mock.calls.filter(([url]) => url.startsWith(unavailable + "/"))).toHaveLength(1);
  expect(good.mock.calls[0][0]).toBe(`${api}/auth/current?workspace=BUYER`);
  expect(fetcher.mock.calls.every(([, init]) => init.method === "GET")).toBe(true);
  expect(good.mock.calls.some(([, init]) => init.body !== undefined)).toBe(false);
  expect(screen.getByRole("tab", { name: locale === "ru" ? "RU" : "ҚАЗ" })).toHaveProp("accessibilityState", expect.objectContaining({ selected: true }));
});

it("shows invalid initial environment configuration before any request", async () => {
  const fetcher = server();
  await render(<NativeMarketApp initialApiUrl="http://localhost:4000/api" fetcher={fetcher} />);
  expect(screen.getByRole("alert", { name: sessionCopy.ru.invalidUrl })).toBeOnTheScreen();
  expect(screen.getByLabelText(sessionCopy.ru.api)).toHaveDisplayValue("http://localhost:4000/api");
  expect(fetcher).not.toHaveBeenCalled();
});

it("keeps the address editor outside an authenticated organization-selection flow", async () => {
  const t = sessionCopy.ru, fetcher = server(path => path === "/auth/current?workspace=BUYER" ? response(null) : undefined);
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />);
  await screen.findByLabelText(t.password);
  expect(screen.getByRole("button", { name: addressAction.ru })).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText(t.email), user.email);
  await fireEvent.changeText(screen.getByLabelText(t.password), "synthetic-login-password");
  await fireEvent.press(screen.getByRole("button", { name: t.submit }));
  await screen.findByRole("button", { name: `${t.open}: ${workspace().organizationDisplayName}` });
  expect(screen.queryByRole("button", { name: addressAction.ru })).toBeNull();
  expect(screen.getByRole("button", { name: t.logout })).toBeOnTheScreen();
});

it("offers address correction after confirmed logout, while preserving the existing logout request", async () => {
  const t = sessionCopy.ru, fetcher = server();
  await render(<NativeMarketApp initialApiUrl={api} fetcher={fetcher} />);
  await screen.findByText(user.displayName);
  expect(screen.queryByRole("button", { name: addressAction.ru })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: t.logout }));
  await screen.findByLabelText(t.password);
  await fireEvent.press(screen.getByRole("button", { name: addressAction.ru }));
  expect(screen.getByLabelText(t.api)).toHaveDisplayValue(api);
  expect(fetcher.mock.calls.filter(([, init]) => init.method === "POST").map(([url]) => url)).toEqual([`${api}/auth/session-logout`]);
});
