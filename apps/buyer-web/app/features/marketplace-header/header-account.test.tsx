import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CurrentSession } from "@marketplace/schemas/workspace-session";

const state = vi.hoisted(() => ({
  slots: [] as unknown[],
  buyer: { ready: true, session: null as null | { organizationId: string; organizationDisplayName: string } },
  personal: { ready: true, error: null as string | null, session: { user: { id: "user", displayName: "Nikita Dent" } } as null | { user: { id: string; displayName: string } } },
}));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useState: () => [state.slots.shift(), vi.fn()] }));
vi.mock("../../use-buyer-session", () => ({ useBuyerSession: () => state.buyer }));
vi.mock("../../personal-session", () => ({ usePersonalSession: () => state.personal, personalSessionStore: { retry: vi.fn() } }));
vi.mock("../../public-links", () => ({ loginUrl: "/login" }));
vi.mock("@marketplace/ui/loading-state", async () => {
  const { createElement } = await import("react");
  return { LoadingState: ({ label }: { label: string }) => createElement("span", { role: "status" }, label) };
});
vi.mock("@marketplace/ui/controls", async () => {
  const { createElement } = await import("react");
  return { DmButton: ({ as = "button", appearance: _appearance, ...props }: { as?: string; appearance?: string }) => createElement(as, props) };
});
import { HeaderAccount } from "./header-account";

function session(capabilities: ("BUYER" | "SUPPLIER")[]): CurrentSession {
  return { activeOrganizationId: "active", workspaces: [{ organizationId: "active", organizationDisplayName: "Организация", capabilities }] } as CurrentSession;
}
function render(current: CurrentSession | null, { ready = true, error = "" } = {}) {
  state.slots = [current, ready, error, 0, "/catalog?lang=kk"];
  return renderToStaticMarkup(<HeaderAccount />);
}
beforeEach(() => {
  state.buyer = { ready: true, session: null };
  state.personal = { ready: true, error: null, session: { user: { id: "user", displayName: "Nikita Dent" } } };
});
afterEach(() => vi.unstubAllGlobals());
describe("account navigation follows verified workspace, independently of cart mode", () => {
  it.each(["personal", "organization"])("opens the supplier workspace with %s purchase mode", mode => {
    vi.stubGlobal("window", { sessionStorage: { getItem: () => mode } });
    const html = render(session(["SUPPLIER"]));
    expect(html).toContain('href="/login?returnTo=%2Fsupplier"');
    expect(html).toContain("Поставщик · Личный кабинет");
    expect(html).not.toContain("/personal/cart");
  });
  it("opens the clinic even when its purchase session is hidden by personal mode", () => {
    const html = render(session(["BUYER"]));
    expect(html).toContain('href="/login?returnTo=%2Fclinic"');
    expect(html).toContain("Клиника · Личный кабинет");
  });
  it("does not let a stale buyer session override the active supplier organization", () => {
    state.buyer.session = { organizationId: "old", organizationDisplayName: "Старая клиника" };
    const html = render(session(["SUPPLIER"]));
    expect(html).toContain('href="/login?returnTo=%2Fsupplier"');
    expect(html).not.toContain("Старая клиника");
  });
  it("opens the personal section only after confirming there is no workspace", () => {
    const html = render(null);
    expect(html).toContain('href="/personal/cart"');
    expect(html).toContain("Nikita Dent · Личный кабинет");
  });
  it("offers a choice for a dual-capability organization", () => {
    const html = render(session(["BUYER", "SUPPLIER"]));
    expect(html).toContain('href="/login"');
    expect(html).toContain("Выбрать кабинет");
  });
  it("does not substitute personal cart while checking organization", () => {
    expect(render(null, { ready: false })).toContain("Кабинет жүктелуде…");
    expect(render(null, { ready: false })).not.toContain("href=");
  });
  it("shows recovery on failed verification even if an old workspace and personal session exist", () => {
    const html = render(session(["SUPPLIER"]), { error: "offline" });
    expect(html).toContain("Повторить"); expect(html).not.toContain("href=");
  });
  it("does not reinterpret an unavailable active organization as a personal account", () => {
    const current = session(["SUPPLIER"]); current.activeOrganizationId = "removed";
    expect(render(current)).toContain("Повторить");
    expect(render(current)).not.toContain("/personal/cart");
  });
  it("waits for the personal identity and exposes its errors", () => {
    state.personal.ready = false;
    expect(render(null)).toContain("Кабинет жүктелуде…");
    state.personal.ready = true; state.personal.error = "offline";
    expect(render(null)).toContain("Повторить");
  });
  it("keeps a verified supplier workspace available when the personal request fails", () => {
    state.personal.error = "offline";
    expect(render(session(["SUPPLIER"]))).toContain('href="/login?returnTo=%2Fsupplier"');
  });
  it("offers login to a signed-out visitor", () => {
    state.personal.session = null;
    const html = render(null);
    expect(html).toContain("Войти"); expect(html).not.toContain("/personal/cart");
  });
});
