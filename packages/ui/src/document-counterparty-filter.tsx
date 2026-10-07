"use client";
import { Option, Spinner } from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { DmButton, DmCombobox } from "./controls";
export type DocumentCounterpartyPage = { items: { id: string; name: string }[]; hasMore: boolean };
export function DocumentCounterpartyFilter({ label, value, load, onChange }: {
  label: string; value: string; load: (q: string) => Promise<DocumentCounterpartyPage>; onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<DocumentCounterpartyPage>({ items: [], hasMore: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => { if (!value) { setName(""); setQuery(""); } }, [value]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true); setError(false);
    const timer = setTimeout(() => void load(query).then(result => { if (active) setPage(result); }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); }), 250);
    return () => { active = false; clearTimeout(timer); };
  }, [load, open, query, retry]);
  return <div className="dm-registry-counterparty">
    <DmCombobox aria-label={label} placeholder={label} value={open ? query : name} selectedOptions={value ? [value] : []}
      open={open} onOpenChange={(_, data) => { setOpen(data.open); if (data.open) setQuery(""); }}
      onChange={event => setQuery(event.target.value)}
      onOptionSelect={(_, data) => { const id = data.optionValue ?? ""; setName(id ? data.optionText ?? "" : ""); onChange(id); setOpen(false); }}>
      <Option value="">{label}</Option>
      {page.items.map(item => <Option key={item.id} value={item.id}>{item.name}</Option>)}
      {loading ? <Option disabled value="loading" text="Поиск контрагентов"><Spinner size="tiny" label="Поиск контрагентов" /></Option> : null}
      {!loading && !error && !page.items.length ? <Option disabled value="empty">Контрагенты не найдены</Option> : null}
      {page.hasMore ? <Option disabled value="more">Уточните название для остальных результатов</Option> : null}
    </DmCombobox>
    {error ? <div role="alert">Не удалось найти контрагентов. <DmButton density="compact" onClick={() => { setOpen(true); setRetry(n => n + 1); }}>Повторить</DmButton></div> : null}
  </div>;
}
