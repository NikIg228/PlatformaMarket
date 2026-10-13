export type Density = { density?: "default" | "compact" };
export const classes = (...values: Array<string | undefined>) => values.filter(Boolean).join(" ");
export const densityFor = (density: Density["density"], size?: string) => density ?? (size === "small" ? "compact" : "default");
