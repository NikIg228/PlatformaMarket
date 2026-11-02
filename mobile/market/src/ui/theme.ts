import geometry from "../../../../packages/ui/src/component-contract.json";
import semantic from "../../../../packages/ui/src/semantic-light.json";

type Key = keyof typeof geometry.tokens;
const number = (key: Key) => Number.parseFloat(geometry.tokens[key]);
export const palette = semantic.tokens;
export const theme = {
  space: { small: number("--dm-space-2"), medium: number("--dm-space-3"), page: number("--dm-space-4"), section: number("--dm-space-6") },
  radius: { control: number("--dm-radius-button"), card: number("--dm-radius-card") },
  height: number("--dm-control-default"),
  type: {
    body: number("--dm-font-size-body"), caption: number("--dm-font-size-caption"), title: number("--dm-font-size-title"), subtitle: number("--dm-font-size-subtitle"),
    line: number("--dm-line-body"), compact: number("--dm-line-compact"),
  },
};
