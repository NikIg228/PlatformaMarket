"use client";
import { Button } from "@fluentui/react-components";
import type { ComponentPropsWithRef, HTMLAttributes } from "react";
import { classes, densityFor, type Density } from "./control-utils";


export type DmButtonProps = ComponentPropsWithRef<typeof Button> & Density & { intent?: "default" | "danger" | "brand" };

export function DmButton({ className, density, intent = "default", ...props }: DmButtonProps) {
  const appearance = props.appearance ?? "secondary";
  return <Button {...props} appearance={appearance} data-dm-appearance={appearance}
    data-dm-density={densityFor(density, props.size)} data-dm-intent={intent}
    data-dm-icon-only={props.icon && (props.children == null || props.children === false) ? "true" : undefined}
    className={classes("dm-button", className)} />;
}


/** Semantic actions whose content is a row, a choice card, a tab or inline text. */
export function DmAction({ className, variant, density, type = "button", ...props }: ComponentPropsWithRef<"button"> & Density & { variant: "text" | "navigation" | "choice" | "tab" | "row" | "avatar" }) {
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


/** Native disclosure semantics, with shared neutral trigger states. */
export function DmDisclosureSummary({ className, ...props }: ComponentPropsWithRef<"summary">) {
  return <summary {...props} className={classes("dm-disclosure-summary", className)} />;
}
