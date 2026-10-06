// Pure checks shared by the repository guard and its regression cases.
export function declarationIssues({ prop, value, selector = "", shared = false }) {
  if (prop.startsWith("--")) return [];
  const issues = [];
  if (/^border-(?:.*-)?radius$/.test(prop) && /\b\d+(?:px|%)\b/.test(value)) issues.push("Use a radius token (0 and inherit are allowed for flush edges).");
  if (/^(?:font-size|font-weight|line-height|letter-spacing)$/.test(prop) && /(?:\b\d+(?:px|em)\b|^\d*\.?\d+$)/.test(value) && value !== "0") issues.push("Use a typography token.");
  if (/^(?:gap|row-gap|column-gap|padding(?:-.+)?|margin(?:-.+)?)$/.test(prop)) {
    const pixels = [...value.matchAll(/(-?\d+(?:\.\d+)?)px\b/g)].map(m => Math.abs(Number(m[1])));
    if (pixels.some(n => n > 1)) issues.push("Use spacing tokens; only 1px alignment/hidden geometry is exempt.");
  }
  if (/(?:color|background|border|shadow|outline|fill|stroke)/.test(prop) && /#[\da-f]{3,8}\b|\brgba?\(|(?:^|\s)(?:white|black|red|blue|green)(?:\s|$)/i.test(value)) issues.push("Use semantic colours (including colour-mix for transparency).");
  if (/var\(--colorPalette/.test(value)) issues.push("Use Market semantic status colours, not an unrelated Fluent palette.");
  if (!shared && /:focus|focus-visible|focus-within/.test(selector) && /^(?:outline(?:-.+)?|box-shadow)$/.test(prop)) issues.push("The shared layer owns focus indicators.");
  if (prop === "box-shadow" && value !== "none" && !value.startsWith("inset") && !value.includes("var(--dm-shadow-") && !selector.includes(".hero::after")) issues.push("Use a shared elevation token; inset selection indicators are separate.");
  return issues;
}

export const controlStyleProperties = /^(?:height|minHeight|maxHeight|border.*|background.*|boxShadow|outline.*|font.*|lineHeight|letterSpacing|padding.*|color)$/;

// Match the styled element, not a control mentioned only as an ancestor.
export function targetsBoxedControl(selector, classes = new Set()) {
  const normalized = selector.replace(/:global\(([^)]+)\)/g, "$1")
    .replace(/:(?:not|has)\([^)]*\)/g, "").replace(/\[[^\]]*\]/g, "")
    .replace(/::?[\w-]+(?:\([^)]*\))?/g, "");
  return normalized.split(",").some(part => {
    const terminal = part.trim().split(/[\s>+~]+/).at(-1);
    return /\.fui-(?:Button|Input|Select|Textarea|Dropdown|Combobox)(?:__[\w-]+)?\b/.test(terminal)
      || [...terminal.matchAll(/\.([\w-]+)/g)].some(match => classes.has(match[1]));
  });
}

export function controlDeclarationIssue(prop) {
  return /^(?:min-height|height|max-height|border(?:-.+)?|background(?:-.+)?|box-shadow|outline(?:-.+)?|font(?:-.+)?|line-height|letter-spacing|padding(?:-.+)?|color)$/.test(prop);
}

export function inlineIssues(name, value) {
  if (value === 0 || value === "0") return [];
  const prop = name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
  if (/^(?:gap|row-gap|column-gap|padding(?:-.+)?|margin(?:-.+)?|border-radius|font-size)$/.test(prop) && typeof value === "number") return ["Use a shared token instead of an inline dimension."];
  return declarationIssues({ prop, value: String(value), shared: true });
}
