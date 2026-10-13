"use client";
import { useState, type ReactNode } from "react";
import { AppShell, type NavigationItem } from "@marketplace/ui/app-shell";
import { workspacePath } from "@marketplace/api-client/frontend-routes";
import { logoutAdmin, readAdminSession } from "./admin-auth";
import brand from "../../buyer-web/public/brand/platforma-market.webp";

/** Composition only: identity, renewal and exact-session logout stay in admin-auth. */
export function AdminShell({ navigation, active, title, onNavigate, actions, children }: {
  navigation: NavigationItem[];
  active: string;
  title: string;
  onNavigate: (id: string) => void;
  actions: ReactNode;
  children: ReactNode;
}) {
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const home = workspacePath("ADMIN");
  const logout = () => {
    if (logoutPending) return;
    setLogoutPending(true); setLogoutError("");
    void logoutAdmin().catch(() => {
      setLogoutPending(false);
      setLogoutError("Не удалось подтвердить выход на сервере. Проверьте соединение и повторите выход.");
    });
  };
  return <AppShell variant="workspace" productName="PlatformaMarket" productMark="PM"
    brandHref={home} brandImage={brand.src} workspaceLabel="Операторский кабинет"
    userName={readAdminSession()?.user?.displayName ?? "Команда PlatformaMarket"} userMeta="Оператор"
    navigation={navigation.map(item => ({ ...item, href: `${home}?section=${encodeURIComponent(item.id)}` }))}
    activeNavigation={active} contextLabel={title} onNavigate={onNavigate}
    onLogout={logout} logoutPending={logoutPending} logoutError={logoutError} actions={actions}>
    {children}
  </AppShell>;
}
