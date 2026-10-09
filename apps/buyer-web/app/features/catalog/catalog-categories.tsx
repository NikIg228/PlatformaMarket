"use client";
import { DmAction } from "@marketplace/ui/controls";
import { useEffect, useRef, useState } from "react";
import { Menu, MenuTrigger, MenuPopover, MenuList, MenuItem } from "@fluentui/react-components";
import { DmButton as Button } from "@marketplace/ui/controls";
import styles from "./compact-catalog.module.css";

type Category = { id: string; name: string };
export function CatalogCategories({ categories, selected, onSelect }: { categories: Category[]; selected: string; onSelect: (id: string) => void }) {
  const root = useRef<HTMLElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(0);
  useEffect(() => {
    if (!root.current || !measure.current) return;
    const update = () => {
      const widths = Array.from(measure.current!.children).map(el => el.getBoundingClientRect().width);
      const available = root.current!.clientWidth;
      const gap = parseFloat(getComputedStyle(measure.current!).columnGap) || 0;
      let used = widths[0] + gap;
      const allFit = widths.reduce((sum, width) => sum + width + gap, -gap) <= available;
      let count = 0;
      for (const width of widths.slice(1)) {
        if (used + width > available - (allFit ? 0 : 100)) break;
        used += width + gap; count++;
      }
      setVisible(count);
    };
    const observer = new ResizeObserver(update);
    observer.observe(root.current); observer.observe(measure.current); update();
    return () => observer.disconnect();
  }, [categories]);
  const choose = (id: string) => onSelect(id);
  return <nav ref={root} className={styles.categories} aria-label="Крупные категории">
    <div ref={measure} className={styles.categoryMeasure} aria-hidden="true"><DmAction variant="choice" disabled tabIndex={-1}>Все товары</DmAction>{categories.map(c => <DmAction variant="choice" disabled tabIndex={-1} key={c.id}>{c.name}</DmAction>)}</div>
    <div className={styles.categoryRow}>
      <DmAction variant="choice" type="button" aria-pressed={!selected} onClick={() => choose("")}>Все товары</DmAction>
      {categories.map((c, index) => <DmAction variant="choice" key={c.id} type="button" className={index >= visible ? styles.overflowCategory : undefined} aria-pressed={selected === c.id} onClick={() => choose(c.id)}>{c.name}</DmAction>)}
      {visible < categories.length ? <div className={styles.categoryMore}><Menu><MenuTrigger disableButtonEnhancement><Button aria-label="Ещё категории">Ещё{categories.slice(visible).some(c => c.id === selected) ? " · 1" : ""}</Button></MenuTrigger><MenuPopover><MenuList>{categories.slice(visible).map(c => <MenuItem key={c.id} onClick={() => choose(c.id)}>{c.name}{selected === c.id ? " ✓" : ""}</MenuItem>)}</MenuList></MenuPopover></Menu></div> : null}
    </div>
  </nav>;
}
