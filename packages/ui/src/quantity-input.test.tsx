import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
const { inputProps } = vi.hoisted(() => ({ inputProps: vi.fn() }));
vi.mock("@fluentui/react-components", () => ({ Input: (props: ComponentProps<"input">) => { inputProps(props); return null; }, Button: "button", Select: "select" }));
import { DmInput } from "./controls";
import { DmButton } from "./actions";

describe("opt-in purchasing controls", () => {
  it("keeps numeric validation and events while sizing from controlled quantity", () => {
    const change = () => {};
    for (const value of ["", "1", "10", "1000000", "0.25"]) {
      renderToStaticMarkup(<DmInput quantity type="number" value={value} min={1} max={1000000} step={1} onChange={change} />);
      const props = inputProps.mock.lastCall![0];
      expect(props).toMatchObject({ type: "number", min: 1, max: 1000000, step: 1, value, onChange: change, "data-dm-quantity": true });
      expect(props.style.width).toBe(`calc(${Math.max(1, value.length)}ch + var(--dm-space-6) + 2px)`);
    }
  });
  it("leaves ordinary inputs and buttons unchanged", () => {
    renderToStaticMarkup(<DmInput value="10" onChange={() => {}} />);
    expect(inputProps.mock.lastCall![0]["data-dm-quantity"]).toBeUndefined();
    expect(inputProps.mock.lastCall![0].style).toBeUndefined();
    expect(DmButton({ children: "Save" }).props["data-dm-layout"]).toBeUndefined();
    expect(DmButton({ layout: "inline", as: "a", href: "/supplier" }).props).toMatchObject({ as: "a", href: "/supplier", "data-dm-layout": "inline" });
  });
});
