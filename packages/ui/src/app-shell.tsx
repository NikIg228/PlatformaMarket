"use client";
import { Avatar, Menu, MenuItem, MenuList, MenuPopover, MenuTrigger, OverlayDrawer, DrawerBody, DrawerHeader, DrawerHeaderTitle } from "@fluentui/react-components";
import { Dismiss24Regular } from "@fluentui/react-icons/svg/dismiss";
import { Navigation24Regular } from "@fluentui/react-icons/svg/navigation";
import { SignOut24Regular } from "@fluentui/react-icons/svg/sign-out";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { DmAction, DmButton as Button, DmDismissLayer } from "./actions";
import { dmLinkButtonProps } from "./link-button";
import { ActionFeedback } from "./action-feedback";
export type NavigationItem = {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: string;
  href?: string;
};

export type AppShellProps = {
  /** Existing consumers retain the original shell until explicitly opted in. */
  variant?: "legacy" | "workspace";
  brandHref?: string;
  brandImage?: string;
  productName: string;
  productMark: string;
  workspaceLabel: string;
  userName: string;
  userMeta: string;
  navigation: NavigationItem[];
  activeNavigation: string;
  contextLabel?: string;
  onNavigate: (id: string) => void;
  onLogout?: () => void;
  logoutPending?: boolean;
  logoutError?: string | null;
  actions?: ReactNode;
  children: ReactNode;
};

export function AppShell(props: AppShellProps) {
  return props.variant === "workspace" ? <WorkspaceShell {...props} /> : <LegacyAppShell {...props} />;
}

function WorkspaceShell({ productName, workspaceLabel, userName, userMeta, navigation,
  activeNavigation, contextLabel, onNavigate, onLogout, logoutPending = false,
  logoutError, actions, children, brandHref = "/", brandImage }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const main = useRef<HTMLElement>(null);
  const drawerId = useId();
  const contentId = useId();

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 761px)");
    const closeOnDesktop = () => { if (desktop.matches) setMobileOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  const closeMenu = () => setMobileOpen(false);
  const select = (id: string) => { onNavigate(id); closeMenu(); };
  const brand = <a href={brandHref} className="mp-shell-brand" aria-label={productName}>
    {brandImage ? <img src={brandImage} alt={productName} width={144} /> : <strong>{productName}</strong>}
  </a>;
  const links = <nav className="mp-shell-navigation" aria-label="Разделы кабинета">
    {navigation.map(item => item.href ? <a key={item.id} href={item.href}
      {...dmLinkButtonProps({ appearance: "subtle", className: "mp-shell-link" })}
      aria-current={item.id === activeNavigation ? "page" : undefined}
      onClick={event => {
        // Preserve native new-tab/window actions and the real destination URL.
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.defaultPrevented) return;
        event.preventDefault(); select(item.id);
      }}>
      <span aria-hidden="true">{item.icon}</span><span>{item.label}</span>
      {item.badge ? <small>{item.badge}</small> : null}
    </a> : <DmAction key={item.id} variant="navigation" className="mp-shell-link"
      aria-current={item.id === activeNavigation ? "page" : undefined} onClick={() => select(item.id)}>
      <span aria-hidden="true">{item.icon}</span><span>{item.label}</span>
      {item.badge ? <small>{item.badge}</small> : null}
    </DmAction>)}
  </nav>;
  const identity = <div className="mp-shell-identity"><strong>{userName}</strong><span>{userMeta}</span></div>;
  const logout = () => { if (!logoutPending) onLogout?.(); };

  return <div className="mp-shell-workspace">
    <a className="mp-shell-skip" href={`#${contentId}`} onClick={() => main.current?.focus()}>К содержимому</a>
    <aside ref={sidebar} className="mp-shell-sidebar" aria-label="Основная навигация">
      <div className="mp-shell-desktop-brand">{brand}</div>
      {links}
      <div className="mp-shell-sidebar-caption">{workspaceLabel}</div>
    </aside>
    <div className="mp-shell-page">
      <div className="mp-shell-mobile-brand">
        {brand}
        <Button ref={menuButton} appearance="subtle" icon={<Navigation24Regular />}
          aria-label="Открыть меню" aria-controls={drawerId} aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(true)} />
      </div>
      <header className="mp-shell-header">
        <h1>{contextLabel ?? navigation.find(item => item.id === activeNavigation)?.label}</h1>
        <div className="mp-shell-header-actions">
          {actions}
          <Menu positioning={{ position: "below", align: "end" }}>
            <MenuTrigger disableButtonEnhancement>
              <Button appearance="subtle" aria-label="Меню профиля" aria-busy={logoutPending}
                icon={<Avatar name={userName} size={28} color="brand" aria-hidden="true" />} />
            </MenuTrigger>
            <MenuPopover className="mp-shell-profile">
              {identity}
              {onLogout ? <MenuList><MenuItem icon={<SignOut24Regular />} disabled={logoutPending} onClick={logout}>
                {logoutPending ? "Выходим…" : "Выйти"}
              </MenuItem></MenuList> : null}
            </MenuPopover>
          </Menu>
        </div>
      </header>
      <main ref={main} id={contentId} tabIndex={-1} className="mp-shell-content">
        {logoutError ? <ActionFeedback tone="error" title="Выход не подтверждён" description={logoutError}
          action={<Button disabled={logoutPending} onClick={logout}>Повторить выход</Button>} /> : null}
        {children}
      </main>
    </div>
    <OverlayDrawer id={drawerId} className="mp-shell-drawer" open={mobileOpen} position="start" size="small"
      onOpenChange={(_, data) => setMobileOpen(data.open)}
      surfaceMotion={{ onMotionFinish: (_, data) => {
        if (data.direction !== "exit") return;
        if (window.matchMedia("(max-width: 760px)").matches) menuButton.current?.focus();
        else sidebar.current?.querySelector<HTMLElement>('[aria-current="page"]')?.focus();
      } }}>
      <DrawerHeader><DrawerHeaderTitle action={<Button appearance="subtle" icon={<Dismiss24Regular />}
        aria-label="Закрыть меню" onClick={closeMenu} />}>{workspaceLabel}</DrawerHeaderTitle></DrawerHeader>
      <DrawerBody className="mp-shell-drawer-body">{links}</DrawerBody>
      <div className="mp-shell-drawer-footer">
        {identity}
        {onLogout ? <Button icon={<SignOut24Regular />} disabled={logoutPending} aria-busy={logoutPending}
          onClick={() => { closeMenu(); logout(); }}>{logoutPending ? "Выходим…" : "Выйти"}</Button> : null}
      </div>
    </OverlayDrawer>
  </div>;
}

function LegacyAppShell({
  productName,
  productMark,
  workspaceLabel,
  userName,
  userMeta,
  navigation,
  activeNavigation,
  contextLabel,
  onNavigate,
  onLogout,
  logoutPending = false,
  logoutError,
  actions,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const closeMobileMenu = () => {
    const shouldRestoreFocus = mobileOpen;
    setMobileOpen(false);
    if (shouldRestoreFocus) {
      window.requestAnimationFrame(() => menuButtonRef.current?.focus());
    }
  };

  useEffect(() => {
    if (!mobileOpen) return;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMobileMenu();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);

  const navigate = (id: string) => {
    onNavigate(id);
    closeMobileMenu();
  };

  return (
    <div className="mp-shell">
      <aside
        id="mp-sidebar"
        className={`mp-sidebar${mobileOpen ? " is-open" : ""}`}
        aria-label="Основная навигация"
      >
        <div className="mp-brand">
          <span className="mp-brand-mark" aria-hidden="true">
            {productMark}
          </span>
          <span>
            <strong>{productName}</strong>
            <small>{workspaceLabel}</small>
          </span>
          <Button
            ref={closeButtonRef}
            className="mp-mobile-close"
            appearance="subtle"
            icon={<Dismiss24Regular />}
            aria-label="Закрыть меню"
            onClick={closeMobileMenu}
          />
        </div>

        <nav className="mp-navigation">
          {navigation.map((item) => (
            item.href ? <a key={item.id} href={item.href} onClick={closeMobileMenu}>
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge ? <small>{item.badge}</small> : null}
            </a> :
            <DmAction variant="navigation"
              key={item.id}
              type="button"
              className={item.id === activeNavigation ? "is-active" : ""}
              onClick={() => navigate(item.id)}
              aria-current={item.id === activeNavigation ? "page" : undefined}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge ? <small>{item.badge}</small> : null}
            </DmAction>
          ))}
        </nav>

        <div className="mp-sidebar-footer">
          <Avatar name={userName} color="colorful" size={32} />
          <span>
            <strong>{userName}</strong>
            <small>{userMeta}</small>
          </span>
          {onLogout ? (
            <Button
              appearance="subtle"
              icon={<SignOut24Regular />}
              aria-label={logoutPending ? "Выходим…" : "Выйти"}
              title={logoutPending ? "Выходим…" : "Выйти"}
              disabled={logoutPending}
              aria-busy={logoutPending}
              onClick={() => { closeMobileMenu(); onLogout(); }}
            />
          ) : null}
        </div>
      </aside>

      {mobileOpen ? (
        <DmDismissLayer
          type="button"
          className="mp-backdrop"
          aria-label="Закрыть меню"
          onClick={closeMobileMenu}
        />
      ) : null}

      <div className="mp-workspace">
        <header className="mp-topbar">
          <Button
            ref={menuButtonRef}
            className="mp-menu-button"
            appearance="subtle"
            icon={<Navigation24Regular />}
            aria-label="Открыть меню"
            aria-expanded={mobileOpen}
            aria-controls="mp-sidebar"
            onClick={() => setMobileOpen(true)}
          />
          <span className="mp-topbar-context">
            {contextLabel ?? navigation.find((item) => item.id === activeNavigation)?.label}
          </span>
          <div className="mp-topbar-actions">
            {actions}

          </div>
        </header>
        <main className="mp-content">
          {logoutError ? <ActionFeedback tone="error" description={logoutError} action={<Button disabled={logoutPending} onClick={onLogout}>Повторить выход</Button>} /> : null}
          {children}
        </main>
      </div>
    </div>
  );
}
