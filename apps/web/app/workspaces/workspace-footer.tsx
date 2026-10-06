"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePermissions } from "@marketplace/ui";
import { QuestionCircle24Regular } from "@fluentui/react-icons/svg/question-circle";
import { Settings24Regular } from "@fluentui/react-icons/svg/settings";
import { useWorkspace } from "./workspace";
import styles from "./workspace.module.css";

export function WorkspaceFooter({ onNavigate }: { onNavigate: () => void }) {
  const { role } = useWorkspace();
  const pathname = usePathname();
  const has = usePermissions();
  const links = [
    ...(has("support.ticket.view") && !pathname.startsWith("/supplier/legal/") ? [{ path: "support", label: "Поддержка", icon: <QuestionCircle24Regular /> }] : []),
    { path: "settings", label: "Настройки", icon: <Settings24Regular /> },
  ];
  return <nav className={styles.navigation} aria-label="Помощь и настройки">
    {links.map(({ path, label, icon }) => {
      const href = `/${role}/${path}`;
      return <Link key={path} href={href} onClick={onNavigate}
        aria-current={pathname === href || pathname.startsWith(href + "/") ? "page" : undefined}>
        <span aria-hidden="true">{icon}</span>{label}
      </Link>;
    })}
  </nav>;
}
