import { expect, type Page } from "@playwright/test";

/** Synthetic authenticated fixtures; normal browser login is tested separately. */
export async function openFixtureHandoff(page: Page, url: string, input: object) {
  const value = input as { capability?: string; organizationId?: string; handoffCode?: string; accessToken?: string; browserProofCookie?: string };
  if (value.accessToken) {
    // A fixture session belongs in browser storage, never a navigable URL.
    expect(["BUYER", "SUPPLIER"]).toContain(value.capability);
    await page.goto(new URL(url).origin);
    await page.evaluate(session => sessionStorage.setItem(`dentmarket:${session.capability!.toLowerCase()}-session`, JSON.stringify(session)), value);
    await page.goto(url);
    return;
  }
  expect(value.browserProofCookie).toBeTruthy();
  const separator = value.browserProofCookie!.indexOf("=");
  const name = value.browserProofCookie!.slice(0, separator), proof = value.browserProofCookie!.slice(separator + 1);
  expect(name).toBe(`mp_handoff_${value.capability?.toLowerCase()}`);
  await page.context().addCookies([{ name, value: proof, domain: new URL(url).hostname, path: "/api/auth/handoff", httpOnly: true, secure: false, sameSite: "Lax" }]);
  const handoff = { capability: value.capability, organizationId: value.organizationId, handoffCode: value.handoffCode };
  await page.goto(`${url}#session=${encodeURIComponent(JSON.stringify(handoff))}`);
}
