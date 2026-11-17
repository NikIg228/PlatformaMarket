"use client";
import { useEffect, useSyncExternalStore } from "react";

/** The store owns the one-time exchange across StrictMode remounts and routes. */
export function useWorkspaceSession<T>(store: {
  subscribe: (notify: () => void) => () => void;
  getSnapshot: () => T;
  getServerSnapshot: () => T;
  start: () => Promise<void>;
  getAccessToken?: () => Promise<string | undefined>;
}) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  useEffect(() => { void store.start(); }, [store]);
  useEffect(() => {
    if (!store.getAccessToken) return;
    const check = () => {
      if (document.visibilityState === "visible") void store.getAccessToken?.().catch(() => {
        // Definitive revocation is published by the store; a network failure keeps the login.
      });
    };
    const timer = window.setInterval(check, 30_000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", check); document.removeEventListener("visibilitychange", check); };
  }, [store]);
  return state;
}
