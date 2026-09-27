"use client";
import { useEffect, useRef } from "react";
import { scheduleCartRefresh } from "./cart-refresh";

export function useCartAutoRefresh(cartId: string | undefined, blocked: boolean, refresh: () => Promise<void>) {
  const current = useRef({ blocked, refresh });
  current.current = { blocked, refresh };
  useEffect(() => {
    if (!cartId) return;
    return scheduleCartRefresh({
      visible: () => document.visibilityState !== "hidden",
      blocked: () => current.current.blocked,
      refresh: () => current.current.refresh(),
      interval: (callback, ms) => { const timer = window.setInterval(callback, ms); return () => window.clearInterval(timer); },
      onWake: callback => {
        window.addEventListener("focus", callback); document.addEventListener("visibilitychange", callback);
        return () => { window.removeEventListener("focus", callback); document.removeEventListener("visibilitychange", callback); };
      },
    });
  }, [cartId]);
}
