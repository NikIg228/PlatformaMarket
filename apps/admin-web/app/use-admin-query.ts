"use client";
import { useMemo, useSyncExternalStore } from "react";
import { defaultAdminQuery, parseAdminQuery, serializeAdminQuery, type AdminQuery } from "@marketplace/schemas/product-navigation";

const event = "marketplace:admin-navigation";
const subscribe = (listener: () => void) => {
  window.addEventListener("popstate", listener);
  window.addEventListener(event, listener);
  return () => { window.removeEventListener("popstate", listener); window.removeEventListener(event, listener); };
};
const snapshot = () => window.location.search;
const serverSnapshot = () => "";

export function writeAdminQuery(state: AdminQuery, replace = false) {
  const search = serializeAdminQuery(state);
  if (window.location.search === search) return;
  window.history[replace ? "replaceState" : "pushState"](null, "", window.location.pathname + search);
  window.dispatchEvent(new Event(event));
}

export function useAdminQuery() {
  const search = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return useMemo(() => {
    const parsed = parseAdminQuery(search);
    return { state: parsed ?? defaultAdminQuery, valid: Boolean(parsed), write: writeAdminQuery };
  }, [search]);
}
