"use client";
import { Avatar, Menu, MenuDivider, MenuItem, MenuItemLink, MenuList, MenuPopover, MenuTrigger, Spinner, Tooltip } from "@fluentui/react-components";
import { DmButton } from "@marketplace/ui";
import { Person24Regular } from "@fluentui/react-icons/svg/person";
import { SignOut24Regular } from "@fluentui/react-icons/svg/sign-out";
import { useWorkspace } from "./workspace";
import styles from "./profile.module.css";

export function ProfileMenu() {
  const { role, session, logout } = useWorkspace();
  return <Menu positioning={{ position: "below", align: "end" }}>
    <MenuTrigger disableButtonEnhancement>
      <Tooltip content="Мой профиль" relationship="label">
        <DmButton appearance="subtle" aria-label="Меню профиля" aria-busy={logout.logoutPending}
          icon={logout.logoutPending ? <Spinner size="tiny" aria-label="Выходим…" /> : <Avatar name={session.displayName} size={28} color="brand" aria-hidden="true" />} />
      </Tooltip>
    </MenuTrigger>
    <MenuPopover className={styles.menu}>
      <div className={styles.identity}>
        <strong>{session.displayName || "Сотрудник"}</strong>
        <span>{role === "clinic" ? "Кабинет клиники" : "Кабинет поставщика"}</span>
      </div>
      <MenuList>
        <MenuItemLink href={`/${role}/profile`} icon={<Person24Regular />}>Мой профиль</MenuItemLink>
        <MenuDivider />
        <MenuItem icon={<SignOut24Regular />} disabled={logout.logoutPending} onClick={logout.onLogout}>
          {logout.logoutPending ? "Выходим…" : "Выйти"}
        </MenuItem>
      </MenuList>
    </MenuPopover>
  </Menu>;
}
