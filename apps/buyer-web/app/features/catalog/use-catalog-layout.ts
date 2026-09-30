"use client";
import { useEffect, useRef, useState } from "react";

export function useCatalogLayout() {
  const catalogRef = useRef<HTMLElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const [sidebarFits, setSidebarFits] = useState(false);
  useEffect(() => {
    const catalog = catalogRef.current, toolbar = toolbarRef.current, sidebar = sidebarRef.current;
    if (!catalog || !toolbar || !sidebar) return;
    let frame: number | null = null;
    const measure = () => {
      frame = null;
      const toolbarHeight = toolbar.getBoundingClientRect().height;
      const headerHeight = parseFloat(getComputedStyle(catalog).getPropertyValue("--marketplace-header-height")) || 64;
      const sidebarHeight = sidebar.getBoundingClientRect().height;
      catalog.style.setProperty("--catalog-toolbar-height", `${toolbarHeight}px`);
      setSidebarFits(window.innerWidth >= 1024 && sidebarHeight > 0 && sidebarHeight + headerHeight + toolbarHeight + 32 <= window.innerHeight);
    };
    const schedule = () => { if (frame === null) frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    observer.observe(toolbar); observer.observe(sidebar);
    const headerObserver = new MutationObserver(schedule);
    headerObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
    window.addEventListener("resize", schedule);
    measure();
    return () => {
      observer.disconnect(); headerObserver.disconnect(); window.removeEventListener("resize", schedule);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);
  return { catalogRef, toolbarRef, sidebarRef, sidebarFits };
}
