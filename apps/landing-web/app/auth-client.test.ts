import { afterEach, describe, expect, it, vi } from "vitest";
import {
  apiErrorMessage,
  feedbackFromError,
  AuthRequestError,
  pickCapability,
  workspaceHandoffUrl,
  openWorkspace,
  openPersonalWorkspace,
  workspaceOptions,
} from "./auth-client";

describe("landing auth contract", () => {
  it("opens the personal cart on the unified app's relative buyer origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_BUYER_APP_URL", "/");
    vi.resetModules();
    try {
      const { openPersonalWorkspace: openUnifiedPersonal } = await import("./auth-client");
      const id = "00000000-0000-4000-8000-000000000001", assign = vi.fn();
      vi.stubGlobal("window", { location: { origin: "https://market.example", assign }, sessionStorage: { setItem: vi.fn() } });
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ user: { id, displayName: "Fixture" }, sessionId: id, mode: "PERSONAL", accessToken: "personal", accessTokenExpiresIn: 900 }))));
      await expect(openUnifiedPersonal(id)).resolves.toBe(true);
      expect(assign).toHaveBeenCalledWith("https://market.example/personal/cart");
    } finally { vi.unstubAllEnvs(); vi.resetModules(); }
  });
  it("opens a verified personal account without a workspace handoff and rejects account substitution", async () => {
    const userId = "00000000-0000-4000-8000-000000000001";
    const sessionId = "00000000-0000-4000-8000-000000000002";
    const assign = vi.fn(), setItem = vi.fn();
    vi.stubGlobal("window", { location: { assign }, sessionStorage: { setItem } });
    const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ user: { id: userId, displayName: "Fixture" }, sessionId, mode: "PERSONAL", accessToken: "personal", accessTokenExpiresIn: 900 })));
    vi.stubGlobal("fetch", fetcher);
    await expect(openPersonalWorkspace(userId, "/catalog?q=test")).resolves.toBe(true);
    expect(assign).toHaveBeenCalledWith(expect.stringContaining("/catalog?q=test"));
    expect(setItem).toHaveBeenCalledWith("dentmarket:buyer-context", "personal");
    expect(fetcher).toHaveBeenCalledTimes(1);
    await expect(openPersonalWorkspace(sessionId)).rejects.toThrow("Аккаунт изменился");
    expect(assign).toHaveBeenCalledTimes(1);
  });
  const organizations = [
    { organizationId: "buyer", organizationDisplayName: "Clinic", capabilities: ["BUYER" as const] },
    { organizationId: "dual", organizationDisplayName: "Both", capabilities: ["BUYER" as const, "SUPPLIER" as const] },
  ];
  it("offers only organizations with the explicitly requested workspace", () => {
    expect(workspaceOptions(organizations, "/supplier")).toEqual([
      { organizationId: "dual", organizationDisplayName: "Both", capability: "SUPPLIER" },
    ]);
    expect(workspaceOptions(organizations.slice(0, 1), "/supplier/documents")).toEqual([]);
    expect(workspaceOptions(organizations, "/clinic/orders")).toHaveLength(2);
  });
  it("keeps ordinary login and public browsing separate from a requested workspace role", () => {
    expect(workspaceOptions(organizations)).toHaveLength(3);
    expect(workspaceOptions(organizations, "/catalog?q=test")).toHaveLength(3);
    expect(workspaceOptions(organizations, "https://outside.invalid/supplier")).toHaveLength(3);
  });
  it("preserves backend validation messages and request id", () => {
    expect(apiErrorMessage({ message: ["Email неверен", "Пароль слишком короткий"] }, 400)).toBe(
      "Email неверен. Пароль слишком короткий",
    );
    expect(
      feedbackFromError(
        new AuthRequestError("Сессия истекла", "request-42"),
        "Не удалось войти",
      ),
    ).toEqual({
      kind: "error",
      message: "Сессия истекла",
      requestId: "request-42",
    });
  });

  it("honors the selected workspace when the organization supports it", () => {
    expect(pickCapability(["BUYER", "SUPPLIER"], undefined, "SUPPLIER")).toBe(
      "SUPPLIER",
    );
    expect(pickCapability(["BUYER"], undefined, "SUPPLIER")).toBeUndefined();
    expect(pickCapability(["BUYER", "SUPPLIER"], "BUYER", "SUPPLIER")).toBe("SUPPLIER");
  });

  it("creates a fragment-only handoff without putting the token in query params", () => {
    const url = workspaceHandoffUrl({
      capability: "BUYER",
      handoffCode: "one-time-code",
      displayName: "Айдана",
      organizationDisplayName: "Клиника",
      organizationId: "org-1",
    });

    expect(url).toContain("/#session=");
    expect(url).not.toContain("?session=");
    expect(decodeURIComponent(url.split("#session=")[1] ?? "")).toContain(
      '"handoffCode":"one-time-code"',
    );
  });
  it.each([
    ["BUYER", "/clinic", "/"],
    ["BUYER", "/clinic?q=Filtek", "/?q=Filtek"],
    ["SUPPLIER", "/supplier", "/"],
  ] as const)("maps the canonical %s account entry to its legacy app root", (capability, returnTo, expected) => {
    const target = new URL(workspaceHandoffUrl({ capability, returnTo, handoffCode: "one-time-code", displayName: "Test", organizationId: "org-1" }));
    expect(target.pathname + target.search).toBe(expected);
    expect(target.hash).toMatch(/^#session=/);
  });
});

describe("workspace context before handoff", () => {
  const organizationId = "00000000-0000-4000-8000-000000000001";
  const session = { accessToken: "synthetic-bearer", activeOrganizationId: organizationId, user: { id: "actor", displayName: "Test", email: "test@example.invalid" } };
  afterEach(() => vi.unstubAllGlobals());
  function setup(context: unknown, status = 200, handoffStatus = 201) {
    const assign = vi.fn(); vi.stubGlobal("window", { location: { assign }, sessionStorage: { setItem: vi.fn() } });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(context, { status }))
      .mockResolvedValueOnce(Response.json({ handoffCode: "synthetic-one-time-code" }, { status: handoffStatus }));
    vi.stubGlobal("fetch", fetcher); return { assign, fetcher };
  }
  it.each(["BUYER", "SUPPLIER"] as const)("opens the actual %s organization without an operator directory lookup", async capability => {
    const { assign, fetcher } = setup({ organizationId, organizationDisplayName: "Test organization", capabilities: [capability] });
    await openWorkspace(session, capability);
    if (capability === "BUYER") expect(window.sessionStorage.setItem).toHaveBeenCalledWith("dentmarket:buyer-context", "organization");
    else expect(window.sessionStorage.setItem).not.toHaveBeenCalled();
    expect(fetcher.mock.calls[0][0]).toMatch(/\/auth\/workspace-context$/);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ headers: { authorization: "Bearer synthetic-bearer" }, cache: "no-store" });
    expect(fetcher.mock.calls[1][1]?.body).toBe(JSON.stringify({ capability }));
    const destination = new URL(assign.mock.calls[0][0]);
    expect(destination.search).toBe("");
    expect(JSON.parse(decodeURIComponent(destination.hash.slice("#session=".length)))).toMatchObject({ capability, organizationId, handoffCode: "synthetic-one-time-code" });
    expect(destination.href).not.toContain("synthetic-bearer");
  });
  it("honors a supported supplier preference for a dual-capability organization", async () => {
    const { fetcher } = setup({ organizationId, organizationDisplayName: "Test", capabilities: ["BUYER", "SUPPLIER"] });
    await openWorkspace(session, "SUPPLIER");
    expect(fetcher.mock.calls[1][1]?.body).toBe('{"capability":"SUPPLIER"}');
  });
  it.each(["BUYER", "SUPPLIER"] as const)("returns to the public product without installing supplier credentials as buyer: %s", async capability => {
    const { assign, fetcher } = setup({ organizationId, organizationDisplayName: "Test", capabilities: [capability] });
    const returnTo = "/products/00000000-0000-4000-8000-000000000001?returnTo=%2Fcatalog%3Fcount%3D48";
    await openWorkspace(session, capability, undefined, returnTo);
    const url = new URL(assign.mock.calls[0][0]);
    expect(url.pathname + url.search).toBe(returnTo);
    if (capability === "BUYER") expect(url.hash).toMatch(/^#session=/);
    else expect(url.hash).toBe("");
    expect(fetcher).toHaveBeenCalledTimes(2); // Context and handoff only; no cart or purchase.
  });
  it("ignores an external return hint without issuing a different capability", async () => {
    const { assign } = setup({ organizationId, organizationDisplayName: "Test", capabilities: ["BUYER"] });
    await openWorkspace(session, "BUYER", undefined, "https://outside.invalid");
    expect(new URL(assign.mock.calls[0][0]).pathname).toBe("/");
    expect(assign.mock.calls[0][0]).not.toContain("outside.invalid");
  });
  it.each([
    { organizationId: "00000000-0000-4000-8000-000000000002", organizationDisplayName: "Foreign", capabilities: ["BUYER"] },
    { organizationId, organizationDisplayName: "Operator", capabilities: [] },
    { organizationId, organizationDisplayName: "Malformed", capabilities: ["MARKETPLACE_OPERATOR"] },
  ])("does not create a handoff for wrong, unsupported or malformed context", async context => {
    const { assign, fetcher } = setup(context);
    await expect(openWorkspace(session)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1); expect(assign).not.toHaveBeenCalled();
  });
  it("preserves a safe denied-context error and request id", async () => {
    const { assign, fetcher } = setup({ message: "Доступ отключён", requestId: "request-test" }, 403);
    await expect(openWorkspace(session)).rejects.toMatchObject({ message: "Доступ отключён", requestId: "request-test" });
    expect(fetcher).toHaveBeenCalledTimes(1); expect(assign).not.toHaveBeenCalled();
  });
  it("never redirects when handoff issuance fails", async () => {
    const { assign } = setup({ organizationId, organizationDisplayName: "Test", capabilities: ["BUYER"] }, 200, 503);
    await expect(openWorkspace(session)).rejects.toThrow("Не удалось открыть кабинет");
    expect(assign).not.toHaveBeenCalled();
    expect(window.sessionStorage.setItem).not.toHaveBeenCalled();
  });

  it.each([
    ["BUYER", "/clinic"],
    ["SUPPLIER", "/supplier"],
  ] as const)("completes a header return into the unified %s workspace", async (capability, returnTo) => {
    vi.stubEnv("NEXT_PUBLIC_UNIFIED_APP", "true");
    vi.resetModules();
    try {
      const { openWorkspace: openUnifiedWorkspace } = await import("./auth-client");
      const { assign, fetcher } = setup({ organizationId, organizationDisplayName: "Test", capabilities: [capability] });
      await openUnifiedWorkspace(session, capability, undefined, returnTo);
      const target = new URL(assign.mock.calls[0][0], "https://market.example");
      expect(target.pathname + target.search).toBe(returnTo);
      expect(target.hash).toMatch(/^#session=/);
      expect(JSON.parse(decodeURIComponent(target.hash.slice(9)))).toMatchObject({ capability, organizationId, handoffCode: "synthetic-one-time-code" });
      expect(fetcher.mock.calls[1][1]?.body).toBe(JSON.stringify({ capability }));
    } finally { vi.unstubAllEnvs(); vi.resetModules(); }
  });
});
