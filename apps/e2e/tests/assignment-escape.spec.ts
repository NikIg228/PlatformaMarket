import { test, expect, type Page } from "@playwright/test";

const actor = "30000000-0000-4000-8000-000000000001";
const organization = "20000000-0000-4000-8000-000000000001";

async function assignmentPage(page: Page) {
  const unexpected: string[] = [];
  await page.addInitScript(({ actor, organization }) => {
    sessionStorage.setItem("dentmarket_admin_session", JSON.stringify({
      accessToken: "synthetic-assignment-ui-proof-not-a-real-jwt", sessionId: "10000000-0000-4000-8000-000000000001",
      activeOrganizationId: organization, user: { id: actor, displayName: "Оператор проверки" }, expiresAt: Date.now() + 3600000,
    }));
  }, { actor, organization });
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    let json: unknown;
    if (path === "/organizations") json = [{ id: organization, capabilities: [{ capability: "MARKETPLACE_OPERATOR" }] }];
    else if (path.startsWith("/notifications/")) json = { items: [], unreadCount: 0, nextCursor: null, asOf: new Date().toISOString() };
    else if (path === "/operations/work-queue/assignees" || path === "/catalog/products" || path.endsWith("/history")) json = [];
    else if (path === "/access-control/permissions") json = ["support.ticket.view"];
    else if (path === "/operations/dashboard") json = {
      observedAt: new Date().toISOString(), scope: "PLATFORM_CURRENT_ALL_STATUSES",
      organizations: { status: "AVAILABLE", value: 1 }, masterProducts: { status: "AVAILABLE", value: 0 }, effectivePermissions: { status: "AVAILABLE", value: 1 },
    };
    else if (path === "/operations/work-queue") json = {
      generatedAt: new Date().toISOString(), operatorOrganizationId: organization, totalOpenItems: 1,
      sections: [{ type: "CATALOG_REVIEW", priority: "NORMAL", count: 1, hasMore: false,
        items: [{ id: actor, proposedName: "Проверка загрузки назначения", reason: "Нужно проверить карточку", href: "/admin?section=catalog", assignment: null }] }],
    };
    else { unexpected.push(path); return route.fulfill({ status: 500, json: { message: "Unexpected assignment fixture endpoint" } }); }
    return route.fulfill({ json });
  });
  await page.goto("/admin?section=overview");
  const opener = page.getByRole("button", { name: "Назначение и история", exact: true });
  await expect(opener).toBeVisible();
  return { opener, unexpected };
}

test("assignment retains keyboard focus when the lazy form replaces loading", async ({page}, info) => {
  const {opener,unexpected}=await assignmentPage(page);
  let release!:()=>void;let intercepted=false;
  const pending=new Promise<void>(resolve=>{release=resolve;});
  await page.route("**/_next/static/chunks/*.js",async route=>{
    const response=await route.fetch();
    if(/Назначение сохранено\.|\.operationHistory\(/.test(await response.text())){intercepted=true;await pending;}
    await route.fulfill({response});
  });
  await opener.focus();await page.keyboard.press("Enter");
  await expect.poll(()=>intercepted).toBe(true);
  const dialog=page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect.poll(()=>dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);
  await page.screenshot({path:info.outputPath("loading.png")});
  const close=dialog.getByRole("button",{name:"Закрыть",exact:true});
  await close.focus();
  release();
  await expect(dialog.getByLabel("Приоритет",{exact:true})).toBeVisible();
  await expect(dialog.getByText("Назначение ещё не менялось.",{exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath("loaded.png")});
  await expect(close).toBeFocused();
  await expect.poll(()=>dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");await expect(dialog).toBeHidden();await expect(opener).toBeFocused();
  expect(unexpected).toEqual([]);
});

for (const width of [1440,390]) test(`assignment closes with immediate Escape on repeated keyboard opening ${width}`, async ({page}) => {
  await page.setViewportSize({width,height:900});
  const {opener,unexpected}=await assignmentPage(page);
  for(let i=0;i<10;i++){
    await opener.focus();await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(opener).toBeFocused();
  }
  expect(unexpected).toEqual([]);
});

test("assignment loader remains closed when its pending chunk finishes after Escape", async ({ page }) => {
  const { opener, unexpected } = await assignmentPage(page);
  let release!: () => void;
  let intercepted = false;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/_next/static/chunks/*.js", async route => {
    const response = await route.fetch();
    if (/Назначение сохранено\.|\.operationHistory\(/.test(await response.text())) {
      intercepted = true;
      await pending;
    }
    await route.fulfill({ response });
  });
  await opener.click();
  await expect.poll(() => intercepted).toBe(true);
  await expect(page.getByRole("dialog", { name: "Назначение задачи", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  release();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(opener).toBeFocused();
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Задача: Проверка загрузки назначения", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Назначение ещё не менялось.", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  expect(unexpected).toEqual([]);
});

test("assignment loader retries a failed chunk without losing its selected task", async ({ page }) => {
  const { opener, unexpected } = await assignmentPage(page);
  let rejected = false;
  let rejectChunk = true;
  await page.route("**/_next/static/chunks/*.js", async route => {
    const response = await route.fetch();
    if (rejectChunk && /Назначение сохранено\.|\.operationHistory\(/.test(await response.text())) {
      rejected = true;
      return route.abort("failed");
    }
    await route.fulfill({ response });
  });
  await opener.click();
  await expect(page.getByText("Не удалось открыть назначение.", { exact: true })).toBeVisible();
  rejectChunk = false;
  await page.getByRole("button", { name: "Повторить открытие", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Задача: Проверка загрузки назначения", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Назначение ещё не менялось.", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  expect(rejected).toBe(true);
  expect(unexpected).toEqual([]);
});


test("assignment ignores Escape while saving and closes after a recoverable error", async ({page},info) => {
  const {opener,unexpected}=await assignmentPage(page);
  await page.route("**/api/access-control/permissions",route=>route.fulfill({json:["support.ticket.view","support.ticket.manage"]}));
  await page.reload(); await expect(page.getByRole("region",{name:"Операционная очередь"})).toBeVisible();
  let release!:()=>void;let saving=false;
  const pending=new Promise<void>(resolve=>{release=resolve;});
  await page.route("**/api/operations/work-queue/*/*/assignment",async route=>{
    saving=true;await pending;
    await route.fulfill({status:409,json:{code:"CONFLICT",message:"Назначение изменилось"}});
  });
  await opener.click();const dialog=page.getByRole("dialog");
  const reason=dialog.getByLabel("Причина изменения (не менее 10 символов)",{exact:true});
  await reason.fill("Проверка сохранения назначения");
  await dialog.getByRole("button",{name:"Сохранить назначение",exact:true}).click();
  await expect.poll(()=>saving).toBe(true);
  await expect(dialog.getByRole("button",{name:"Закрыть",exact:true})).toBeDisabled();
  await dialog.getByRole("button",{name:"Закрыть окно",exact:true}).focus();
  await page.keyboard.press("Escape");await expect(dialog).toBeVisible();
  release();await expect(page.locator(".dm-save-toast").filter({hasText:"Ввод сохранён"})).toBeVisible();
  await expect(reason).toHaveValue("Проверка сохранения назначения");
  await expect(dialog).toHaveCSS("opacity","1");
  console.log('assignment styles',await dialog.evaluate(el=>({radius:getComputedStyle(el).borderRadius,font:getComputedStyle(el).fontFamily})));
  await page.screenshot({path:info.outputPath("assignment-error.png"),animations:"disabled"});
  await page.keyboard.press("Escape");await expect(dialog).toBeHidden();await expect(opener).toBeFocused();
  expect(unexpected).toEqual([]);
});
