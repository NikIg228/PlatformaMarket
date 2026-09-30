export const unifiedFrontend = process.env.NEXT_PUBLIC_UNIFIED_APP === "true";
/** Trusted in-app links only; authorization is always checked by the API. */
export function workspacePath(capability: "BUYER" | "SUPPLIER" | "ADMIN", path = "/") {
  if (!unifiedFrontend) return path;
  const prefix = capability === "BUYER" ? "/clinic" : capability === "SUPPLIER" ? "/supplier" : "/admin";
  if (path === prefix || path.startsWith(prefix + "/") || path.startsWith(prefix + "?")) return path;
  return prefix + (path === "/" ? "" : path);
}
