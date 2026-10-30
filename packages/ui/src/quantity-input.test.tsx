import { describe, expect, it, vi } from "vitest";
vi.mock("@fluentui/react-components", () => ({ Input: "input", Button: "button", Select: "select" }));
import { DmInput } from "./controls";
import { DmButton } from "./actions";

describe("opt-in purchasing controls", () => {
  it("keeps numeric validation and events while sizing from controlled quantity", () => {
    const change = () => {};
    for (const value of ["", "1", "10", "1000000", "0.25"]) {
      const element = DmInput({ quantity: true, type: "number", value, min: 1, max: 1000000, step: 1, onChange: change });
      expect(element.props).toMatchObject({ type: "number", min: 1, max: 1000000, step: 1, value, onChange: change, "data-dm-quantity": true });
      expect(element.props.style.width).toBe(`calc(${Math.max(1, value.length)}ch + var(--dm-space-6) + 2px)`);
    }
  });
  it("leaves ordinary inputs and buttons unchanged", () => {
    expect(DmInput({ value: "10" }).props["data-dm-quantity"]).toBeUndefined();
    expect(DmInput({ value: "10" }).props.style).toBeUndefined();
    expect(DmButton({ children: "Save" }).props["data-dm-layout"]).toBeUndefined();
    expect(DmButton({ layout: "inline", as: "a", href: "/supplier" }).props).toMatchObject({ as: "a", href: "/supplier", "data-dm-layout": "inline" });
  });
});
