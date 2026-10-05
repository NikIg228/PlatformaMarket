"use client";
import { Button, Input, type InputProps } from "@fluentui/react-components";
import { useRef } from "react";
import styles from "./dm-search.module.css";

type Props = Omit<InputProps, "value" | "defaultValue" | "onChange" | "contentBefore" | "contentAfter"> & {
  value: string;
  onChange: (value: string) => void;
  onSearch?: (value: string) => void;
  onClear?: () => void;
  pending?: boolean;
};

/** One search field for workspaces, including autocomplete and nested forms. */
export function DmSearch({ value, onChange, onSearch, onClear, pending = false, disabled, className, onKeyDown, ...props }: Props) {
  const root = useRef<HTMLInputElement>(null);
  const search = () => { if (!disabled && !pending) onSearch?.(value.trim()); };
  return <Input {...props} ref={root} value={value} disabled={disabled}
    className={`dm-control dm-input ${styles.search} ${className ?? ""}`}
    onChange={(_, data) => { onChange(data.value); if (!data.value) onSearch?.(""); }}
    onKeyDown={event => {
      if (event.key === "Enter" && event.nativeEvent.isComposing) { event.preventDefault(); return; }
      onKeyDown?.(event);
      if (event.key === "Enter" && !event.defaultPrevented && onSearch) { event.preventDefault(); search(); }
    }}
    contentAfter={value ? <span className={styles.actions}>
      <Button type="button" appearance="transparent" className={styles.clear} disabled={disabled} aria-label="Очистить поиск" onClick={() => {
        onChange(""); if (onClear) onClear(); else onSearch?.(""); root.current?.focus();
      }}>×</Button>
      <Button type={onSearch ? "button" : "submit"} appearance="transparent" className={styles.submit} disabled={disabled || pending || !value.trim()} onClick={onSearch ? search : undefined}>Найти</Button>
    </span> : undefined} />;
}
