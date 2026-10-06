"use client";
import { Children, isValidElement, type ReactNode } from "react";
import { Option, type DropdownProps } from "@fluentui/react-components";
import { DmFluentDropdown as Dropdown } from "./controls";

type Props = Pick<DropdownProps, "disabled" | "id" | "aria-label" | "aria-labelledby" | "className"> & {
  value: string; children: ReactNode;
  onChange: (event: unknown, data: { value: string }) => void;
};
function options(children: ReactNode): Array<{ value: string; label: string; disabled?: boolean }> {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement<{ value?: string; children?: ReactNode; disabled?: boolean }>(child)) return [];
    if (child.type !== "option") return options(child.props.children);
    return [{ value: String(child.props.value ?? ""), label: Children.toArray(child.props.children).join(""), disabled: child.props.disabled }];
  });
}
/** Opt-in themed selector for edited forms; existing native consumers are unchanged. */
export function DmDropdown({ value, children, onChange, className, ...props }: Props) {
  const items = options(children);
  return <Dropdown {...props} className={`dm-control dm-dropdown ${className ?? ""}`} style={{ minWidth: 0, width: "100%" }}
    positioning={{ position: "below", align: "start", matchTargetSize: "width", autoSize: "height" }}
    value={items.find(item => item.value === value)?.label ?? ""} selectedOptions={[value]}
    onOptionSelect={(event, data) => { if (data.optionValue !== undefined) onChange(event, { value: data.optionValue }); }}>
    {items.map(item => <Option key={item.value} value={item.value} text={item.label} disabled={item.disabled}>{item.label}</Option>)}
  </Dropdown>;
}
