"use client";

import { useEffect, useRef } from "react";
import styles from "../auth-split.module.css";

export function RegistrationHeading({ isSupplier }: { isSupplier: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const heading = headingRef.current;
    if (!container || !heading) return;

    const desktop = window.matchMedia("(min-width: 901px)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame: number | null = null;

    const updatePosition = () => {
      frame = null;
      if (!desktop.matches || reducedMotion.matches) {
        heading.style.removeProperty("--registration-heading-top");
        return;
      }

      const viewportHeight = window.innerHeight;
      const headingHeight = heading.getBoundingClientRect().height;
      const initialTop = container.getBoundingClientRect().top + window.scrollY;
      const maxScroll = document.documentElement.scrollHeight - viewportHeight;
      const progress = maxScroll > 0
        ? Math.min(1, Math.max(0, window.scrollY / maxScroll))
        : 0;
      const easedProgress = progress * progress * (3 - 2 * progress);
      const centeredTop = Math.max(24, (viewportHeight - headingHeight) / 2);
      const top = initialTop + (centeredTop - initialTop) * easedProgress;

      heading.style.setProperty("--registration-heading-top", `${top}px`);
    };

    const scheduleUpdate = () => {
      if (frame === null) frame = window.requestAnimationFrame(updatePosition);
    };

    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(container);
    observer.observe(heading);
    observer.observe(document.body);
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    desktop.addEventListener("change", scheduleUpdate);
    reducedMotion.addEventListener("change", scheduleUpdate);
    updatePosition();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      desktop.removeEventListener("change", scheduleUpdate);
      reducedMotion.removeEventListener("change", scheduleUpdate);
      if (frame !== null) window.cancelAnimationFrame(frame);
      heading.style.removeProperty("--registration-heading-top");
    };
  }, []);

  return (
    <div className={styles.registerHeading} ref={containerRef}>
      <h1 ref={headingRef}>
        {isSupplier
          ? "Начните продавать клиникам Казахстана"
          : "Управляйте закупками клиники в одном месте"}
      </h1>
    </div>
  );
}
