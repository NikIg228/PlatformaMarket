import { test, expect, type Page } from "@playwright/test";
import type { OrganizationProfileResponse, PersonalProfile } from "@marketplace/schemas";
const organizationId = "11111111-1111-4111-8111-111111111111", sessionId = "22222222-2222-4222-8222-222222222222", cityId = "33333333-3333-4333-8333-333333333333";
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aR1sAAAAASUVORK5CYII=";
async function fixture(page: Page, role: "clinic" | "supplier", canEdit = true) {
  const capability = role === "clinic" ? "BUYER" : "SUPPLIER";
  const state = { personal: { id: organizationId, displayName: "Тестовый сотрудник", email: "user@example.invalid", phone: "+77000000000", avatarAssetId: null, version: 1 } as PersonalProfile,
    organization: { organizationId, legalName: 'ТОО «Демо Клиника»', displayName: "Демо организация", bin: "000000000001", version: 1, canEdit, complete: true,
      profile: { contactName: "Тестовый сотрудник", phone: "+77000000000", email: "office@example.invalid", additionalContacts: role === "supplier" ? [1,2].map(n => ({contactName:`Резервный сотрудник ${n}`,phone:`+7700000000${n}`,email:`reserve${n}@example.invalid`})) : [], legalAddress: { cityId, line1: "Тестовая улица, 1", postalCode: "050000" }, deliveryAddress: { cityId, line1: "Тестовая улица, 2", postalCode: "050000" } } } as OrganizationProfileResponse,
    writes: [] as Record<string, unknown>[], fail: false, conflict: false, unexpected: [] as string[], sessions: Array.from({ length: 11 }, (_, i) => ({ id: i === 7 ? sessionId : `44444444-4444-4444-8444-${String(i).padStart(12,"0")}`, status: "ACTIVE", userAgent: i % 2 ? "Safari/18 Macintosh" : "Chrome/130 Windows", createdAt: "2026-10-07T10:00:00Z", lastUsedAt: "2026-10-07T11:00:00Z", activeOrganizationId: organizationId })) };
  await page.addInitScript(({ capability, organizationId, sessionId }) => sessionStorage.setItem(`dentmarket:${capability.toLowerCase()}-session`, JSON.stringify({ capability, organizationId, sessionId, actorId: organizationId, accessToken: "fixture-not-real", accessTokenExpiresAt: Date.now()+3600000, displayName: "Тестовый сотрудник", organizationDisplayName: "Демо организация" })), { capability, organizationId, sessionId });
  await page.route("**/api/**", async route => {
    const req=route.request(), url=new URL(req.url()), path=url.pathname.replace(/^\/api/, "");
    if (req.method() === "POST") {
      const body = req.postDataJSON(); state.writes.push({ path, ...body });
      if (state.fail || state.conflict) return route.fulfill({ status: state.conflict ? 409 : 503, json: { code: "FIXTURE_FAILURE", message: state.conflict ? "Профиль изменился. Обновите данные." : "Сервис временно недоступен" } });
      if (path === "/auth/profile") { Object.assign(state.personal, body, { version: state.personal.version + 1 }); delete (state.personal as unknown as Record<string, unknown>).expectedVersion; return route.fulfill({ json: state.personal }); }
      if (path === "/auth/profile/email") { state.personal.version++; return route.fulfill({ json: { ok:true, verificationRequired:true, email:body.email, delivery:"PROVIDER" } }); }
      if (path === "/auth/profile/avatar") { state.personal.avatarAssetId=cityId; state.personal.version++; return route.fulfill({ json: state.personal }); }
      if (path === "/organizations/current/profile") { const { expectedVersion: _version, idempotencyKey: _key, ...profile } = body; state.organization.profile = profile; state.organization.version++; return route.fulfill({ json: state.organization }); }
      if (path === "/support/tickets") return route.fulfill({json:{id:cityId,subject:body.subject,status:"OPEN"}});
      if (path.endsWith("/revoke")) { const id=path.split("/")[3]; state.sessions=state.sessions.filter(item => item.id !== id); return route.fulfill({ json: { id, status:"REVOKED" } }); }
    }
    if(path === "/auth/workspace-context") return route.fulfill({ json:{ organizationId, organizationDisplayName:"Демо организация", capabilities:[capability] } });
    if(path === "/access-control/policy") return route.fulfill({ json:{ mode:"ROLE_BASED", permissions:["organization.view", ...(canEdit ? ["organization.members.manage"] : []), "inventory.view", "import.manage", "supplier.warehouse.manage", "support.ticket.view", "support.ticket.create", "notification.view"] } });
    if(path === "/auth/current") return route.fulfill({ json:url.searchParams.has("workspace") ? { sessionId,user:state.personal } : null });
    if(path === "/auth/profile") return route.fulfill({ json:state.personal });
    if(path === "/auth/profile/avatar") return route.fulfill({ json:{contentType:"image/png",contentBase64:png} });
    if(path === "/auth/sessions") return route.fulfill({ json:state.sessions });
    if(path === "/organizations/current/profile") return route.fulfill({ json:state.organization });
    if(path === "/catalog/cities") return route.fulfill({ json:[{id:cityId,nameRu:"Алматы"}] });
    if(path.endsWith("/warehouses") || path.endsWith("/data-sources") || path.endsWith("/import-batches")) return route.fulfill({json:[]});
    if(path === "/conversations") return route.fulfill({ json:{items:[],hasMore:false,unreadCount:0} });
    if(path.startsWith("/notifications/organizations/")) return route.fulfill({ json:{items:[],unreadCount:0,hasMore:false,nextCursor:null} });
    state.unexpected.push(`${req.method()} ${path}`); return route.fulfill({status:503,json:{message:"Unexpected fixture request"}});
  });
  return state;
}
for(const role of ["clinic","supplier"] as const) for(const width of [1440,390]) test(`profile-edit ${role} layout and keyboard ${width}`, async({page},info) => {
  const state=await fixture(page,role); await page.setViewportSize({width,height:1000}); await page.goto(`/${role}/profile`);
  const region=page.getByRole("region",{name:"Данные профиля",exact:true});
  await expect(region.getByText("Тестовый сотрудник",{exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath(`profile-${role}-${width}.png`),fullPage:true});
  const edit=region.getByRole("button",{name:"Изменить: Имя",exact:true}); await edit.focus(); await page.keyboard.press("Enter");
  const name=region.getByRole("textbox",{name:"Имя",exact:false}); await expect(name).toBeFocused(); await name.fill("Новое имя"); await name.press("Escape"); await expect(edit).toBeFocused(); expect(state.writes).toHaveLength(0);
  await edit.click(); await name.fill("Новое имя"); await name.press("Enter"); await expect(region.getByText("Новое имя",{exact:true})).toBeVisible(); expect(state.personal.displayName).toBe("Новое имя");
  await region.getByRole("button",{name:"Изменить: Телефон",exact:true}).click(); const phone=region.getByRole("textbox",{name:"Телефон",exact:false}); await phone.fill(""); await phone.press("Enter"); await expect(region.getByRole("alert")).toHaveText("Заполните это поле"); await phone.fill("+7 700 111 22 33"); await region.getByRole("button",{name:"Сохранить: Телефон",exact:true}).click(); await expect(region.getByText("+7 700 111 22 33",{exact:true})).toBeVisible();
  const avatar=region.getByRole("button",{name:"Изменить фото профиля"}); await avatar.focus(); await expect(avatar.locator(".dm-avatar-edit-overlay")).toHaveCSS("opacity","1");
  await region.locator('input[type="file"]').setInputFiles({name:"photo.png",mimeType:"image/png",buffer:Buffer.from(png,"base64")}); await expect(page.locator(".dm-save-toast")).toContainText("Фото профиля сохранено"); await expect(avatar.locator("img")).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const sessions=page.getByRole("region",{name:"Активные сеансы"}); await expect(sessions.locator("li")).toHaveCount(5); await expect(sessions.locator("li").first()).toContainText("Текущий сеанс");
  await page.goto(`/${role}/settings`); await expect(page.getByRole("heading",{name:"Рабочие контакты"})).toBeVisible(); await page.screenshot({path:info.outputPath(`settings-${role}-${width}.png`),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true); expect(state.unexpected).toEqual([]);
});
test("profile-edit errors preserve drafts and email waits for confirmation",async({page})=>{
 const state=await fixture(page,"supplier"); await page.goto("/supplier/profile"); const region=page.getByRole("region",{name:"Данные профиля"});
 await region.getByRole("button",{name:"Изменить: Имя",exact:true}).click(); const field=region.getByRole("textbox",{name:"Имя",exact:false}); await field.fill("Сохранённый черновик"); state.conflict=true; await field.press("Enter"); await expect(region.getByRole("alert")).toContainText("Профиль изменился"); await expect(field).toHaveValue("Сохранённый черновик"); state.conflict=false; state.personal.version=2;
 await region.getByRole("button",{name:"Обновить данные",exact:true}).click(); await field.press("Enter"); await expect(region.getByText("Сохранённый черновик",{exact:true})).toBeVisible(); expect(state.writes.at(-1)?.expectedVersion).toBe(2);
 await region.getByRole("button",{name:"Изменить: Электронная почта",exact:true}).click(); const email=region.getByRole("textbox",{name:"Электронная почта",exact:false}); await email.fill("new@example.invalid"); await email.press("Enter"); await expect(page.locator(".dm-save-toast")).toContainText("Подтвердите"); await expect(region.getByText("user@example.invalid",{exact:true})).toBeVisible();
 await region.locator('input[type="file"]').setInputFiles({name:"bad.svg",mimeType:"image/svg+xml",buffer:Buffer.from("<svg/>")}); await expect(region.getByRole("alert")).toContainText("JPG или PNG");
});
for(const role of ["clinic","supplier"] as const) test(`profile-edit ${role} contact add edit retry and address save`,async({page})=>{
 const state=await fixture(page,role); await page.goto(`/${role}/settings`); const contacts=page.getByRole("region",{name:"Рабочие контакты"});
 const official=contacts.getByRole("group",{name:role === "supplier" ? "Официальный контакт" : "Основной контакт",exact:true}); const label=role === "supplier" ? "Официальный представитель" : "Контактное лицо";
 await official.getByRole("button",{name:`Изменить: ${label}`,exact:true}).click(); const name=official.getByRole("textbox",{name:label,exact:false}); await name.fill("Новый контакт"); state.fail=true; await name.press("Enter"); await expect(name).toHaveValue("Новый контакт"); await expect(contacts.getByRole("alert")).toContainText("Сервис временно недоступен"); state.fail=false; await name.press("Enter"); await expect(contacts.getByText("Новый контакт",{exact:true})).toBeVisible(); expect(state.writes[0]?.idempotencyKey).toBe(state.writes[1]?.idempotencyKey);
 if (role === "clinic") { await contacts.getByRole("button",{name:"Добавить ещё"}).click(); const form=contacts.getByRole("form",{name:"Новый рабочий контакт"}); await form.getByRole("textbox",{name:"Контактное лицо"}).fill("Второй контакт"); await form.getByRole("textbox",{name:"Телефон организации"}).fill("+77000000002"); await form.getByRole("textbox",{name:"Электронная почта организации"}).fill("second@example.invalid"); await form.getByRole("button",{name:"Добавить контакт",exact:true}).click(); await expect(form).toBeHidden(); expect(state.organization.profile?.additionalContacts).toHaveLength(1); } else { await expect(contacts.getByRole("button",{name:"Добавить ещё"})).toHaveCount(0); }
 const address=page.getByRole("textbox",{name:"Адрес получения: адрес",exact:true}); await address.fill("Новая улица, 15"); await page.getByRole("button",{name:"Сохранить адреса",exact:true}).click(); await expect(page.getByRole("button",{name:"Сохранить адреса",exact:true})).toBeHidden(); expect(state.organization.profile?.deliveryAddress.line1).toBe("Новая улица, 15"); expect(state.organization.profile?.additionalContacts).toHaveLength(role === "supplier" ? 2 : 1); expect(state.unexpected).toEqual([]);
});
test("profile-edit readonly organization and supplier tabs",async({page})=>{
 const state=await fixture(page,"supplier",false); await page.goto("/supplier/settings"); await expect(page.getByRole("button",{name:"Добавить ещё"})).toHaveCount(0); await expect(page.getByRole("button",{name:"Изменить: Официальный представитель",exact:true})).toBeDisabled(); await expect(page.getByRole("textbox",{name:"Адрес получения: адрес",exact:true})).toBeDisabled();
 await page.getByRole("tab",{name:"Склады",exact:true}).click(); await expect(page.getByText("Складов пока нет",{exact:true})).toBeVisible(); await page.getByRole("tab",{name:"Источники товаров",exact:true}).click(); await expect(page.getByText("Пока нет загрузок. Добавьте товары из прайса или выберите учётную систему.",{exact:true})).toBeVisible(); expect(state.writes).toHaveLength(0); expect(state.unexpected).toEqual([]);
});

test("profile-edit address conflict preserves local draft and fresh remote contacts", async ({ page }) => {
  const state = await fixture(page, "supplier"); await page.goto("/supplier/settings");
  const address = page.getByRole("textbox", { name: "Адрес получения: адрес", exact: true });
  await address.fill("Мой новый адрес, 22"); state.conflict = true;
  await page.getByRole("button", { name: "Сохранить адреса", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("Профиль изменился");
  state.organization.version = 2; state.organization.profile!.phone = "+77005556677";
  await page.getByRole("button", { name: "Обновить сохранённые данные", exact: true }).click();
  await expect(page.locator(".dm-save-toast")).toContainText("Данные обновлены");
  await expect(address).toHaveValue("Мой новый адрес, 22"); state.conflict = false;
  await page.getByRole("button", { name: "Сохранить адреса", exact: true }).click();
  await expect(page.getByRole("button", { name: "Сохранить адреса", exact: true })).toBeHidden();
  expect(state.organization.profile!.phone).toBe("+77005556677");
  expect(state.organization.profile!.deliveryAddress.line1).toBe("Мой новый адрес, 22");
});

test("profile-edit mobile cancel, session pagination revoke and empty recovery", async ({ page }) => {
  const state = await fixture(page, "supplier"); await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/supplier/profile"); const profile = page.getByRole("region", { name: "Данные профиля" });
  await profile.getByRole("button", { name: "Изменить: Имя", exact: true }).click();
  await profile.getByRole("textbox", { name: "Имя", exact: false }).fill("Не сохранять");
  await profile.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(profile.getByText("Тестовый сотрудник", { exact: true })).toBeVisible(); expect(state.writes).toHaveLength(0);
  const sessions = page.getByRole("region", { name: "Активные сеансы" });
  await sessions.getByRole("button", { name: "Далее", exact: true }).click(); await sessions.getByRole("button", { name: "Далее", exact: true }).click();
  await expect(sessions.locator("li")).toHaveCount(1); await sessions.getByRole("button", { name: "Завершить сеанс", exact: true }).click();
  await page.getByRole("button", { name: "Подтвердить завершение", exact: true }).click();
  await expect(sessions.getByRole("navigation", { name: "Страницы сеансов" })).toContainText("Страница 2 из 2");
  await expect(sessions.locator("li")).toHaveCount(5);
  state.sessions = []; await page.reload(); await expect(sessions.getByText("Активных сеансов нет", { exact: true })).toBeVisible();
});

test("supplier-contacts incomplete profile requires both reserves and explains visibility", async ({ page }, info) => {
  const state = await fixture(page, "supplier"); state.organization.profile!.additionalContacts = []; state.organization.complete = false;
  await page.goto("/supplier/settings"); const contacts = page.getByRole("region", { name: "Рабочие контакты", exact: true });
  await expect(contacts.getByRole("group")).toHaveCount(3);
  await contacts.getByRole("button", { name: "Где используется официальный контакт", exact: true }).hover();
  await expect(page.getByRole("note", { name: "Где используется официальный контакт", exact: true })).toContainText("в каталоге"); await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Сохранить настройки", exact: true }).click(); expect(state.writes).toHaveLength(0);
  await expect(page.locator("main").getByRole("alert").last()).toContainText("два резервных");
  for (const n of [1, 2]) { const group = contacts.getByRole("group", { name: `Резервный контакт ${n}`, exact: true });
    await group.getByRole("textbox", { name: "Контактное лицо", exact: false }).fill(`Сотрудник ${n}`);
    await group.getByRole("textbox", { name: "Телефон", exact: false }).fill(`+7700000000${n}`);
    await group.getByRole("textbox", { name: "Электронная почта", exact: false }).fill(`reserve${n}@example.invalid`);
  }
  await page.getByRole("button", { name: "Сохранить настройки", exact: true }).click();
  await expect(contacts.getByRole("button", { name: "Изменить: Официальный представитель", exact: true })).toBeVisible();
  expect(state.organization.profile!.additionalContacts).toHaveLength(2); await expect(page.locator(".dm-save-toast")).toContainText("сохранены");
  await page.screenshot({path:info.outputPath("supplier-three-contacts.png"),fullPage:true}); expect(state.unexpected).toEqual([]);
});

for (const width of [1440,390]) test(`supplier-sources cards request retry and import tabs ${width}`, async ({ page }, info) => {
  const state=await fixture(page,"supplier"); await page.setViewportSize({width,height:1000}); await page.goto("/supplier/settings?tab=sources");
  await expect(page.getByRole("button",{name:"Обновить список",exact:true})).toHaveCount(0);
  await expect(page.getByRole("link",{name:"Загрузить прайс",exact:true})).toHaveAttribute("href","/supplier/products/import");
  const one=page.getByRole("region",{name:"1С",exact:true}), moy=page.getByRole("region",{name:"МойСклад",exact:true});
  await expect(one).toBeVisible(); await expect(moy).toBeVisible();
  const a=await one.boundingBox(), b=await moy.boundingBox(); expect(a&&b).toBeTruthy(); if(width===1440) expect(a!.y).toBe(b!.y); else expect(b!.y).toBeGreaterThan(a!.y);
  await page.screenshot({path:info.outputPath(`sources-${width}.png`),fullPage:true});
  await one.getByRole("button",{name:"Подключить",exact:true}).click(); const dialog=page.getByRole("dialog");
  await expect(dialog).toContainText("Подключение 1С"); await dialog.getByRole("button",{name:"Отправить заявку",exact:true}).click();
  const field=dialog.getByRole("textbox",{name:"Название базы или конфигурации 1С",exact:false}); await expect(field).toBeFocused(); expect(state.writes).toHaveLength(0);
  await field.fill("Тестовая торговая база"); state.fail=true; await dialog.getByRole("button",{name:"Отправить заявку",exact:true}).click();
  await expect(dialog.getByRole("alert")).toContainText("Заявка не отправлена"); await expect(field).toHaveValue("Тестовая торговая база");
  await page.screenshot({path:info.outputPath(`connector-dialog-${width}.png`),fullPage:true});
  state.fail=false; await dialog.getByRole("button",{name:"Отправить заявку",exact:true}).click(); await expect(dialog).toBeHidden();
  expect(state.writes[0].idempotencyKey).toBe(state.writes[1].idempotencyKey); await expect(page.locator(".dm-save-toast")).toContainText("Заявка на подключение 1С отправлена");
  await moy.getByRole("button",{name:"Подключить",exact:true}).click(); await expect(dialog).toContainText("Подключение МойСклад"); await page.keyboard.press("Escape"); await expect(dialog).toBeHidden();
  await expect(moy.getByRole("button",{name:"Подключить",exact:true})).toBeFocused();
  const settingsTab=page.getByRole("tab",{name:"Источники товаров",exact:true}); const expected=await settingsTab.evaluate(el=>({padding:getComputedStyle(el).paddingInline,radius:getComputedStyle(el,"::after").borderRadius}));
  await page.getByRole("link",{name:"Загрузить прайс",exact:true}).click(); const tabs=page.getByRole("tablist",{name:"Импорт",exact:true});
  const newTab=tabs.getByRole("tab",{name:"Новая загрузка",exact:true}), history=tabs.getByRole("tab",{name:"История загрузок",exact:true});
  await newTab.focus(); await page.keyboard.press("ArrowRight"); await expect(history).toBeFocused(); await page.keyboard.press("Enter"); await expect(history).toHaveAttribute("aria-selected","true");
  expect(await history.evaluate(el=>({padding:getComputedStyle(el).paddingInline,radius:getComputedStyle(el,"::after").borderRadius}))).toEqual(expected);
  await expect(tabs).toHaveCSS("column-gap","0px"); await page.screenshot({path:info.outputPath(`import-tabs-${width}.png`),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true); expect(state.unexpected).toEqual([]);
});

for (const width of [1440,390]) test(`supplier-order contact presentation and navigation ${width}`, async ({ page }, info) => {
  const state = await fixture(page, "clinic"); await page.setViewportSize({width,height:950});
  const id = "55555555-5555-4555-8555-555555555555";
  const order = { id, orderNumber: "SO-TEST", version: 1, supplierOrganizationId: cityId, buyerOrganizationId: organizationId, status: "CANCELLED", paymentStatus: "UNPAID", currency: "KZT", subtotalAmountMinor: "10000", createdAt: "2026-10-07T10:00:00Z", items: [], shipments: [] };
  const official = { contactName: "Официальный представитель", phone: "+77000000000", email: "office@example.invalid" };
  const reserves = [1,2].map(n=>({contactName:`Резервный сотрудник ${n}`,phone:`+7700000000${n}`,email:`reserve${n}@example.invalid`}));
  await page.route(`**/api/supplier-orders/${id}/workflow`, route=>route.fulfill({json:{orderId:id,order,version:1,status:order.status,paymentStatus:order.paymentStatus,invoiceDocumentId:null,claims:[],events:[],supplierContacts:{official,reserves}}}));
  await page.goto(`/clinic/orders/${id}`);
  const contacts=page.getByRole("region",{name:"Контакты поставщика",exact:true}); await expect(contacts.getByText(official.contactName,{exact:true})).toBeVisible();
  for (const contact of [official,...reserves]) { await expect(contacts.getByRole("link",{name:contact.phone,exact:true})).toHaveAttribute("href",`tel:${contact.phone}`); await expect(contacts.getByRole("link",{name:contact.email,exact:true})).toHaveAttribute("href",`mailto:${contact.email}`); }
  const tabs=page.getByRole("tablist",{name:"Подробности заказа",exact:true}); await tabs.getByRole("tab").first().focus(); await page.keyboard.press("ArrowRight"); await page.keyboard.press("Enter");
  await expect(tabs.getByRole("tab").nth(1)).toHaveAttribute("aria-selected","true");
  await page.screenshot({path:info.outputPath(`order-contacts-${width}.png`),fullPage:true}); expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true); expect(state.unexpected).toEqual([]);
});

test("save-feedback mobile touch help and timed dismissal", async ({page},info) => {
  const errors:string[]=[]; page.on("pageerror",error=>errors.push(error.message));
  await fixture(page,"clinic"); await page.setViewportSize({width:390,height:844}); await page.goto("/clinic/profile");
  await page.getByRole("button",{name:"Подсказка: Телефон",exact:true}).click(); await expect(page.getByRole("note",{name:"Подсказка: Телефон",exact:true})).toBeVisible(); await page.keyboard.press("Escape");
  await page.getByRole("button",{name:"Изменить: Имя",exact:true}).click(); await page.getByRole("textbox",{name:"Имя",exact:false}).fill("Новое имя");
  const clockStart=Date.now(); await page.clock.install({time:clockStart}); await page.clock.pauseAt(clockStart+1000);
  await page.getByRole("button",{name:"Сохранить: Имя",exact:true}).click(); const toast=page.locator(".dm-save-toast"); await expect(toast).toContainText("Изменения сохранены");
  await page.clock.fastForward(4500); await expect(toast).toBeVisible(); await expect(toast).not.toHaveAttribute("data-leaving","true");
  await page.screenshot({path:info.outputPath("save-toast-mobile.png"),fullPage:true});
  await page.clock.fastForward(500); await expect(toast).toHaveAttribute("data-leaving","true"); await page.clock.fastForward(220); await expect(toast).toHaveCount(0); expect(errors).toEqual([]);
});

test("save-feedback five-second toast, contextual phone help and clean cancel hover",async({page},info)=>{
  const state=await fixture(page,"supplier"); state.personal.phone=null; await page.goto("/supplier/profile"); const region=page.getByRole("region",{name:"Данные профиля",exact:true});
  await expect(region.getByText("Добавьте обязательный номер телефона в свой профиль.")).toHaveCount(0);
  const help=region.getByRole("button",{name:"Подсказка: Телефон",exact:true}); await help.click(); await expect(page.getByRole("note",{name:"Подсказка: Телефон",exact:true})).toContainText("Телефон обязателен"); await page.keyboard.press("Escape");
  await region.getByRole("button",{name:"Изменить: Имя",exact:true}).click(); await expect(region.getByText("Enter — сохранить",{exact:true})).toHaveCount(0);
  const cancel=region.getByRole("button",{name:"Отмена",exact:true}); await cancel.hover(); await expect(cancel).toHaveCSS("text-decoration-line","none");
  await region.getByRole("textbox",{name:"Имя",exact:false}).fill("Новое имя"); await region.getByRole("button",{name:"Сохранить: Имя",exact:true}).click();
  const toast=page.locator(".dm-save-toast"); await expect(toast).toContainText("Изменения сохранены"); await expect(region.getByText("Изменения сохранены",{exact:true})).toHaveCount(0);
  const size=page.viewportSize()!;
  await expect.poll(async()=>{const bounds=await toast.boundingBox(); return bounds ? Math.round(size.width-bounds.x-bounds.width) : null;}).toBe(24);
  const bounds=await toast.boundingBox(); expect(bounds).toBeTruthy(); expect(size.height-bounds!.y-bounds!.height).toBe(24);
  await page.screenshot({path:info.outputPath("save-toast.png"),fullPage:true}); await expect(toast).toBeHidden({timeout:8000}); expect(state.unexpected).toEqual([]);
});
