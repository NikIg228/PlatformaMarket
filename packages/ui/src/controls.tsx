"use client";

import { Button, Checkbox, Combobox, Dropdown, Field, Input, Select, Textarea } from "@fluentui/react-components";
import type { ComponentPropsWithRef, HTMLAttributes } from "react";

type Density = { density?: "default" | "compact" };
const classes = (...values: Array<string | undefined>) => values.filter(Boolean).join(" ");
const densityFor = (density: Density["density"], size?: string) => density ?? (size === "small" ? "compact" : "default");

export function DmField({ className, ...props }: ComponentPropsWithRef<typeof Field>) {
  return <Field {...props} className={classes("dm-field", className)} />;
}

export function DmInput({ className, density, ...props }: ComponentPropsWithRef<typeof Input> & Density) {
  return <Input {...props} data-dm-density={densityFor(density, props.size)} className={classes("dm-control", "dm-input", className)} />;
}

export function DmTextarea({ className, density, variant = "default", ...props }: ComponentPropsWithRef<typeof Textarea> & Density & { variant?: "default" | "composer" }) {
  return <Textarea {...props} data-dm-density={densityFor(density, props.size)} className={classes("dm-control", "dm-textarea", variant === "composer" ? "dm-textarea-composer" : undefined, className)} />;
}

/** Native form compatibility: preserves name, required, ref and change events. */
export function DmSelect({ className, density, ...props }: ComponentPropsWithRef<typeof Select> & Density) {
  return <Select {...props} data-dm-density={densityFor(density, props.size)} className={classes("dm-control", "dm-select", className)} />;
}

export function DmFluentDropdown({ className, density, ...props }: ComponentPropsWithRef<typeof Dropdown> & Density) {
  return <Dropdown {...props} data-dm-density={densityFor(density, props.size)} className={classes("dm-control", "dm-dropdown", className)} />;
}

export function DmCombobox({ className, density, ...props }: ComponentPropsWithRef<typeof Combobox> & Density) {
  return <Combobox {...props} data-dm-density={densityFor(density, props.size)} className={classes("dm-control", "dm-combobox", className)} />;
}

export type DmButtonProps = ComponentPropsWithRef<typeof Button> & Density & { intent?: "default" | "danger" };
export function DmButton({ className, density, intent = "default", ...props }: DmButtonProps) {
  const appearance = props.appearance ?? "secondary";
  return <Button {...props} appearance={appearance} data-dm-appearance={appearance}
    data-dm-density={densityFor(density, props.size)} data-dm-intent={intent}
    data-dm-icon-only={props.icon && (props.children == null || props.children === false) ? "true" : undefined}
    className={classes("dm-button", className)} />;
}

export function DmCheckbox({ className, ...props }: ComponentPropsWithRef<typeof Checkbox>) {
  return <Checkbox {...props} className={classes("dm-checkbox", className)} />;
}

/** Semantic actions whose content is a row, a choice card, a tab or inline text. */
export function DmAction({ className, variant, density, type = "button", ...props }: ComponentPropsWithRef<"button"> & Density & { variant: "text" | "navigation" | "choice" | "tab" | "row" }) {
  return <button {...props} type={type} data-dm-action={variant} data-dm-density={densityFor(density)} className={classes("dm-action", className)} />;
}

/** A dismiss layer is not a visible action control; the labelled close action remains in the panel. */
export function DmDismissLayer(props: ComponentPropsWithRef<"button">) {
  return <button {...props} type="button" />;
}

/** Native file semantics (including hidden picker, reset and ref) are preserved. */
export function DmFileInput({ className, ...props }: Omit<ComponentPropsWithRef<"input">, "type">) {
  return <input {...props} type="file" className={classes("dm-file-input", className)} />;
}

/** Layout stays with the feature; shared surfaces own border, radius and fill. */
export function DmSurface({ className, variant = "card", ...props }: HTMLAttributes<HTMLDivElement> & { variant?: "card" | "section" | "filters" | "composer" }) {
  return <div {...props} data-dm-surface={variant} className={classes("dm-surface", className)} />;
}
