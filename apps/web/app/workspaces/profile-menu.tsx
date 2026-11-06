"use client";
import { Avatar, Menu, MenuDivider, MenuItem, MenuItemLink, MenuList, MenuPopover, MenuTrigger, Spinner, Tooltip } from "@fluentui/react-components";
import { DmButton } from "@marketplace/ui/controls";
import { Person24Regular } from "@fluentui/react-icons/svg/person";
import { SignOut24Regular } from "@fluentui/react-icons/svg/sign-out";
import { useWorkspace } from "./workspace";
import styles from "./profile.module.css";
import { workspaceText, withWorkspaceLocale } from "./workspace-locale";

export function ProfileMenu() {
  const { role, session, logout, locale } = useWorkspace();
  const t = (text: string) => workspaceText(locale, text);
  return <Menu positioning={{ position: "below", align: "end" }}>
    <MenuTrigger disableButtonEnhancement>
      <Tooltip content={t("Мой профиль")} relationship="label">
        <DmButton appearance="subtle" aria-label={t("Меню профиля")} aria-busy={logout.logoutPending}
          icon={logout.logoutPending ? <Spinner size="tiny" aria-label={t("Выходим…")} /> : <Avatar name={session.displayName} size={28} color="brand" aria-hidden="true" />} />
      </Tooltip>
    </MenuTrigger>
    <MenuPopover className={styles.menu} lang={locale}>
      <div className={styles.identity}>
        <strong>{session.displayName || t("Сотрудник")}</strong>
        <span>{t(role === "clinic" ? "Кабинет клиники" : "Кабинет поставщика")}</span>
      </div>
      <MenuList>
        <MenuItemLink href={withWorkspaceLocale(`/${role}/profile`, locale)} icon={<Person24Regular />}>{t("Мой профиль")}</MenuItemLink>
        <MenuDivider />
        <MenuItem icon={<SignOut24Regular />} disabled={logout.logoutPending} onClick={logout.onLogout}>
          {t(logout.logoutPending ? "Выходим…" : "Выйти")}
        </MenuItem>
      </MenuList>
    </MenuPopover>
  </Menu>;
}
