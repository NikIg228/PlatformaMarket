"use client";
import { type InputProps } from "@fluentui/react-components";
import { DmButton as Button, DmInput as Input } from "./controls";
import { useRef } from "react";
import { Dismiss16Regular } from "@fluentui/react-icons/svg/dismiss";
import styles from "./dm-search.module.css";

type Props = Omit<InputProps, "value" | "defaultValue" | "onChange" | "contentBefore" | "contentAfter"> & {
  value: string;
  onChange: (value: string) => void;
  onSearch?: (value: string) => void;
  onClear?: () => void;
  pending?: boolean;
  /** Fill a catalogue toolbar while preserving the default compact field width. */
  fullWidth?: boolean;
};

/** One search field for workspaces, including autocomplete and nested forms. */
export function DmSearch({ value, onChange, onSearch, onClear, pending = false, fullWidth = false, disabled, className, onKeyDown, ...props }: Props) {
  const root = useRef<HTMLInputElement>(null);
  const search = () => { if (!disabled && !pending) onSearch?.(value.trim()); };
  return <Input {...props} ref={root} value={value} disabled={disabled} data-dm-search-full-width={fullWidth || undefined}
    className={`dm-control dm-input ${styles.search} ${fullWidth ? styles.fullWidth : ""} ${className ?? ""}`}
    onChange={(_, data) => { onChange(data.value); if (!data.value) onSearch?.(""); }}
    onKeyDown={event => {
      if (event.key === "Enter" && event.nativeEvent.isComposing) { event.preventDefault(); return; }
      onKeyDown?.(event);
      if (event.key === "Enter" && !event.defaultPrevented && onSearch) { event.preventDefault(); search(); }
    }}
    contentAfter={value ? <span className={styles.actions}>
      <Button density="compact" type="button" appearance="transparent" icon={<Dismiss16Regular />} disabled={disabled} aria-label="Очистить поиск" onClick={() => {
        onChange(""); if (onClear) onClear(); else onSearch?.(""); root.current?.focus();
      }} />
      <Button density="compact" type={onSearch ? "button" : "submit"} appearance="transparent" disabled={disabled || pending || !value.trim()} onClick={onSearch ? search : undefined}>Найти</Button>
    </span> : undefined} />;
}
