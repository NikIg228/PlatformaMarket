export const unifiedFrontend = process.env.NEXT_PUBLIC_UNIFIED_APP === "true";
/** Trusted in-app links only; authorization is always checked by the API. */
export function workspacePath(capability: "BUYER" | "SUPPLIER" | "ADMIN", path = "/") {
  if (!unifiedFrontend) return path;
  const prefix = capability === "BUYER" ? "/clinic" : capability === "SUPPLIER" ? "/supplier" : "/admin";
  if (path === prefix || path.startsWith(prefix + "/") || path.startsWith(prefix + "?")) return path;
  return prefix + (path === "/" ? "" : path);
}

/** Legacy defaults stay explicit; unified builds inject same-origin values. */
export const legacyFrontendOrigins = {
  landing: "https://dentmarket-kz.vercel.app",
  buyer: "https://dentmarket-store.vercel.app",
  supplier: "https://dentmarket-supplier.vercel.app",
  api: "https://dentmarket-api.vercel.app/api",
} as const;
export const publicFrontendUrls = {
  landing: process.env.NEXT_PUBLIC_LANDING_APP_URL ?? (process.env.NODE_ENV === "development" ? "http://127.0.0.1:3003" : legacyFrontendOrigins.landing),
  buyer: process.env.NEXT_PUBLIC_BUYER_APP_URL ?? (process.env.NODE_ENV === "development" ? "http://127.0.0.1:3001" : legacyFrontendOrigins.buyer),
  supplier: process.env.NEXT_PUBLIC_SUPPLIER_APP_URL ?? (process.env.NODE_ENV === "development" ? "http://127.0.0.1:3002" : legacyFrontendOrigins.supplier),
};
export const publicLoginUrl = process.env.NEXT_PUBLIC_LOGIN_URL ?? `${publicFrontendUrls.landing}/login`;
