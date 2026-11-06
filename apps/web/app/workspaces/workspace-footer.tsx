"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePermissions } from "@marketplace/ui/permissions";
import { QuestionCircle24Regular } from "@fluentui/react-icons/svg/question-circle";
import { Settings24Regular } from "@fluentui/react-icons/svg/settings";
import { useWorkspace } from "./workspace";
import styles from "./workspace.module.css";
import { withWorkspaceLocale, workspaceText } from "./workspace-locale";

export function WorkspaceFooter({ onNavigate }: { onNavigate: () => void }) {
  const { role, locale } = useWorkspace();
  const t = (text: string) => workspaceText(locale, text);
  const pathname = usePathname();
  const has = usePermissions();
  const links = [
    ...(has("support.ticket.view") && !pathname.startsWith("/supplier/legal/") ? [{ path: "support", label: "Поддержка", icon: <QuestionCircle24Regular /> }] : []),
    { path: "settings", label: "Настройки", icon: <Settings24Regular /> },
  ];
  return <nav className={styles.navigation} aria-label={t("Помощь и настройки")}>
    {links.map(({ path, label, icon }) => {
      const href = `/${role}/${path}`;
      return <Link key={path} href={withWorkspaceLocale(href, locale)} onClick={onNavigate}
        aria-current={pathname === href || pathname.startsWith(href + "/") ? "page" : undefined}>
        <span aria-hidden="true">{icon}</span>{t(label)}
      </Link>;
    })}
  </nav>;
}
