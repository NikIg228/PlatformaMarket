"use client";
import { useEffect, useRef, useState } from "react";
import { Menu, MenuTrigger, MenuPopover, MenuList, MenuItem, Button } from "@fluentui/react-components";
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
      let used = widths[0] + 8;
      const allFit = widths.reduce((sum, width) => sum + width + 8, -8) <= available;
      let count = 0;
      for (const width of widths.slice(1)) {
        if (used + width > available - (allFit ? 0 : 100)) break;
        used += width + 8; count++;
      }
      setVisible(count);
    };
    const observer = new ResizeObserver(update);
    observer.observe(root.current); observer.observe(measure.current); update();
    return () => observer.disconnect();
  }, [categories]);
  const choose = (id: string) => onSelect(id);
  return <nav ref={root} className={styles.categories} aria-label="Крупные категории">
    <div ref={measure} className={styles.categoryMeasure} aria-hidden="true"><span>Все товары</span>{categories.map(c => <span key={c.id}>{c.name}</span>)}</div>
    <div className={styles.categoryRow}>
      <button type="button" aria-pressed={!selected} onClick={() => choose("")}>Все товары</button>
      {categories.map((c, index) => <button key={c.id} type="button" className={index >= visible ? styles.overflowCategory : undefined} aria-pressed={selected === c.id} onClick={() => choose(c.id)}>{c.name}</button>)}
      {visible < categories.length ? <div className={styles.categoryMore}><Menu><MenuTrigger disableButtonEnhancement><Button aria-label="Ещё категории">Ещё{categories.slice(visible).some(c => c.id === selected) ? " · 1" : ""}</Button></MenuTrigger><MenuPopover><MenuList>{categories.slice(visible).map(c => <MenuItem key={c.id} onClick={() => choose(c.id)}>{c.name}{selected === c.id ? " ✓" : ""}</MenuItem>)}</MenuList></MenuPopover></Menu></div> : null}
    </div>
  </nav>;
}
