"use client";

import { Checkbox, Combobox, Dropdown, Field, Input, TabList, Textarea } from "@fluentui/react-components";
import type { ComponentPropsWithRef } from "react";
import { useLayoutEffect, useRef } from "react";

import { classes, densityFor, type Density } from "./control-utils";

/** Navigation between panels. Data filters use their separate filled selection. */
export function DmTabList({ className, ...props }: ComponentPropsWithRef<typeof TabList>) {
  return <TabList {...props} data-dm-tab-kind="navigation" className={classes("dm-navigation-tabs", className)} />;
}

export function DmField({ className, ...props }: ComponentPropsWithRef<typeof Field>) {
  return <Field {...props} className={classes("dm-field", className)} />;
}

export function DmInput({ className, density, ...props }: ComponentPropsWithRef<typeof Input> & Density) {
  return <Input {...props} data-dm-density={densityFor(density, props.size)} className={classes("dm-control", "dm-input", props.readOnly && props.appearance === "filled-darker" ? "dm-input-readonly" : undefined, className)} />;
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
