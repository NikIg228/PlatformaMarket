"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Button, Input } from "@fluentui/react-components";
import { Search20Regular } from "@fluentui/react-icons/svg/search";
import { catalogContext, searchDestination } from "./navigation";
import styles from "./header.module.css";
type Suggestion = { id: string; name: string; brand: string | null };
export function HeaderSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [selected, setSelected] = useState(-1);
  const [retry, setRetry] = useState(0);
  const listId = useId(); const request = useRef<AbortController | null>(null);
  const generation = useRef(0); const root = useRef<HTMLFormElement>(null);
  const context = () => catalogContext(window.location.pathname, window.location.search);
  useEffect(() => {
    const sync = () => { setQuery(new URL(context(), window.location.origin).searchParams.get("q") ?? ""); setOpen(false); };
    sync(); window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  useEffect(() => {
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside); return () => document.removeEventListener("pointerdown", outside);
  }, []);
  useEffect(() => {
    const ticket = ++generation.current; request.current?.abort();
    setSelected(-1); setItems([]);
    if (!open || query.trim().length < 2) { setStatus("idle"); return; }
    const controller = new AbortController(); request.current = controller; setStatus("loading");
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/catalog-search?${new URLSearchParams({ q: query.trim(), limit: "6" })}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]), cache: "no-store" });
        if (!response.ok) throw Error();
        const result = await response.json();
        if (!Array.isArray(result.items)) throw Error();
        if (!controller.signal.aborted && ticket === generation.current) { setItems(result.items); setStatus("done"); }
      } catch { if (!controller.signal.aborted && ticket === generation.current) setStatus("error"); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, open, retry]);
  const navigate = (item?: Suggestion) => {
    request.current?.abort(); setOpen(false);
    const results = searchDestination(context(), query);
    window.location.assign(item ? `/products/${encodeURIComponent(item.id)}?${new URLSearchParams({ returnTo: results })}` : results);
  };
  return <form ref={root} role="search" className={styles.search} onSubmit={e => { e.preventDefault(); navigate(); }} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
    <Input className={styles.input} aria-label="Поиск по каталогу" role="combobox" aria-autocomplete="list" aria-expanded={open && query.trim().length >= 2} aria-controls={listId} aria-activedescendant={selected >= 0 ? `${listId}-${selected}` : undefined}
      placeholder="Название товара, бренд или артикул" value={query} maxLength={240}
      onFocus={() => setOpen(true)} onChange={(_, d) => { generation.current++; request.current?.abort(); setQuery(d.value); setOpen(true); }}
      onKeyDown={e => { if (e.key === "Enter" && open && selected >= 0 && items[selected]) { e.preventDefault(); navigate(items[selected]); } if (e.key === "Escape") { e.preventDefault(); setOpen(false); } if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setOpen(true); setSelected(n => items.length ? (n + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length : -1); } }}
      contentAfter={<>{query ? <Button type="button" appearance="transparent" aria-label="Очистить поиск" onClick={() => { generation.current++; request.current?.abort(); setQuery(""); setOpen(false); root.current?.querySelector("input")?.focus(); }}>×</Button> : null}<Button appearance="transparent" type="submit" icon={<Search20Regular />} aria-label="Найти" title="Найти" /></>} />
    {open && query.trim().length >= 2 ? <div className={styles.suggestions}>
      {status === "loading" ? <p role="status">Ищем товары…</p> : status === "error" ? <div role="alert"><p>Не удалось загрузить подсказки.</p><Button onClick={() => setRetry(v => v + 1)}>Повторить</Button></div> : null}
      <ul id={listId} role="listbox" aria-label="Подсказки товаров">{items.map((item, i) => <li id={`${listId}-${i}`} role="option" aria-selected={selected === i} key={item.id} onMouseDown={e => e.preventDefault()} onClick={() => navigate(item)}><strong>{item.name}</strong>{item.brand ? <small>{item.brand}</small> : null}</li>)}</ul>
      {status === "done" && !items.length ? <p role="status">Ничего не найдено</p> : null}
    </div> : null}
  </form>;
}
