"use client";
import { Select } from "@fluentui/react-components";
import type { ComponentPropsWithRef } from "react";
import { classes, densityFor, type Density } from "./control-utils";


/** Native form compatibility: preserves name, required, ref and change events. */
export function DmSelect({ className, density, ...props }: ComponentPropsWithRef<typeof Select> & Density) {
  return <Select {...props} data-dm-density={densityFor(density, props.size)} className={classes("dm-control", "dm-select", className)} />;
}
