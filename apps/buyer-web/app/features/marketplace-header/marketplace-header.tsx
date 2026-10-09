"use client";
import { useEffect, useRef } from "react";
import { HeaderCity } from "./header-city";
import { HeaderAccount } from "./header-account";
import styles from "./header.module.css";
export function HeaderLogo() {
  return <a href="/catalog" className={styles.logo} aria-label="Platforma Market — каталог"><img src="/brand/platforma-market.webp" width={600} height={200} alt="Platforma Market" /></a>;
}
export function MarketplaceHeader({ showCity = true, sticky = true }: { showCity?: boolean; sticky?: boolean }) {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!root.current) return;
    const update = () => document.documentElement.style.setProperty("--marketplace-header-height", `${root.current?.getBoundingClientRect().height ?? 0}px`);
    const observer = new ResizeObserver(update); observer.observe(root.current); update();
    return () => observer.disconnect();
  }, []);
  return <header ref={root} className={styles.header} data-sticky={sticky}><div className={styles.inner} data-city={showCity}><HeaderLogo />{showCity ? <HeaderCity /> : null}<HeaderAccount /></div></header>;
}
