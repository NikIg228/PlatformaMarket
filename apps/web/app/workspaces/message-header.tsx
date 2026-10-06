"use client";
import { usePermissions } from "@marketplace/ui";
import { NotificationBell } from "./notification-bell";
import { ProfileMenu } from "./profile-menu";
import { useEffect, useState } from "react";
import { useWorkspace } from "./workspace";
import { workspaceGreeting } from "./greeting";
import styles from "./message-header.module.css";
import Link from "next/link";
import { ArrowLeft20Regular } from "@fluentui/react-icons/svg/arrow-left";
import { usePathname, useSearchParams } from "next/navigation";
import { workspaceNavigation } from "./page-title";
export function MessageHeader() {
  const { role, session } = useWorkspace();
  const pathname = usePathname();
  const search = useSearchParams();
  const navigation = workspaceNavigation(pathname, search.toString());
  const current = navigation.at(-1)!;
  const parent = navigation.at(-2);
  const home = pathname === `/${role}`;
  const has = usePermissions();
  const [greeting, setGreeting] = useState("Здравствуйте");
  useEffect(() => {
    const update = () => setGreeting(workspaceGreeting(new Date().getHours(), session.displayName));
    update();
    const timer = window.setInterval(update, 60_000);
    document.addEventListener("visibilitychange", update);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", update); };
  }, [session.displayName]);
  return <header className={styles.header} aria-label="События организации">
    <div className={styles.location}>
      {parent ? <Link className={styles.mobileBack} href={parent.href} aria-label={`Вернуться: ${parent.title}`} title={parent.title}><ArrowLeft20Regular /></Link> : null}
      {parent ? <nav className={styles.breadcrumbs} aria-label="Навигационный путь">{navigation.slice(0, -1).map(item => <span key={item.href}><Link href={item.href}>{item.title}</Link><span className={styles.separator} aria-hidden="true">/</span></span>)}</nav> : null}
      <h1 className={styles.greeting} title={home ? undefined : current.title}>{home ? greeting : current.title}</h1>
    </div>
    <div className={styles.actions}>
      {has("notification.view") ? <NotificationBell /> : null}
      <ProfileMenu />
    </div>
  </header>;
}
