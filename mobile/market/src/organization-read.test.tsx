import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { jest } from "@jest/globals";
import App from "../App";
import { createMobileReadSlot } from "../../../contracts/mobile-read/read-adapter";
import type { MobileReadClient, ReadScope } from "./read-controller";
import { ownOrganization } from "./test-fixtures/organization";
import { copy } from "./i18n";
const corpus = JSON.parse(readFileSync(resolve(__dirname, "../../../contracts/mobile-read/fixtures.json"), "utf8")) as { cases: { id: string; payload: unknown }[] };
const fixture = (id: string): unknown => JSON.parse(JSON.stringify(corpus.cases.find(item => item.id === id)!.payload));
const scope: ReadScope = { product: "market", environment: "synthetic-offline", userId: "00000000-0000-4000-8000-000000000020", organizationId: "00000000-0000-4000-8000-000000000004", generation: 1 };
function client() { return { searchCatalog: jest.fn<MobileReadClient["searchCatalog"]>().mockResolvedValue(fixture("catalog-empty")), compareOffers: jest.fn<MobileReadClient["compareOffers"]>().mockResolvedValue(fixture("comparison-exact-offer")), workspaceOrders: jest.fn<MobileReadClient["workspaceOrders"]>().mockResolvedValue(fixture("workspace-orders-page")), getOrderWorkflow: jest.fn<MobileReadClient["getOrderWorkflow"]>().mockResolvedValue(fixture("order-workflow-minimal")), getOrganizationProfile: jest.fn<NonNullable<MobileReadClient["getOrganizationProfile"]>>().mockResolvedValue(ownOrganization()) }; }
const session = (api = client(), active = scope) => ({ scope: active, client: api, organizationName: "SYNTHETIC organization" });
it.each(["ru", "kk"] as const)("reads only own-org summary and separate profile completeness in %s without PII or edit grants", async locale => {
  const api = client(), t = copy[locale]; await render(<App session={session(api)} locale={locale} />); await screen.findByText(t.emptyCatalog);
  expect(api.getOrganizationProfile).not.toHaveBeenCalled(); await fireEvent.press(screen.getByRole("tab", { name: t.organization }));
  await screen.findByText(`${t.organizationName}: SYNTHETIC own organization`);
  expect(screen.getByText(`${t.legalName}: SYNTHETIC legal organization`)).toBeOnTheScreen();
  expect(screen.getByText(`${t.profileState}: ${t.profileComplete}`)).toBeOnTheScreen();
  expect(screen.getByText(`${t.reserveRequired}: 0`)).toBeOnTheScreen(); expect(screen.getByText(`${t.reserveRecorded}: 0`)).toBeOnTheScreen();
  for (const value of ["SYNTHETIC private BIN", "SYNTHETIC private contact", "+7 (000) 000-00-00", "synthetic-private@example.invalid", "SYNTHETIC private legal address", "SYNTHETIC private delivery address"]) expect(screen.queryByText(value)).toBeNull();
  expect(screen.queryByRole("button", { name: /Изменить|Редактировать|Подписать|Өзгерту|Өңдеу|Қол қою/ })).toBeNull();
});
it("keeps null profile and absent contact-count requirements unknown rather than zero/complete", async () => {
  const api = client(); api.getOrganizationProfile.mockResolvedValue(ownOrganization({ profile: null, complete: false, requiredReserveContacts: undefined }));
  await render(<App session={session(api)} />); await fireEvent.press(screen.getByRole("tab", { name: copy.ru.organization }));
  await screen.findByText(`${copy.ru.profileState}: ${copy.ru.profileIncomplete}`);
  expect(screen.getByText(`${copy.ru.profileData}: ${copy.ru.profileDataUnknown}`)).toBeOnTheScreen(); expect(screen.getByText(`${copy.ru.reserveRequired}: ${copy.ru.detailsUnknown}`)).toBeOnTheScreen(); expect(screen.getByText(`${copy.ru.reserveRecorded}: ${copy.ru.detailsUnknown}`)).toBeOnTheScreen();
});
it("rejects another organization and preserves same-context monotonic organization version", () => {
  const slot = createMobileReadSlot(scope), target = { kind: "organization-profile" } as const;
  slot.complete(slot.begin(target), { status: 200, body: ownOrganization({ version: 5 }) });
  slot.complete(slot.begin(target), { status: 200, body: ownOrganization({ version: 2, displayName: "SYNTHETIC old name" }) });
  const current = slot.getState(); expect("read" in current && current.read.kind === "organization-profile" && current.read.value.version).toBe(5);
  slot.complete(slot.begin(target), { status: 200, body: ownOrganization({ organizationId: "00000000-0000-4000-8000-000000000099" }) }); expect(slot.getState().phase).toBe("contract-error");
});
it("recovers an actual organization denial only through explicit retry", async () => {
  const api = client(); api.getOrganizationProfile.mockRejectedValueOnce({ status: 403, payload: fixture("error-denied") });
  await render(<App session={session(api)} />); await fireEvent.press(screen.getByRole("tab", { name: copy.ru.organization })); await screen.findByRole("alert", { name: `${copy.ru.denied}. ${copy.ru.deniedBody}` });
  expect(screen.queryByText(/SYNTHETIC legal/)).toBeNull(); expect(api.getOrganizationProfile).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole("button", { name: copy.ru.retry })); await screen.findByText(`${copy.ru.legalName}: SYNTHETIC legal organization`);
});
it("uses current locale after a pending profile refresh without duplicate requests or old data", async () => {
  const api = client(); const rendered = await render(<App session={session(api)} />); await fireEvent.press(screen.getByRole("tab", { name: copy.ru.organization })); await screen.findByText(`${copy.ru.legalName}: SYNTHETIC legal organization`);
  let resolve!: (value: unknown) => void; api.getOrganizationProfile.mockReturnValueOnce(new Promise(yes => { resolve = yes; }));
  await fireEvent.press(screen.getByRole("button", { name: copy.ru.refresh })); expect(screen.queryByText(/SYNTHETIC legal/)).toBeNull();
  await rendered.rerender(<App session={session(api)} locale="kk" />); await act(async () => resolve(ownOrganization()));
  await screen.findByText(`${copy.kk.legalName}: SYNTHETIC legal organization`); expect(api.getOrganizationProfile).toHaveBeenCalledTimes(2);
});
it("drops a late profile response after session generation reset", async () => {
  const api = client(); let resolve!: (value: unknown) => void; api.getOrganizationProfile.mockReturnValueOnce(new Promise(yes => { resolve = yes; }));
  const rendered = await render(<App session={session(api)} />); await fireEvent.press(screen.getByRole("tab", { name: copy.ru.organization }));
  await rendered.rerender(<App session={session(api, { ...scope, generation: 2 })} />); await screen.findByText(copy.ru.emptyCatalog); await act(async () => resolve(ownOrganization()));
  expect(screen.queryByText(/SYNTHETIC legal/)).toBeNull();
});
