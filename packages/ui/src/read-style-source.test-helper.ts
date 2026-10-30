import { readFileSync } from "node:fs";

/** Read the local stylesheet graph in cascade order for source contract checks. */
export function readStyleSource(url: URL, ancestors: readonly string[] = []): string {
  if (ancestors.includes(url.href)) throw new Error("Cyclic stylesheet import: " + url.href);
  return readFileSync(url, "utf8").replace(/@import\s+["'](\.[^"']+)["']\s*;/g, (_, relative: string) =>
    readStyleSource(new URL(relative, url), [...ancestors, url.href]));
}
