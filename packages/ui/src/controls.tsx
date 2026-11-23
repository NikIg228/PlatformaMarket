"use client";

import { Checkbox, Combobox, Dropdown, Field, Input, TabList, Textarea } from "@fluentui/react-components";
import type { ComponentPropsWithRef } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { Eye20Regular } from "@fluentui/react-icons/svg/eye";
import { EyeOff20Regular } from "@fluentui/react-icons/svg/eye-off";
import { DmButton } from "./actions";

import { classes, densityFor, type Density } from "./control-utils";

/** Navigation between panels. Data filters use their separate filled selection. */
export function DmTabList({ className, ...props }: ComponentPropsWithRef<typeof TabList>) {
  return <TabList {...props} data-dm-tab-kind="navigation" className={classes("dm-navigation-tabs", className)} />;
}

export function DmField({ className, typography = "default", ...props }: ComponentPropsWithRef<typeof Field> & { typography?: "default" | "auth" }) {
  return <Field {...props} data-dm-field-typography={typography === "default" ? undefined : typography} className={classes("dm-field", className)} />;
}

type DmInputProps = ComponentPropsWithRef<typeof Input> & Density & { quantity?: boolean };

export function DmInput(props: DmInputProps) {
  return props.type === "password" ? <PasswordInput {...props} /> : <InputControl {...props} />;
}

function PasswordInput(props: DmInputProps) {
  const [visible, setVisible] = useState(false);
  return <InputControl {...props} type={visible ? "text" : "password"} contentAfter={<>
    {props.contentAfter}
    <DmButton type="button" appearance="subtle" density="compact" disabled={props.disabled}
      aria-label={visible ? "Скрыть пароль" : "Показать пароль"} aria-pressed={visible}
      icon={visible ? <EyeOff20Regular /> : <Eye20Regular />} onClick={() => setVisible(current => !current)} />
  </>} />;
}

function InputControl({ className, density, quantity = false, style, ...props }: DmInputProps) {
  const digits = Math.max(1, Math.min(14, String(props.value ?? props.defaultValue ?? "").length));
  return <Input {...props} style={quantity ? { ...style, width: `calc(${digits}ch + var(--dm-space-6) + 2px)` } : style} data-dm-quantity={quantity || undefined} data-dm-density={densityFor(density, props.size)} className={classes("dm-control", "dm-input", quantity ? "dm-input-quantity" : undefined, props.readOnly && props.appearance === "filled-darker" ? "dm-input-readonly" : undefined, className)} />;
}

export function DmTextarea({ className, density, variant = "default", autoGrow = false, ...props }: ComponentPropsWithRef<typeof Textarea> & Density & { variant?: "default" | "composer"; autoGrow?: boolean }) {
  const input = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (!autoGrow || !input.current) return;
    input.current.style.height = "auto";
    input.current.style.height = `${input.current.scrollHeight}px`;
  }, [autoGrow, props.value]);
  return <Textarea {...props} textarea={autoGrow ? { ref: input, rows: 1 } : props.textarea} data-dm-density={densityFor(density, props.size)} className={classes("dm-control", "dm-textarea", variant === "composer" ? "dm-textarea-composer" : undefined, className)} />;
}

export function DmFluentDropdown({ className, density, ...props }: ComponentPropsWithRef<typeof Dropdown> & Density) {
  return <Dropdown {...props} data-dm-density={densityFor(density, props.size)} className={classes("dm-control", "dm-dropdown", className)} />;
}

export function DmCombobox({ className, density, ...props }: ComponentPropsWithRef<typeof Combobox> & Density) {
  return <Combobox {...props} data-dm-density={densityFor(density, props.size)} className={classes("dm-control", "dm-combobox", className)} />;
}

export function DmCheckbox({ className, ...props }: ComponentPropsWithRef<typeof Checkbox>) {
  return <Checkbox {...props} className={classes("dm-checkbox", className)} />;
}

export { DmButton, type DmButtonProps, DmAction, DmDismissLayer, DmFileInput, DmSurface, DmDisclosureSummary } from "./actions";
export { DmSelect } from "./native-select";
