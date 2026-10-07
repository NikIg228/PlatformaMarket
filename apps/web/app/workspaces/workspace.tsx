"use client";
import { ActionFeedback } from "@marketplace/ui";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  MarketplaceApiClient,
  type ApiContext,
  type SessionHandoffEnvelope,
} from "@marketplace/api-client";
import {
  DmButton,
  ConversationCounter,
  ErrorState,
  LoadingState,
  useSessionLogout,
  useWorkspaceSession,
} from "@marketplace/ui";
import { withWorkspaceReturn } from "@marketplace/schemas/product-navigation";
import * as clinic from "../../../buyer-web/app/workspace-session";
import * as supplier from "../../../supplier-web/app/workspace-session";
import { logoutPrimarySession } from "../../../buyer-web/app/logout-primary-session";
import { Grid24Regular } from "@fluentui/react-icons/svg/grid";
import { Cart24Regular } from "@fluentui/react-icons/svg/cart";
import { ClipboardTaskListLtr24Regular } from "@fluentui/react-icons/svg/clipboard-task-list-ltr";
import { Document24Regular } from "@fluentui/react-icons/svg/document";
import { Home24Regular } from "@fluentui/react-icons/svg/home";
import { Box24Regular } from "@fluentui/react-icons/svg/box";
import { Navigation24Regular } from "@fluentui/react-icons/svg/navigation";
import { Chat24Regular } from "@fluentui/react-icons/svg/chat";
import styles from "./workspace.module.css";
import { WorkspacePermissions } from "./workspace-permissions";
import { MessageHeader } from "./message-header";
import { WorkspaceFooter } from "./workspace-footer";

export type WorkspaceRole = "clinic" | "supplier";
type WorkspaceContext = {
  role: WorkspaceRole;
  api: MarketplaceApiClient;
  apiContext: ApiContext;
  organizationId: string;
  session: SessionHandoffEnvelope;
  logout: ReturnType<typeof useSessionLogout>;
};
const Context = createContext<WorkspaceContext | null>(null);
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("Страница должна находиться внутри кабинета");
  return value;
}
const links = {
  clinic: [
    ["/clinic", "Главная"],
    ["/catalog", "Каталог"],
    ["/clinic/cart", "Корзина"],
    ["/clinic/orders", "Заказы"],
    ["/clinic/documents", "Документы"],
    ["/clinic/messages", "Сообщения"],
  ],
  supplier: [
    ["/supplier", "Главная"],
    ["/supplier/products", "Товары"],
    ["/supplier/orders", "Заказы"],
    ["/supplier/documents", "Документы"],
    ["/supplier/messages", "Сообщения"],
  ],
};
const navigationIcons: Record<string, ReactNode> = {
  Каталог: <Grid24Regular />,
  Корзина: <Cart24Regular />,
  Заказы: <ClipboardTaskListLtr24Regular />,
  Документы: <Document24Regular />,
  Главная: <Home24Regular />,
  Товары: <Box24Regular />,
};
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";
async function logoutSupplier() {
  await logoutPrimarySession(API_URL);
  await supplier.logoutSession();
}

export function Workspace({
  role,
  children,
}: {
  role: WorkspaceRole;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => {
    setMenuOpen(false);
    if (window.matchMedia("(max-width: 760px)").matches) document.getElementById("workspace-menu-toggle")?.focus();
  };
  useEffect(() => {
    if (!menuOpen) return;
    const frame = requestAnimationFrame(() => document.querySelector<HTMLElement>("#workspace-sidebar nav a[href]")?.focus());
    return () => cancelAnimationFrame(frame);
  }, [menuOpen]);
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 760px)");
    const resize = () => {
      setMenuOpen(false);
      if (mobile.matches && (document.activeElement === document.body || document.getElementById("workspace-sidebar")?.contains(document.activeElement))) {
        document.getElementById("workspace-menu-toggle")?.focus();
      }
    };
    mobile.addEventListener("change", resize);
    return () => mobile.removeEventListener("change", resize);
  }, []);
  const adapter = role === "clinic" ? clinic : supplier;
  const { session, ready, error } = useWorkspaceSession(adapter.sessionStore);
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const api = useMemo(
    () => new MarketplaceApiClient(API_URL, adapter.sessionApiContext),
    [adapter],
  );
  const logout = useSessionLogout({
    sessionKey: `dentmarket:${role === "clinic" ? "buyer" : "supplier"}-session`,
    sessionId: session?.sessionId,
    revoke: role === "clinic" ? clinic.logoutSession : logoutSupplier,
    redirectUrl: "/login",
  });
  const label = role === "clinic" ? "Кабинет клиники" : "Кабинет поставщика";
  const renderContent = (pageContent: ReactNode) => (
    <div
      className={styles.root}
      data-authenticated={Boolean(ready && session?.organizationId)}
      onKeyDown={event => {
        if (event.key === "Escape" && menuOpen && !event.defaultPrevented) { event.preventDefault(); closeMenu(); }
      }}
    >
      <a className={styles.skip} href="#workspace-content">
        К содержимому
      </a>
      <header className={styles.header}>
        <Link
          href="/catalog"
          className={styles.brand}
          aria-label="Platforma Market — каталог"
        >
          <img
            src="/brand/platforma-market.webp"
            width={600}
            height={200}
            alt="Platforma Market"
          />
        </Link>
        {ready && session?.organizationId ? (
          <DmButton
            id="workspace-menu-toggle"
            icon={<Navigation24Regular />}
            aria-expanded={menuOpen}
            aria-controls="workspace-sidebar"
            onClick={() => setMenuOpen((value) => !value)}
          >
            {menuOpen ? "Закрыть меню" : "Меню кабинета"}
          </DmButton>
        ) : null}
      </header>
      {ready && session?.organizationId ? (
        <aside
          id="workspace-sidebar"
          className={styles.sidebar}
          data-open={menuOpen}
        >
          <Link
            href="/catalog"
            className={styles.sidebarBrand}
            aria-label="Platforma Market — каталог"
          >
            <img
              src="/brand/platforma-market.webp"
              width={600}
              height={200}
              alt="Platforma Market"
            />
          </Link>
          <nav className={styles.navigation} aria-label={label}>
            {links[role].map(([href, text]) => (
              text === "Сообщения" ? <ConversationCounter key={href} api={api} href={href} icon={<Chat24Regular />} showLabel onClick={closeMenu} current={pathname === href} /> :
              <Link
                key={href}
                href={href}
                onClick={closeMenu}
                aria-current={
                  pathname === href ||
                  (href !== "/supplier" && href !== "/clinic" && pathname.startsWith(href + "/"))
                    ? "page"
                    : undefined
                }
              >
                <span aria-hidden="true">{navigationIcons[text]}</span>
                {text}
              </Link>
            ))}
          </nav>
          <div className={styles.sidebarFooter}>
            <WorkspaceFooter onNavigate={closeMenu} />
          </div>
        </aside>
      ) : null}
      <main id="workspace-content" className={styles.main}>
        {role === "supplier" && pathname.startsWith("/supplier/legal/") ? (
          children
        ) : !ready ? (
          <LoadingState label="Проверяем вход" />
        ) : !session?.organizationId ? (
          <ErrorState presentation="inline"
            title={
              error
                ? "Не удалось проверить вход"
                : `Войдите в ${role === "clinic" ? "кабинет клиники" : "кабинет поставщика"}`
            }
            description={
              error ?? "Выберите организацию с доступом к этому кабинету."
            }
            action={
              <>
                <DmButton
                  as="a"
                  href={withWorkspaceReturn(
                    "/login",
                    pathname + (query ? `?${query}` : ""),
                  )}
                >
                  Войти
                </DmButton>
                <DmButton onClick={() => void adapter.sessionStore.retry()}>
                  Повторить проверку
                </DmButton>
              </>
            }
          />
        ) : (
          <><MessageHeader />{logout.logoutError ? <ActionFeedback tone="error" description={logout.logoutError} /> : null}{pageContent}</>
        )}
      </main>
    </div>
  );
  if (!ready || !session?.organizationId) return renderContent(children);
  return <Context.Provider
    key={`${role}:${session.organizationId}:${session.sessionId}`}
    value={{ role, api, apiContext: adapter.sessionApiContext, organizationId: session.organizationId, session, logout }}
  >
    {role === "supplier" && pathname.startsWith("/supplier/legal/") ? renderContent(children) :
      <WorkspacePermissions api={api} organizationId={session.organizationId} render={renderContent}>{children}</WorkspacePermissions>}
  </Context.Provider>;
}
