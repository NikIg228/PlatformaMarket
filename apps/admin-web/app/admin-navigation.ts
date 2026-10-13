import { unifiedFrontend, workspacePath } from "@marketplace/api-client";
import { adminReturnPath } from "@marketplace/schemas/product-navigation";

export function adminLoginUrl(location: { pathname: string; search: string }) {
  const path = unifiedFrontend ? location.pathname : `/admin${location.pathname === "/" ? "" : location.pathname}`;
  const destination = adminReturnPath(path + location.search);
  const login = workspacePath("ADMIN", "/login");
  return destination ? `${login}?${new URLSearchParams({ returnTo: destination })}` : login;
}

export function adminLoginDestination(search: string) {
  const query = new URLSearchParams(search);
  const destination = query.getAll("returnTo").length === 1 ? adminReturnPath(query.get("returnTo")) : undefined;
  const canonical = destination ?? "/admin";
  return unifiedFrontend ? canonical : canonical.replace(/^\/admin(?=\?|$)/, "/");
}
